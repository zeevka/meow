alter table public.list_categories
  add column if not exists color text not null default '#6b5b4b';

alter table public.list_categories
  drop constraint if exists list_categories_color_check;

alter table public.list_categories
  add constraint list_categories_color_check
  check (color ~ '^#[0-9a-f]{6}$');

update public.list_categories
set color = '#6b5b4b'
where color is null;

drop function if exists public.create_list_category_with_session(uuid, uuid, text);
drop function if exists public.update_list_category_with_session(uuid, uuid, text);

create or replace function public.create_list_category_with_session(
  p_session_token uuid,
  p_list_id uuid,
  p_label text,
  p_color text default null
)
returns public.list_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_label text;
  normalized_color text;
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

  normalized_color := lower(nullif(trim(coalesce(p_color, '')), ''));
  if normalized_color is null then
    normalized_color := '#6b5b4b';
  end if;

  if normalized_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Invalid color';
  end if;

  select coalesce(max(sort_index), -1) + 1 into next_sort
  from public.list_categories
  where list_id = p_list_id
    and deleted_at is null;

  insert into public.list_categories (list_id, label, color, sort_index)
  values (p_list_id, normalized_label, normalized_color, next_sort)
  returning * into created_row;

  return created_row;
end;
$$;

create or replace function public.update_list_category_with_session(
  p_session_token uuid,
  p_category_id uuid,
  p_label text default null,
  p_color text default null
)
returns public.list_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_label text;
  normalized_color text;
  updated_row public.list_categories;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  normalized_label := nullif(trim(coalesce(p_label, '')), '');
  if p_label is not null and normalized_label is null then
    raise exception 'Label is required';
  end if;

  if normalized_label is not null and char_length(normalized_label) > 32 then
    raise exception 'Label too long';
  end if;

  normalized_color := lower(nullif(trim(coalesce(p_color, '')), ''));
  if normalized_color is not null and normalized_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Invalid color';
  end if;

  update public.list_categories cat
  set label = coalesce(normalized_label, cat.label),
      color = coalesce(normalized_color, cat.color),
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

grant execute on function public.create_list_category_with_session(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.update_list_category_with_session(uuid, uuid, text, text) to anon, authenticated;
