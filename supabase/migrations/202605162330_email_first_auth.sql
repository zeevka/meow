alter table public.profiles
add column if not exists email text;

create index if not exists profiles_email_idx
on public.profiles (lower(email));

create or replace function public.lookup_auth_email(p_email text)
returns table (
  account_exists boolean,
  password_account boolean
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    exists(
      select 1
      from auth.users
      where lower(email) = lower(trim(p_email))
    ) as account_exists,
    exists(
      select 1
      from auth.users
      where lower(email) = lower(trim(p_email))
        and encrypted_password is not null
        and encrypted_password <> ''
    ) as password_account
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, full_name, avatar_url, locale)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    case
      when coalesce(new.raw_user_meta_data ->> 'locale', '') in ('en', 'he')
        then new.raw_user_meta_data ->> 'locale'
      else 'en'
    end
  )
  on conflict (id) do update
  set email = excluded.email,
      first_name = coalesce(excluded.first_name, public.profiles.first_name),
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

update public.profiles profile
set email = users.email
from auth.users users
where users.id = profile.id
  and (profile.email is distinct from users.email);

grant execute on function public.lookup_auth_email(text) to anon;
grant execute on function public.lookup_auth_email(text) to authenticated;

