# Task Tracker — 2-Player Online Game Platform

## Phase 1 — Project Setup
- [ ] Initialize Vite + React project
- [ ] Install dependencies (supabase, zustand, react-router-dom, tailwind)
- [ ] Set up project folder structure
- [ ] Create `.env.local` template

## Phase 2 — Supabase Setup
- [ ] Guide: Create Supabase project
- [ ] Run SQL schema migrations
- [ ] Set up RLS policies
- [ ] Enable Realtime on `game_states`
- [ ] Configure OAuth provider (GitHub)
- [ ] Create `lib/supabase.js` client

## Phase 3 — Auth & Routing
- [ ] `useAuth.js` hook
- [ ] `LoginPage.jsx` with OAuth button
- [ ] Protected route wrapper
- [ ] `App.jsx` with react-router routes

## Phase 4 — Lobby System
- [ ] `useGameRoom.js` hook
- [ ] `GameLobby.jsx` — create/join room UI
- [ ] Room waiting screen (Realtime room status)

## Phase 5 — Drop 4 Game
- [ ] `drop4Logic.js` — pure game logic (board, win detection)
- [ ] `Drop4Board.jsx` — visual board
- [ ] `Drop4Game.jsx` — game wrapper + Supabase integration
- [ ] `useRealtimeGame.js` — Realtime subscription hook
- [ ] `GameRouter.jsx` — routes by game_type

## Phase 6 — Polish & Deploy
- [ ] Responsive design & animations
- [ ] Netlify deployment guide
- [ ] Environment variable setup on Netlify
