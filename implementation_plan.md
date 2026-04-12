# 2-Player Online Game Platform — Architecture & Implementation Plan

## Overview

A real-time 2-player online gaming platform starting with **Drop 4** (Connect Four), built entirely on free-tier services. The system is designed to be **extendable** — adding new games requires minimal changes.

---

## Stack Recommendation ✅

Your instincts are mostly right. Here's the refined stack:

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | **React + Vite** | Web-native, component-based, great for games. Pygame is for desktop, NOT web — avoid it. |
| **Styling** | Tailwind CSS | Rapid UI dev, purged in production = tiny bundle |
| **BaaS / DB** | **Supabase** | Realtime websockets, Auth, PostgreSQL — perfect for turn-based multiplayer |
| **Real-time** | **Supabase Realtime** | Built-in — no separate WebSocket server needed |
| **Auth** | **Supabase Auth + OAuth** | GitHub / Google OAuth, free, zero backend |
| **Deployment** | **Netlify** (frontend) | Free tier, instant deploys from GitHub |
| **State Mgmt** | **Zustand** | Lightweight, perfect for game state |

> [!IMPORTANT]
> **No backend server needed.** Supabase acts as your entire backend — database, real-time engine, and auth server. The React app communicates directly with Supabase via the JS SDK.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  PLAYER A (Browser)                  │
│  React + Vite App (Netlify)                         │
│  - Drop4Board component                             │
│  - Game Lobby / Room Management                     │
│  - Auth via Supabase OAuth                          │
└──────────────┬──────────────────────────────────────┘
               │  Supabase JS Client (REST + Realtime)
               ▼
┌─────────────────────────────────────────────────────┐
│                    SUPABASE                          │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Auth       │  │  PostgreSQL  │  │ Realtime  │  │
│  │  (OAuth)    │  │  Database    │  │ Channels  │  │
│  └─────────────┘  └──────────────┘  └───────────┘  │
│                                                     │
└──────────────┬──────────────────────────────────────┘
               │  Supabase JS Client (REST + Realtime)
               ▼
┌─────────────────────────────────────────────────────┐
│                  PLAYER B (Browser)                  │
│  React + Vite App (Netlify)                         │
└─────────────────────────────────────────────────────┘
```

---

## Database Schema (Supabase / PostgreSQL)

### Table: `profiles`
Extends Supabase's built-in `auth.users`.

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `game_rooms`
A "lobby" where two players meet.

```sql
CREATE TABLE game_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,          -- short shareable room code e.g. "X7K2"
  game_type    TEXT NOT NULL DEFAULT 'drop4', -- extendable: 'chess', 'tictactoe', etc.
  host_id      UUID REFERENCES profiles(id),
  guest_id     UUID REFERENCES profiles(id),
  status       TEXT NOT NULL DEFAULT 'waiting', -- 'waiting' | 'active' | 'finished'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `game_states`
Stores the live game state (board, turn, winner).

```sql
CREATE TABLE game_states (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID UNIQUE REFERENCES game_rooms(id) ON DELETE CASCADE,
  current_board  JSONB NOT NULL DEFAULT '[]', -- serialized board state
  current_turn   UUID REFERENCES profiles(id), -- whose turn it is
  winner_id      UUID REFERENCES profiles(id), -- null until game ends
  move_history   JSONB NOT NULL DEFAULT '[]',  -- array of moves for replay
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `game_scores` (optional, for future leaderboard)

```sql
CREATE TABLE game_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID REFERENCES profiles(id),
  game_type   TEXT NOT NULL,
  result      TEXT NOT NULL, -- 'win' | 'loss' | 'draw'
  played_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Row-Level Security (RLS) Policies

```sql
-- Profiles: anyone can read, only owner can update
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Game rooms: participants can read/update their room
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room participants" ON game_rooms
  FOR ALL USING (auth.uid() = host_id OR auth.uid() = guest_id OR status = 'waiting');

-- Game states: room participants only
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game state access" ON game_states
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM game_rooms r
      WHERE r.id = room_id
      AND (r.host_id = auth.uid() OR r.guest_id = auth.uid())
    )
  );
```

---

## Real-Time Flow (How Multiplayer Works)

Supabase Realtime uses PostgreSQL replication slots under the hood:

```
Player A makes a move
    → Writes new board state to `game_states` table
         → Supabase Realtime broadcasts change to all subscribers
              → Player B's React app receives the update instantly
                   → Board re-renders with the new state
```

Both players subscribe to:
```js
supabase
  .channel(`room:${roomId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'game_states',
    filter: `room_id=eq.${roomId}`
  }, (payload) => updateBoard(payload.new))
  .subscribe()
```

---

## Project File Structure

```
2_player_online_game/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginPage.jsx
│   │   ├── lobby/
│   │   │   ├── GameLobby.jsx        # Create/join rooms
│   │   │   └── RoomCard.jsx
│   │   └── games/
│   │       ├── GameRouter.jsx       # Routes to correct game component
│   │       ├── drop4/
│   │       │   ├── Drop4Game.jsx    # Main game wrapper
│   │       │   ├── Drop4Board.jsx   # Visual board rendering
│   │       │   └── drop4Logic.js   # Pure game logic (win detection, etc.)
│   │       └── (future games here)
│   ├── hooks/
│   │   ├── useAuth.js              # Auth state hook
│   │   ├── useGameRoom.js          # Room creation/joining
│   │   └── useRealtimeGame.js      # Supabase Realtime subscription
│   ├── lib/
│   │   └── supabase.js             # Supabase client init
│   ├── store/
│   │   └── gameStore.js            # Zustand global state
│   ├── App.jsx
│   └── main.jsx
├── .env.local                       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── index.html
├── vite.config.js
└── package.json
```

> [!NOTE]
> The `games/` folder is the **extension point**. To add a new game (e.g., Chess), just add a new subfolder with its own component and logic file. The `GameRouter.jsx` dispatches to the right game based on `game_type` from the database.

---

## Implementation Phases

### Phase 1 — Project Setup
1. Create Vite + React project
2. Install dependencies (`@supabase/supabase-js`, `zustand`, `react-router-dom`, `tailwindcss`)
3. Set up Supabase project (free tier)
4. Configure OAuth providers (GitHub recommended — easiest setup)

### Phase 2 — Database & Auth
1. Run SQL migrations in Supabase Dashboard
2. Set up RLS policies
3. Enable Realtime on `game_states` table
4. Implement OAuth login flow in React

### Phase 3 — Lobby System
1. Create/join room by 6-character code
2. Waiting screen while second player joins
3. Realtime room status updates

### Phase 4 — Drop 4 Game
1. 7×6 board rendering
2. Column-drop logic with gravity
3. Win detection (horizontal, vertical, diagonal)
4. Turn management via Supabase
5. Game over / rematch flow

### Phase 5 — Polish & Deploy
1. Responsive design
2. Netlify deployment with env vars
3. Custom domain (optional)

---

## Free Tier Limits (What You Get)

| Service | Free Limit | Your Usage |
|---|---|---|
| Supabase DB | 500 MB | Tiny (game states are KBs) |
| Supabase Realtime | 200 concurrent connections | More than enough |
| Supabase Auth | Unlimited MAU | ✅ |
| Netlify | 100 GB bandwidth/month | ✅ |
| Netlify builds | 300 min/month | ✅ |

> [!TIP]
> Supabase free tier pauses after 1 week of inactivity. Use a free uptime monitor (e.g., UptimeRobot) to ping it, or upgrade to their $25/mo Pro plan when you go serious.

---

## Open Questions

> [!IMPORTANT]
> **Which OAuth provider do you prefer?**
> - **GitHub OAuth** — Easiest to set up (5 min), developer-friendly
> - **Google OAuth** — More familiar to general users, requires Google Cloud Console setup
> - **Both** — Can support multiple providers

> [!IMPORTANT]
> **Do you want a shareable room link or a room code?**
> - **Room code** (e.g., `ABC123`) — Player shares the code verbally/via chat
> - **Shareable link** (e.g., `yourgame.netlify.app/join/ABC123`) — Clicking the link auto-joins

---

## Verification Plan

### Local Testing
- Run `npm run dev` and open two browser tabs (different sessions) to simulate 2 players
- Verify Realtime updates propagate in <500ms between tabs

### Deployment
- Push to GitHub → Netlify auto-deploys
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify env vars
