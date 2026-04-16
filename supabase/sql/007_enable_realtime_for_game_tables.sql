-- Ensure game tables are included in Supabase Realtime publication.
-- This is required after migrations that DROP/CREATE the tables (e.g. custom auth reset).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_states;
  END IF;
END
$$;
