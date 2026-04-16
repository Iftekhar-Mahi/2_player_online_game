drop table if exists public.game_scores cascade;
drop table if exists public.game_states cascade;
drop table if exists public.game_rooms cascade;

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

alter table public.game_rooms enable row level security;
alter table public.game_states enable row level security;
alter table public.game_scores enable row level security;

drop policy if exists "game_rooms_authenticated_all" on public.game_rooms;
create policy "game_rooms_authenticated_all"
on public.game_rooms
for all
to authenticated
using (true)
with check (true);

drop policy if exists "game_states_authenticated_all" on public.game_states;
create policy "game_states_authenticated_all"
on public.game_states
for all
to authenticated
using (true)
with check (true);

drop policy if exists "game_scores_authenticated_all" on public.game_scores;
create policy "game_scores_authenticated_all"
on public.game_scores
for all
to authenticated
using (true)
with check (true);

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
