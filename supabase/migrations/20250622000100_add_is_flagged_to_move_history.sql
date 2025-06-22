/* Adds is_flagged boolean column to move_history and partial index */

alter table public.move_history
  add column if not exists is_flagged boolean not null default false;

-- Partial index to accelerate queries for flagged moves per game
create index if not exists move_history_flagged_idx
  on public.move_history (game_id, move_number)
  where is_flagged;

-- Ensure only one row per game+ply
alter table public.move_history
  add constraint move_history_unique_ply unique (game_id, move_number); 

  -- Allow users to update is_flagged and other columns for their own games' moves
alter table public.move_history enable row level security; -- ensure RLS is on (no-op if already)

create policy "Users can update moves for their games." on public.move_history
  for update using (
    exists (
      select 1 from public.games
      where games.id = move_history.game_id
        and games.user_id = auth.uid()
    )
  ); 