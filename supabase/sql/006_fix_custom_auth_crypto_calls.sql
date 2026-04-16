create extension if not exists "pgcrypto" with schema extensions;

create or replace function public.app_register(
  p_email text,
  p_username text,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_email text := lower(trim(p_email));
  normalized_username text := lower(trim(p_username));
begin
  if normalized_email is null or normalized_email = '' then
    raise exception 'Email is required.';
  end if;

  if normalized_username is null or normalized_username = '' then
    raise exception 'Username is required.';
  end if;

  if normalized_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters and contain only lowercase letters, numbers, or underscores.';
  end if;

  if char_length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  if exists (select 1 from public.profiles where lower(email) = normalized_email) then
    raise exception 'Email already registered.';
  end if;

  if exists (select 1 from public.profiles where lower(username) = normalized_username) then
    raise exception 'The username "%" is already taken.', normalized_username;
  end if;

  insert into public.profiles (email, username, password_hash)
  values (
    normalized_email,
    normalized_username,
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  );
end;
$$;

create or replace function public.app_login(
  p_email text,
  p_password text
)
returns table (
  token text,
  user_id uuid,
  email text,
  username text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_user public.profiles%rowtype;
  raw_token text;
  hashed_token text;
begin
  select *
  into target_user
  from public.profiles
  where lower(public.profiles.email) = lower(trim(p_email));

  if target_user.id is null then
    raise exception 'Invalid email or password.';
  end if;

  if extensions.crypt(p_password, target_user.password_hash) <> target_user.password_hash then
    raise exception 'Invalid email or password.';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  hashed_token := encode(extensions.digest(raw_token, 'sha256'), 'hex');

  insert into public.app_sessions (user_id, token_hash, expires_at)
  values (target_user.id, hashed_token, now() + interval '30 days');

  return query
  select
    raw_token,
    target_user.id,
    target_user.email,
    target_user.username;
end;
$$;

create or replace function public.app_validate_session(
  p_token text
)
returns table (
  user_id uuid,
  email text,
  username text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  hashed_token text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  update public.app_sessions
  set last_seen_at = now()
  where token_hash = hashed_token
    and expires_at > now();

  return query
  select
    p.id,
    p.email,
    p.username
  from public.app_sessions s
  join public.profiles p on p.id = s.user_id
  where s.token_hash = hashed_token
    and s.expires_at > now();
end;
$$;

create or replace function public.app_logout(
  p_token text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.app_sessions
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
end;
$$;
