-- Add clock history column to games table
ALTER TABLE public.games ADD COLUMN clock_history jsonb DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.games.clock_history IS 'Array of objects storing time remaining after each ply: [{white: seconds, black: seconds}]'; 