create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

drop table if exists public.list_items cascade;
drop table if exists public.list_members cascade;
drop table if exists public.lists cascade;
drop table if exists public.profiles cascade;
drop table if exists public.app_sessions cascade;
drop table if exists public.app_users cascade;

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.app_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  revoked_at timestamptz
);

create table public.profiles (
  id uuid primary key references public.app_users(id) on delete cascade,
  email text not null unique,
  first_name text,
  full_name text,
  avatar_url text,
  locale text check (locale in ('en', 'he')) default 'en',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  share_slug text not null unique,
  is_link_sharing_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.list_members (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  joined_at timestamptz not null default timezone('utc', now()),
  added_via_link boolean not null default false,
  primary key (list_id, user_id)
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  normalized_name text not null,
  status text not null check (status in ('active', 'archived')) default 'active',
  sort_index numeric not null default 0,
  created_by uuid not null references public.app_users(id) on delete cascade,
  updated_by uuid references public.app_users(id) on delete set null,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_mutation_id uuid,
  last_mutation_device_id text
);

create index list_members_user_id_idx on public.list_members(user_id);
create index list_items_list_status_idx on public.list_items(list_id, status) where deleted_at is null;
create index list_items_list_normalized_idx on public.list_items(list_id, normalized_name);
create index list_items_normalized_trgm_idx on public.list_items using gin (normalized_name gin_trgm_ops);

create or replace function public.normalize_product_name(input text)
returns text
as $$
  select trim(regexp_replace(lower(regexp_replace(coalesce(input, ''), '[[:punct:]]+', ' ', 'g')), '\s+', ' ', 'g'));
$$
language sql
immutable;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_session_user(p_session_token uuid)
returns uuid
as $$
  select user_id
  from public.app_sessions
  where token = p_session_token
    and revoked_at is null
    and expires_at > timezone('utc', now())
  order by created_at desc
  limit 1;
$$
language sql
security definer
set search_path = public
stable;

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

create or replace function public.lookup_auth_email(p_email text)
returns table (
  account_exists boolean,
  password_account boolean
)
as $$
  select
    exists(
      select 1
      from public.app_users
      where lower(email) = lower(trim(p_email))
    ) as account_exists,
    exists(
      select 1
      from public.app_users
      where lower(email) = lower(trim(p_email))
        and password_hash <> ''
    ) as password_account;
$$
language sql
security definer
set search_path = public
stable;

create or replace function public.register_with_password(
  p_email text,
  p_password text,
  p_locale text default 'en'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  new_user public.app_users;
  new_session public.app_sessions;
  new_profile public.profiles;
begin
  normalized_email := lower(trim(p_email));

  if normalized_email = '' then
    raise exception 'Email is required';
  end if;

  if length(trim(p_password)) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  if exists (select 1 from public.app_users where email = normalized_email) then
    raise exception 'Account already exists';
  end if;

  insert into public.app_users (email, password_hash)
  values (normalized_email, extensions.crypt(p_password, extensions.gen_salt('bf')))
  returning * into new_user;

  insert into public.profiles (id, email, locale)
  values (
    new_user.id,
    new_user.email,
    case when p_locale in ('en', 'he') then p_locale else 'en' end
  )
  returning * into new_profile;

  insert into public.app_sessions (user_id)
  values (new_user.id)
  returning * into new_session;

  return jsonb_build_object(
    'session_token', new_session.token,
    'viewer', jsonb_build_object(
      'id', new_user.id,
      'email', new_user.email
    ),
    'profile', to_jsonb(new_profile)
  );
end;
$$;

create or replace function public.login_with_password(
  p_email text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  found_user public.app_users;
  found_profile public.profiles;
  new_session public.app_sessions;
begin
  normalized_email := lower(trim(p_email));

  select *
  into found_user
  from public.app_users
  where email = normalized_email;

  if found_user.id is null then
    raise exception 'Invalid email or password';
  end if;

  if found_user.password_hash <> extensions.crypt(p_password, found_user.password_hash) then
    raise exception 'Invalid email or password';
  end if;

  select *
  into found_profile
  from public.profiles
  where id = found_user.id;

  insert into public.app_sessions (user_id)
  values (found_user.id)
  returning * into new_session;

  return jsonb_build_object(
    'session_token', new_session.token,
    'viewer', jsonb_build_object(
      'id', found_user.id,
      'email', found_user.email
    ),
    'profile', to_jsonb(found_profile)
  );
end;
$$;

create or replace function public.sign_out_session(p_session_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_sessions
  set revoked_at = timezone('utc', now())
  where token = p_session_token
    and revoked_at is null;

  return true;
end;
$$;

create or replace function public.get_viewer_by_session(p_session_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_profile public.profiles;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    return null;
  end if;

  select *
  into current_profile
  from public.profiles
  where id = current_user_id;

  return jsonb_build_object(
    'id', current_user_id,
    'email', current_profile.email,
    'profile', to_jsonb(current_profile)
  );
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

create or replace function public.ensure_list_access(
  p_session_token uuid,
  p_share_slug text
)
returns public.lists
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  target_list public.lists;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into target_list
  from public.lists
  where share_slug = p_share_slug;

  if target_list.id is null then
    raise exception 'List not found';
  end if;

  if not exists (
    select 1
    from public.list_members
    where list_id = target_list.id
      and user_id = current_user_id
  ) then
    if not target_list.is_link_sharing_enabled then
      raise exception 'Not allowed';
    end if;

    insert into public.list_members (list_id, user_id, role, added_via_link)
    values (target_list.id, current_user_id, 'editor', true)
    on conflict (list_id, user_id) do nothing;
  end if;

  return target_list;
end;
$$;

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
    ), '[]'::jsonb)
  )
  into payload
  from public.profiles viewer
  where viewer.id = current_user_id;

  return payload;
end;
$$;

create or replace function public.create_list_with_session(
  p_session_token uuid,
  p_title text,
  p_locale text default null
)
returns public.lists
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  created_list public.lists;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  insert into public.lists (owner_user_id, title, share_slug)
  values (current_user_id, trim(p_title), public.generate_share_slug())
  returning * into created_list;

  insert into public.list_members (list_id, user_id, role, added_via_link)
  values (created_list.id, current_user_id, 'owner', false);

  if p_locale in ('en', 'he') then
    update public.profiles
    set locale = p_locale
    where id = current_user_id;
  end if;

  return created_list;
end;
$$;

create or replace function public.rename_list_with_session(
  p_session_token uuid,
  p_list_id uuid,
  p_title text
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
  set title = trim(p_title),
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

create or replace function public.update_profile_locale_with_session(
  p_session_token uuid,
  p_locale text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_profile public.profiles;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.profiles
  set locale = case when p_locale in ('en', 'he') then p_locale else locale end
  where id = current_user_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create or replace function public.add_list_item_with_session(
  p_session_token uuid,
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
  current_user_id uuid;
  created_item public.list_items;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = current_user_id
  ) then
    raise exception 'Not allowed';
  end if;

  insert into public.list_items (
    id, list_id, name, normalized_name, status, sort_index,
    created_by, updated_by, last_mutation_id, last_mutation_device_id
  )
  values (
    p_item_id, p_list_id, trim(p_name), public.normalize_product_name(p_name), 'active', p_sort_index,
    current_user_id, current_user_id, p_mutation_id, p_device_id
  )
  returning * into created_item;

  update public.lists set updated_at = timezone('utc', now()) where id = p_list_id;

  return created_item;
end;
$$;

create or replace function public.update_list_item_name_with_session(
  p_session_token uuid,
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
  current_user_id uuid;
  updated_item public.list_items;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.list_items
  set name = trim(p_name),
      normalized_name = public.normalize_product_name(p_name),
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

create or replace function public.archive_list_item_with_session(
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
  archived_item public.list_items;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.list_items
  set status = 'archived',
      archived_at = timezone('utc', now()),
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
  returning * into archived_item;

  return archived_item;
end;
$$;

create or replace function public.restore_archived_item_with_session(
  p_session_token uuid,
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
  current_user_id uuid;
  restored_item public.list_items;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.list_items
  set status = 'active',
      archived_at = null,
      sort_index = p_sort_index,
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
  returning * into restored_item;

  return restored_item;
end;
$$;

create or replace function public.delete_list_item_with_session(
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
  removed_item public.list_items;
begin
  current_user_id := public.current_session_user(p_session_token);

  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.list_items
  set deleted_at = timezone('utc', now()),
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

alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_members;
alter publication supabase_realtime add table public.list_items;

grant execute on function public.lookup_auth_email(text) to anon, authenticated;
grant execute on function public.register_with_password(text, text, text) to anon, authenticated;
grant execute on function public.login_with_password(text, text) to anon, authenticated;
grant execute on function public.sign_out_session(uuid) to anon, authenticated;
grant execute on function public.get_viewer_by_session(uuid) to anon, authenticated;
grant execute on function public.get_dashboard_by_session(uuid) to anon, authenticated;
grant execute on function public.get_list_payload_by_session(uuid, text) to anon, authenticated;
grant execute on function public.create_list_with_session(uuid, text, text) to anon, authenticated;
grant execute on function public.rename_list_with_session(uuid, uuid, text) to anon, authenticated;
grant execute on function public.update_profile_locale_with_session(uuid, text) to anon, authenticated;
grant execute on function public.add_list_item_with_session(uuid, uuid, uuid, text, numeric, text, uuid) to anon, authenticated;
grant execute on function public.update_list_item_name_with_session(uuid, uuid, text, text, uuid) to anon, authenticated;
grant execute on function public.archive_list_item_with_session(uuid, uuid, text, uuid) to anon, authenticated;
grant execute on function public.restore_archived_item_with_session(uuid, uuid, numeric, text, uuid) to anon, authenticated;
grant execute on function public.delete_list_item_with_session(uuid, uuid, text, uuid) to anon, authenticated;
