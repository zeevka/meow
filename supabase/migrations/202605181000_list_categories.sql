create table if not exists public.list_categories (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 32),
  sort_index integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists list_categories_list_idx
  on public.list_categories (list_id)
  where deleted_at is null;

alter table public.list_items
  drop constraint if exists list_items_category_check;

alter table public.list_items
  add constraint list_items_category_check
  check (category is null or char_length(category) between 1 and 64);

create or replace function public.create_list_category_with_session(
  p_session_token uuid,
  p_list_id uuid,
  p_label text
)
returns public.list_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_label text;
  next_sort integer;
  created_row public.list_categories;
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

  normalized_label := nullif(trim(coalesce(p_label, '')), '');
  if normalized_label is null then
    raise exception 'Label is required';
  end if;

  if char_length(normalized_label) > 32 then
    raise exception 'Label too long';
  end if;

  select coalesce(max(sort_index), -1) + 1 into next_sort
  from public.list_categories
  where list_id = p_list_id
    and deleted_at is null;

  insert into public.list_categories (list_id, label, sort_index)
  values (p_list_id, normalized_label, next_sort)
  returning * into created_row;

  return created_row;
end;
$$;

create or replace function public.update_list_category_with_session(
  p_session_token uuid,
  p_category_id uuid,
  p_label text
)
returns public.list_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_label text;
  updated_row public.list_categories;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  normalized_label := nullif(trim(coalesce(p_label, '')), '');
  if normalized_label is null then
    raise exception 'Label is required';
  end if;

  if char_length(normalized_label) > 32 then
    raise exception 'Label too long';
  end if;

  update public.list_categories cat
  set label = normalized_label,
      updated_at = timezone('utc', now())
  where cat.id = p_category_id
    and cat.deleted_at is null
    and exists (
      select 1
      from public.list_members member
      where member.list_id = cat.list_id
        and member.user_id = current_user_id
    )
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Category not found';
  end if;

  return updated_row;
end;
$$;

create or replace function public.delete_list_category_with_session(
  p_session_token uuid,
  p_category_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  target_list_id uuid;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select list_id into target_list_id
  from public.list_categories
  where id = p_category_id
    and deleted_at is null;

  if target_list_id is null then
    raise exception 'Category not found';
  end if;

  if not exists (
    select 1
    from public.list_members
    where list_id = target_list_id
      and user_id = current_user_id
  ) then
    raise exception 'Not allowed';
  end if;

  update public.list_items
  set category = null,
      custom_category_label = null,
      category_source = null,
      updated_at = timezone('utc', now())
  where list_id = target_list_id
    and category = p_category_id::text
    and deleted_at is null;

  update public.list_categories
  set deleted_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_category_id;

  return p_category_id;
end;
$$;

drop function if exists public.get_list_payload_by_session(uuid, text);

create or replace function public.get_list_payload_by_session(
  p_session_token uuid,
  p_share_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  target_list public.lists;
  payload jsonb;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  target_list := public.ensure_list_access(p_session_token, p_share_slug);

  select jsonb_build_object(
    'viewer', jsonb_build_object(
      'id', viewer.id,
      'email', viewer.email
    ),
    'profile', to_jsonb(viewer),
    'list', to_jsonb(target_list),
    'members', coalesce((
      select jsonb_agg(member_entry order by (member_entry->>'joined_at') asc)
      from (
        select jsonb_build_object(
          'list_id', member.list_id,
          'user_id', member.user_id,
          'role', member.role,
          'joined_at', member.joined_at,
          'added_via_link', member.added_via_link,
          'profile', to_jsonb(profile)
        ) as member_entry
        from public.list_members member
        join public.profiles profile on profile.id = member.user_id
        where member.list_id = target_list.id
      ) members_subquery
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(item_entry order by (item_entry->>'sort_index')::numeric asc, item_entry->>'created_at' asc)
      from (
        select to_jsonb(item_row) as item_entry
        from public.list_items item_row
        where item_row.list_id = target_list.id
          and item_row.deleted_at is null
      ) items_subquery
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(cat) order by cat.sort_index asc, cat.created_at asc)
      from public.list_categories cat
      where cat.list_id = target_list.id
        and cat.deleted_at is null
    ), '[]'::jsonb)
  )
  into payload
  from public.profiles viewer
  where viewer.id = current_user_id;

  return payload;
end;
$$;

create or replace function public.update_list_item_category_with_session(
  p_session_token uuid,
  p_item_id uuid,
  p_category text,
  p_custom_label text,
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
  normalized_category text;
  normalized_custom_label text;
  target_list_id uuid;
  is_builtin boolean;
  is_custom boolean;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  normalized_category := nullif(trim(coalesce(p_category, '')), '');
  normalized_custom_label := nullif(trim(coalesce(p_custom_label, '')), '');

  select list_id into target_list_id
  from public.list_items
  where id = p_item_id
    and deleted_at is null;

  if target_list_id is null then
    raise exception 'Item not found';
  end if;

  if normalized_category is not null then
    is_builtin := normalized_category in (
      'dairy','produce','bakery','meat','pantry',
      'drinks','frozen','household','personal_care','snacks','other'
    );

    if not is_builtin then
      select exists (
        select 1
        from public.list_categories
        where list_id = target_list_id
          and id::text = normalized_category
          and deleted_at is null
      ) into is_custom;

      if not is_custom then
        raise exception 'Invalid category';
      end if;
    end if;
  end if;

  update public.list_items
  set category = normalized_category,
      custom_category_label = case
        when normalized_category is null then null
        when normalized_category <> 'other' then null
        when normalized_custom_label is not null then normalized_custom_label
        else custom_category_label
      end,
      category_source = case
        when normalized_category is null then null
        else 'manual'
      end,
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

create or replace function public.bulk_update_list_item_categories_with_session(
  p_session_token uuid,
  p_list_id uuid,
  p_item_ids uuid[],
  p_updates jsonb,
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

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'Invalid updates payload';
  end if;

  with normalized_updates as (
    select
      (entry.value->>'id')::uuid as id,
      nullif(trim(coalesce(entry.value->>'category', '')), '') as category,
      nullif(trim(coalesce(entry.value->>'customLabel', '')), '') as custom_label
    from jsonb_array_elements(p_updates) as entry(value)
  ),
  validated_updates as (
    select
      nu.id,
      case
        when nu.category is null then null
        when nu.category in (
          'dairy','produce','bakery','meat','pantry',
          'drinks','frozen','household','personal_care','snacks','other'
        ) then nu.category
        when exists (
          select 1
          from public.list_categories cat
          where cat.list_id = p_list_id
            and cat.id::text = nu.category
            and cat.deleted_at is null
        ) then nu.category
        else 'other'
      end as category,
      case
        when nu.category = 'other' then nu.custom_label
        else null
      end as custom_label
    from normalized_updates nu
  ),
  updated as (
    update public.list_items li
    set category = vu.category,
        custom_category_label = vu.custom_label,
        category_source = case when vu.category is null then null else 'ai' end,
        updated_by = current_user_id,
        last_mutation_id = p_mutation_id,
        last_mutation_device_id = p_device_id,
        updated_at = timezone('utc', now())
    from validated_updates vu
    where li.id = vu.id
      and li.list_id = p_list_id
      and li.id = any(p_item_ids)
      and li.deleted_at is null
      and (li.category_source is null or li.category_source = 'ai')
    returning to_jsonb(li) as row
  )
  select coalesce(jsonb_agg(row), '[]'::jsonb)
  into updated_rows
  from updated;

  return updated_rows;
end;
$$;

grant execute on function public.create_list_category_with_session(uuid, uuid, text) to anon, authenticated;
grant execute on function public.update_list_category_with_session(uuid, uuid, text) to anon, authenticated;
grant execute on function public.delete_list_category_with_session(uuid, uuid) to anon, authenticated;
grant execute on function public.get_list_payload_by_session(uuid, text) to anon, authenticated;
grant execute on function public.update_list_item_category_with_session(uuid, uuid, text, text, text, uuid) to anon, authenticated;
grant execute on function public.bulk_update_list_item_categories_with_session(uuid, uuid, uuid[], jsonb, text, uuid) to anon, authenticated;
