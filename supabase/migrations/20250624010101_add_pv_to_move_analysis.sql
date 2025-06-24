-- Add pv (principal variation) column to move_analysis table
alter table public.move_analysis add column if not exists pv text; 