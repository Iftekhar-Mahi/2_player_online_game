-- Add Snake & Ladder as a supported game type.
-- Keeps game_rooms.game_type constrained to known values.

DO $$
BEGIN
  -- Only run if the table/column exist (safe in dev/prod resets).
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'game_rooms'
      AND column_name = 'game_type'
  ) THEN
    ALTER TABLE public.game_rooms
      DROP CONSTRAINT IF EXISTS valid_game_type;

    ALTER TABLE public.game_rooms
      ADD CONSTRAINT valid_game_type
      CHECK (game_type IN ('drop4', 'snake_ladder'));
  END IF;
END
$$;
