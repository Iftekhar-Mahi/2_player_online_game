-- Add Checkers as a supported game type.

DO $$
BEGIN
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
      CHECK (game_type IN ('drop4', 'snake_ladder', 'checkers'));
  END IF;
END
$$;
