create or replace function public.register_with_password(
  p_email text,
  p_password text,
  p_locale text default 'en',
  p_first_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  clean_first_name text;
  new_user public.app_users;
  new_session public.app_sessions;
  new_profile public.profiles;
begin
  normalized_email := lower(trim(p_email));
  clean_first_name := nullif(trim(coalesce(p_first_name, '')), '');

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

  insert into public.profiles (id, email, first_name, full_name, locale)
  values (
    new_user.id,
    new_user.email,
    clean_first_name,
    clean_first_name,
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

grant execute on function public.register_with_password(text, text, text, text) to anon, authenticated;

