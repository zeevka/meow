alter table public.lists
  add column if not exists classifier_model text not null default 'smart'
    check (classifier_model in ('fast', 'smart', 'think'));

create or replace function public.update_list_settings_with_session(
  p_session_token uuid,
  p_list_id uuid,
  p_classifier_model text
)
returns public.lists
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_list public.lists;
  normalized_model text;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  normalized_model := nullif(trim(coalesce(p_classifier_model, '')), '');

  if normalized_model is not null and normalized_model not in ('fast', 'smart', 'think') then
    raise exception 'Invalid model';
  end if;

  update public.lists
  set classifier_model = coalesce(normalized_model, classifier_model),
      updated_at = timezone('utc', now())
  where id = p_list_id
    and exists (
      select 1
      from public.list_members
      where list_id = p_list_id
        and user_id = current_user_id
    )
  returning * into updated_list;

  if updated_list.id is null then
    raise exception 'Not allowed';
  end if;

  return updated_list;
end;
$$;

create or replace function public.bulk_archive_active_items_with_session(
  p_session_token uuid,
  p_list_id uuid,
  p_device_id text,
  p_mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_rows jsonb;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.list_members
    where list_id = p_list_id
      and user_id = current_user_id
  ) then
    raise exception 'Not allowed';
  end if;

  with updated as (
    update public.list_items
    set status = 'archived',
        archived_at = timezone('utc', now()),
        updated_by = current_user_id,
        last_mutation_id = p_mutation_id,
        last_mutation_device_id = p_device_id,
        updated_at = timezone('utc', now())
    where list_id = p_list_id
      and status = 'active'
      and deleted_at is null
    returning to_jsonb(list_items) as row
  )
  select coalesce(jsonb_agg(row), '[]'::jsonb)
  into updated_rows
  from updated;

  return updated_rows;
end;
$$;

create or replace function public.bulk_restore_archived_items_with_session(
  p_session_token uuid,
  p_list_id uuid,
  p_device_id text,
  p_mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_rows jsonb;
  base_sort numeric;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.list_members
    where list_id = p_list_id
      and user_id = current_user_id
  ) then
    raise exception 'Not allowed';
  end if;

  select coalesce(max(sort_index), 0)
  into base_sort
  from public.list_items
  where list_id = p_list_id
    and deleted_at is null;

  with to_restore as (
    select id,
           row_number() over (order by archived_at desc nulls last, updated_at desc) as offset_rank
    from public.list_items
    where list_id = p_list_id
      and status = 'archived'
      and deleted_at is null
  ),
  updated as (
    update public.list_items li
    set status = 'active',
        archived_at = null,
        sort_index = base_sort + tr.offset_rank,
        updated_by = current_user_id,
        last_mutation_id = p_mutation_id,
        last_mutation_device_id = p_device_id,
        updated_at = timezone('utc', now())
    from to_restore tr
    where li.id = tr.id
    returning to_jsonb(li) as row
  )
  select coalesce(jsonb_agg(row), '[]'::jsonb)
  into updated_rows
  from updated;

  return updated_rows;
end;
$$;

create or replace function public.get_dashboard_by_session(p_session_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  payload jsonb;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select jsonb_build_object(
    'viewer', jsonb_build_object(
      'id', profile.id,
      'email', profile.email
    ),
    'profile', to_jsonb(profile),
    'lists', coalesce((
      select jsonb_agg(list_entry order by (list_entry->>'updated_at') desc)
      from (
        select jsonb_build_object(
          'id', list_row.id,
          'owner_user_id', list_row.owner_user_id,
          'title', list_row.title,
          'share_slug', list_row.share_slug,
          'is_link_sharing_enabled', list_row.is_link_sharing_enabled,
          'classifier_model', list_row.classifier_model,
          'created_at', list_row.created_at,
          'updated_at', list_row.updated_at,
          'role', member.role,
          'member_count', (
            select count(*)
            from public.list_members count_member
            where count_member.list_id = list_row.id
          )
        ) as list_entry
        from public.list_members member
        join public.lists list_row on list_row.id = member.list_id
        where member.user_id = current_user_id
      ) dashboard_lists
    ), '[]'::jsonb)
  )
  into payload
  from public.profiles profile
  where profile.id = current_user_id;

  return payload;
end;
$$;

grant execute on function public.update_list_settings_with_session(uuid, uuid, text) to anon, authenticated;
grant execute on function public.bulk_archive_active_items_with_session(uuid, uuid, text, uuid) to anon, authenticated;
grant execute on function public.bulk_restore_archived_items_with_session(uuid, uuid, text, uuid) to anon, authenticated;
