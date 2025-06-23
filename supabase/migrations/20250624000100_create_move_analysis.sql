-- Create move_analysis table to store per-ply LLM + engine commentary
create table if not exists public.move_analysis (
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  move_number integer not null, -- 1-based ply index
  explanation text,            -- Natural-language commentary (LLM)
  best_move text,              -- Stockfish best move in UCI or SAN
  eval_cp integer,             -- Evaluation in centipawns from White POV
  mate_in integer,             -- Positive means mate in N moves for side to move
  created_at timestamptz not null default now(),
  constraint move_analysis_unique unique (game_id, move_number)
);

-- Enable RLS
alter table public.move_analysis enable row level security;

-- Policies: same visibility rules as move_history
create policy "Users can view analysis for their games." on public.move_analysis for select using (
  exists (select 1 from public.games where games.id = move_analysis.game_id and games.user_id = auth.uid())
);

create policy "Users can insert analysis for their games." on public.move_analysis for insert with check (
  exists (select 1 from public.games where games.id = move_analysis.game_id and games.user_id = auth.uid())
);

create policy "Users can update analysis for their games." on public.move_analysis for update using (
  exists (select 1 from public.games where games.id = move_analysis.game_id and games.user_id = auth.uid())
); 

-- delete explanation column from move_history
alter table public.move_history drop column explanation;