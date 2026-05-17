alter table public.list_items
  add column if not exists category text
    check (category is null or category in (
      'dairy','produce','bakery','meat','pantry',
      'drinks','frozen','household','personal_care','snacks','other'
    )),
  add column if not exists custom_category_label text
    check (custom_category_label is null or char_length(custom_category_label) <= 24),
  add column if not exists category_source text
    check (category_source in ('ai', 'manual'));

create index if not exists list_items_list_category_idx
  on public.list_items (list_id, category)
  where deleted_at is null;

drop function if exists public.update_list_item_category_with_session(uuid, uuid, text, text, text, text, uuid);

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
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  normalized_category := nullif(trim(coalesce(p_category, '')), '');
  normalized_custom_label := nullif(trim(coalesce(p_custom_label, '')), '');

  if normalized_category is not null and normalized_category not in (
    'dairy','produce','bakery','meat','pantry',
    'drinks','frozen','household','personal_care','snacks','other'
  ) then
    raise exception 'Invalid category';
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
        when nu.category in (
          'dairy','produce','bakery','meat','pantry',
          'drinks','frozen','household','personal_care','snacks','other'
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
        category_source = 'ai',
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

grant execute on function public.update_list_item_category_with_session(uuid, uuid, text, text, text, uuid) to anon, authenticated;
grant execute on function public.bulk_update_list_item_categories_with_session(uuid, uuid, uuid[], jsonb, text, uuid) to anon, authenticated;
