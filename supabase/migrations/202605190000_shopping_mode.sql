alter table public.lists
  add column if not exists shopping_mode_enabled boolean not null default false;

alter table public.list_items
  drop constraint if exists list_items_status_check;

alter table public.list_items
  add constraint list_items_status_check
  check (status in ('active', 'in_cart', 'archived'));

create or replace function public.start_shopping_with_session(
  p_session_token uuid,
  p_list_id uuid
)
returns public.lists
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_list public.lists;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.lists
  set shopping_mode_enabled = true,
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

create or replace function public.finish_shopping_with_session(
  p_session_token uuid,
  p_list_id uuid,
  p_device_id text,
  p_mutation_id uuid
)
returns public.lists
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_list public.lists;
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

  update public.list_items
  set status = 'archived',
      archived_at = timezone('utc', now()),
      updated_by = current_user_id,
      last_mutation_id = p_mutation_id,
      last_mutation_device_id = p_device_id,
      updated_at = timezone('utc', now())
  where list_id = p_list_id
    and status = 'in_cart'
    and deleted_at is null;

  update public.lists
  set shopping_mode_enabled = false,
      updated_at = timezone('utc', now())
  where id = p_list_id
  returning * into updated_list;

  return updated_list;
end;
$$;

create or replace function public.set_list_item_in_cart_with_session(
  p_session_token uuid,
  p_item_id uuid,
  p_device_id text,
  p_mutation_id uuid
)
returns public.list_items
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_item public.list_items;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.list_items
  set status = 'in_cart',
      archived_at = null,
      updated_by = current_user_id,
      last_mutation_id = p_mutation_id,
      last_mutation_device_id = p_device_id,
      updated_at = timezone('utc', now())
  where id = p_item_id
    and deleted_at is null
    and exists (
      select 1
      from public.list_members member
      where member.list_id = public.list_items.list_id
        and member.user_id = current_user_id
    )
  returning * into updated_item;

  return updated_item;
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
          'shopping_mode_enabled', list_row.shopping_mode_enabled,
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

grant execute on function public.start_shopping_with_session(uuid, uuid) to anon, authenticated;
grant execute on function public.finish_shopping_with_session(uuid, uuid, text, uuid) to anon, authenticated;
grant execute on function public.set_list_item_in_cart_with_session(uuid, uuid, text, uuid) to anon, authenticated;
grant execute on function public.get_dashboard_by_session(uuid) to anon, authenticated;
