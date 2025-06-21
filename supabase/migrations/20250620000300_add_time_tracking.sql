-- Add time tracking columns to games table
ALTER TABLE public.games 
ADD COLUMN time_control integer NOT NULL DEFAULT 300, -- 5 minutes in seconds
ADD COLUMN white_time_remaining integer NOT NULL DEFAULT 300,
ADD COLUMN black_time_remaining integer NOT NULL DEFAULT 300,
ADD COLUMN increment integer NOT NULL DEFAULT 0, -- increment in seconds
ADD COLUMN last_move_timestamp timestamptz,
ADD COLUMN IF NOT EXISTS clock_history jsonb DEFAULT '[]'::jsonb;