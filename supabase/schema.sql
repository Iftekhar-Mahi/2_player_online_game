-- Simplified Schema for prototyping without Auth

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS game_scores CASCADE;
DROP TABLE IF EXISTS game_states CASCADE;
DROP TABLE IF EXISTS game_rooms CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
  id          TEXT PRIMARY KEY, -- 'player1' or 'player2'
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  game_type    TEXT NOT NULL DEFAULT 'drop4', 
  host_id      TEXT REFERENCES profiles(id),
  guest_id     TEXT REFERENCES profiles(id),
  status       TEXT NOT NULL DEFAULT 'waiting', -- 'waiting' | 'active' | 'finished'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_states (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID UNIQUE REFERENCES game_rooms(id) ON DELETE CASCADE,
  current_board  JSONB NOT NULL DEFAULT '[]', 
  current_turn   TEXT REFERENCES profiles(id),
  winner_id      TEXT REFERENCES profiles(id),
  move_history   JSONB NOT NULL DEFAULT '[]',
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   TEXT REFERENCES profiles(id),
  game_type   TEXT NOT NULL,
  result      TEXT NOT NULL,
  played_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Allow all operations since we're bypassing auth for now
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on game_rooms" ON game_rooms FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on game_states" ON game_states FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on game_scores" ON game_scores FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
alter publication supabase_realtime add table game_states;
alter publication supabase_realtime add table game_rooms;

-- Insert the hardcoded profiles
INSERT INTO profiles (id, username) VALUES 
  ('player1', 'Player One'),
  ('player2', 'Player Two')
ON CONFLICT (id) DO NOTHING;
