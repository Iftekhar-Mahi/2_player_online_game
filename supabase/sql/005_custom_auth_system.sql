create extension if not exists "pgcrypto" with schema extensions;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop function if exists public.app_register(text, text, text);
drop function if exists public.app_login(text, text);
drop function if exists public.app_validate_session(text);
drop function if exists public.app_logout(text);

drop table if exists public.app_sessions cascade;
drop table if exists public.game_scores cascade;
drop table if exists public.game_states cascade;
drop table if exists public.game_rooms cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text not null,
  password_hash text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_length check (char_length(username) between 3 and 24),
  constraint username_format check (username ~ '^[a-z0-9_]{3,24}$')
);

create unique index profiles_username_lower_idx
on public.profiles (lower(username));

create table public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  game_type text not null default 'drop4',
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid references public.profiles(id) on delete set null,
  status text not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_room_status check (status in ('waiting', 'active', 'finished'))
);

create table public.game_states (
  id uuid primary key default gen_random_uuid(),
  room_id uuid unique not null references public.game_rooms(id) on delete cascade,
  current_board jsonb not null default '[]'::jsonb,
  current_turn uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  move_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  game_type text not null,
  result text not null,
  played_at timestamptz not null default now()
);

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

grant execute on function public.app_register(text, text, text) to anon, authenticated;
grant execute on function public.app_login(text, text) to anon, authenticated;
grant execute on function public.app_validate_session(text) to anon, authenticated;
grant execute on function public.app_logout(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.game_rooms enable row level security;
alter table public.game_states enable row level security;
alter table public.game_scores enable row level security;
alter table public.app_sessions enable row level security;

drop policy if exists "profiles_public_select" on public.profiles;
create policy "profiles_public_select"
on public.profiles
for select
to public
using (true);

drop policy if exists "profiles_public_insert" on public.profiles;
create policy "profiles_public_insert"
on public.profiles
for insert
to public
with check (true);

drop policy if exists "profiles_public_update" on public.profiles;
create policy "profiles_public_update"
on public.profiles
for update
to public
using (true)
with check (true);

drop policy if exists "game_rooms_public_all" on public.game_rooms;
create policy "game_rooms_public_all"
on public.game_rooms
for all
to public
using (true)
with check (true);

drop policy if exists "game_states_public_all" on public.game_states;
create policy "game_states_public_all"
on public.game_states
for all
to public
using (true)
with check (true);

drop policy if exists "game_scores_public_all" on public.game_scores;
create policy "game_scores_public_all"
on public.game_scores
for all
to public
using (true)
with check (true);

revoke all on public.app_sessions from anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_rooms'
  ) then
    alter publication supabase_realtime add table public.game_rooms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_states'
  ) then
    alter publication supabase_realtime add table public.game_states;
  end if;
end
$$;
