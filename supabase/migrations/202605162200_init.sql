create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.normalize_product_name(input text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(regexp_replace(coalesce(input, ''), '[[:punct:]]+', ' ', 'g')), '\s+', ' ', 'g'));
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_list_member(target_list_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.list_members
    where list_id = target_list_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.shares_list_with(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.list_members my_membership
    join public.list_members shared_membership
      on shared_membership.list_id = my_membership.list_id
    where my_membership.user_id = auth.uid()
      and shared_membership.user_id = target_user_id
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  full_name text,
  avatar_url text,
  locale text check (locale in ('en', 'he')) default 'en',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  share_slug text not null unique,
  is_link_sharing_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.list_members (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  joined_at timestamptz not null default timezone('utc', now()),
  added_via_link boolean not null default false,
  primary key (list_id, user_id)
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  normalized_name text not null,
  status text not null check (status in ('active', 'archived')) default 'active',
  sort_index numeric not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_mutation_id uuid,
  last_mutation_device_id text
);

create index if not exists list_members_user_id_idx on public.list_members(user_id);
create index if not exists list_items_list_status_idx on public.list_items(list_id, status) where deleted_at is null;
create index if not exists list_items_list_normalized_idx on public.list_items(list_id, normalized_name);
create index if not exists list_items_normalized_trgm_idx on public.list_items using gin (normalized_name gin_trgm_ops);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, full_name, avatar_url, locale)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    case
      when coalesce(new.raw_user_meta_data ->> 'locale', '') in ('en', 'he')
        then new.raw_user_meta_data ->> 'locale'
      else 'en'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.generate_share_slug()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    exit when not exists (select 1 from public.lists where share_slug = candidate);
  end loop;

  return candidate;
end;
$$;

create or replace function public.create_list(p_title text, p_locale text default null)
returns public.lists
language plpgsql
security definer
set search_path = public
as $$
declare
  created_list public.lists;
begin
  insert into public.lists (owner_user_id, title, share_slug)
  values (auth.uid(), trim(p_title), public.generate_share_slug())
  returning * into created_list;

  insert into public.list_members (list_id, user_id, role, added_via_link)
  values (created_list.id, auth.uid(), 'owner', false)
  on conflict do nothing;

  if p_locale in ('en', 'he') then
    update public.profiles
    set locale = p_locale
    where id = auth.uid();
  end if;

  return created_list;
end;
$$;

create or replace function public.rename_list(p_list_id uuid, p_title text)
returns public.lists
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_list public.lists;
begin
  update public.lists
  set title = trim(p_title),
      updated_at = timezone('utc', now())
  where id = p_list_id
    and exists (
      select 1
      from public.list_members
      where list_id = p_list_id
        and user_id = auth.uid()
    )
  returning * into updated_list;

  return updated_list;
end;
$$;

create or replace function public.join_list_by_slug(p_share_slug text)
returns public.lists
language plpgsql
security definer
set search_path = public
as $$
declare
  target_list public.lists;
begin
  select *
  into target_list
  from public.lists
  where share_slug = p_share_slug;

  if target_list.id is null then
    raise exception 'List not found';
  end if;

  if not target_list.is_link_sharing_enabled then
    if not exists (
      select 1 from public.list_members
      where list_id = target_list.id and user_id = auth.uid()
    ) then
      raise exception 'Link sharing disabled';
    end if;
  end if;

  insert into public.list_members (list_id, user_id, role, added_via_link)
  values (target_list.id, auth.uid(), 'editor', true)
  on conflict (list_id, user_id) do nothing;

  return target_list;
end;
$$;

create or replace function public.add_list_item(
  p_list_id uuid,
  p_item_id uuid,
  p_name text,
  p_sort_index numeric,
  p_device_id text,
  p_mutation_id uuid
)
returns public.list_items
language plpgsql
security definer
set search_path = public
as $$
declare
  created_item public.list_items;
begin
  if not exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  insert into public.list_items (
    id,
    list_id,
    name,
    normalized_name,
    status,
    sort_index,
    created_by,
    updated_by,
    last_mutation_id,
    last_mutation_device_id
  )
  values (
    p_item_id,
    p_list_id,
    trim(p_name),
    public.normalize_product_name(p_name),
    'active',
    p_sort_index,
    auth.uid(),
    auth.uid(),
    p_mutation_id,
    p_device_id
  )
  returning * into created_item;

  update public.lists
  set updated_at = timezone('utc', now())
  where id = p_list_id;

  return created_item;
end;
$$;

create or replace function public.update_list_item_name(
  p_item_id uuid,
  p_name text,
  p_device_id text,
  p_mutation_id uuid
)
returns public.list_items
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_item public.list_items;
begin
  update public.list_items
  set name = trim(p_name),
      normalized_name = public.normalize_product_name(p_name),
      updated_by = auth.uid(),
      last_mutation_id = p_mutation_id,
      last_mutation_device_id = p_device_id,
      updated_at = timezone('utc', now())
  where id = p_item_id
    and deleted_at is null
    and exists (
      select 1
      from public.list_members member
      where member.list_id = public.list_items.list_id
        and member.user_id = auth.uid()
    )
  returning * into updated_item;

  return updated_item;
end;
$$;

create or replace function public.archive_list_item(
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
  archived_item public.list_items;
begin
  update public.list_items
  set status = 'archived',
      archived_at = timezone('utc', now()),
      updated_by = auth.uid(),
      last_mutation_id = p_mutation_id,
      last_mutation_device_id = p_device_id,
      updated_at = timezone('utc', now())
  where id = p_item_id
    and deleted_at is null
    and exists (
      select 1
      from public.list_members member
      where member.list_id = public.list_items.list_id
        and member.user_id = auth.uid()
    )
  returning * into archived_item;

  return archived_item;
end;
$$;

create or replace function public.restore_archived_item(
  p_item_id uuid,
  p_sort_index numeric,
  p_device_id text,
  p_mutation_id uuid
)
returns public.list_items
language plpgsql
security definer
set search_path = public
as $$
declare
  restored_item public.list_items;
begin
  update public.list_items
  set status = 'active',
      archived_at = null,
      sort_index = p_sort_index,
      updated_by = auth.uid(),
      last_mutation_id = p_mutation_id,
      last_mutation_device_id = p_device_id,
      updated_at = timezone('utc', now())
  where id = p_item_id
    and deleted_at is null
    and exists (
      select 1
      from public.list_members member
      where member.list_id = public.list_items.list_id
        and member.user_id = auth.uid()
    )
  returning * into restored_item;

  return restored_item;
end;
$$;

create or replace function public.delete_list_item(
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
  removed_item public.list_items;
begin
  update public.list_items
  set deleted_at = timezone('utc', now()),
      updated_by = auth.uid(),
      last_mutation_id = p_mutation_id,
      last_mutation_device_id = p_device_id,
      updated_at = timezone('utc', now())
  where id = p_item_id
    and deleted_at is null
    and exists (
      select 1
      from public.list_members member
      where member.list_id = public.list_items.list_id
        and member.user_id = auth.uid()
    )
  returning * into removed_item;

  return removed_item;
end;
$$;

drop trigger if exists touch_lists_updated_at on public.lists;
create trigger touch_lists_updated_at
before update on public.lists
for each row execute function public.touch_updated_at();

drop trigger if exists touch_list_items_updated_at on public.list_items;
create trigger touch_list_items_updated_at
before update on public.list_items
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "profiles_select_own_or_shared" on public.profiles;
create policy "profiles_select_own_or_shared"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.shares_list_with(id)
);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "lists_member_access" on public.lists;
create policy "lists_member_access"
on public.lists
for select
to authenticated
using (
  public.is_list_member(id)
);

drop policy if exists "lists_member_update" on public.lists;
create policy "lists_member_update"
on public.lists
for update
to authenticated
using (
  public.is_list_member(id)
)
with check (
  public.is_list_member(id)
);

drop policy if exists "list_members_shared_access" on public.list_members;
create policy "list_members_shared_access"
on public.list_members
for select
to authenticated
using (
  public.is_list_member(list_id)
);

drop policy if exists "list_items_member_select" on public.list_items;
create policy "list_items_member_select"
on public.list_items
for select
to authenticated
using (
  public.is_list_member(list_id)
);

drop policy if exists "list_items_member_insert" on public.list_items;
create policy "list_items_member_insert"
on public.list_items
for insert
to authenticated
with check (
  public.is_list_member(list_id)
);

drop policy if exists "list_items_member_update" on public.list_items;
create policy "list_items_member_update"
on public.list_items
for update
to authenticated
using (
  public.is_list_member(list_id)
)
with check (
  public.is_list_member(list_id)
);

grant execute on function public.create_list(text, text) to authenticated;
grant execute on function public.rename_list(uuid, text) to authenticated;
grant execute on function public.join_list_by_slug(text) to authenticated;
grant execute on function public.add_list_item(uuid, uuid, text, numeric, text, uuid) to authenticated;
grant execute on function public.update_list_item_name(uuid, text, text, uuid) to authenticated;
grant execute on function public.archive_list_item(uuid, text, uuid) to authenticated;
grant execute on function public.restore_archived_item(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.delete_list_item(uuid, text, uuid) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.shares_list_with(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lists'
  ) then
    alter publication supabase_realtime add table public.lists;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'list_members'
  ) then
    alter publication supabase_realtime add table public.list_members;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'list_items'
  ) then
    alter publication supabase_realtime add table public.list_items;
  end if;
end;
$$;
