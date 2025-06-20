-- Enable the pgvector extension to work with embeddings
create extension if not exists vector with schema extensions;

-- PROFILES TABLE
-- This table stores public profile information of users.
create table public.profiles (
  id uuid not null primary key,
  username text,
  constraint fk_user foreign key (id) references auth.users (id) on delete cascade
);

-- Add RLS policies for profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- GAMES TABLE
-- This table stores information about each chess game.
create table public.games (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null,
  white_player text check (white_player in ('user', 'ai')),
  black_player text check (black_player in ('user', 'ai')),
  result text check (result in ('checkmate', 'draw', 'resigned', 'stalemate', 'insufficient_material', 'threefold_repetition')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  pgn text,
  created_at timestamptz not null default now(),
  constraint fk_user foreign key (user_id) references auth.users (id) on delete cascade
);

-- Add RLS policies for games
alter table public.games enable row level security;
create policy "Users can view their own games." on public.games for select using (auth.uid() = user_id);
create policy "Users can create games." on public.games for insert with check (auth.uid() = user_id);
create policy "Users can update their own games." on public.games for update using (auth.uid() = user_id);
create policy "Users can delete their own games." on public.games for delete using (auth.uid() = user_id);


-- MOVE HISTORY TABLE
-- This table stores the sequence of moves for each game.
create table public.move_history (
  id bigserial primary key,
  game_id uuid not null,
  move_number integer not null,
  move text not null,
  fen_before text not null,
  fen_after text not null,
  explanation text,
  created_at timestamptz not null default now(),
  constraint fk_game foreign key (game_id) references public.games (id) on delete cascade
);

-- Add RLS policies for move_history
alter table public.move_history enable row level security;
-- Users can view moves for games they have access to. This relies on the RLS policy on the games table.
create policy "Users can view move history for their games." on public.move_history for select using (
  exists (
    select 1
    from public.games
    where games.id = move_history.game_id
  )
);
create policy "Users can insert moves for their games." on public.move_history for insert with check (
  exists (
    select 1
    from public.games
    where games.id = move_history.game_id and games.user_id = auth.uid()
  )
);


-- PUZZLES TABLE
-- This table stores puzzles, which can be generated from user games.
create table public.puzzles (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null,
  game_id uuid,
  fen text not null,
  solution text[] not null,
  theme text,
  attempts integer not null default 0,
  successes integer not null default 0,
  created_at timestamptz not null default now(),
  constraint fk_user foreign key (user_id) references auth.users (id) on delete cascade,
  constraint fk_game foreign key (game_id) references public.games (id) on delete set null
);

-- Add RLS policies for puzzles
alter table public.puzzles enable row level security;
create policy "Users can view their own puzzles." on public.puzzles for select using (auth.uid() = user_id);
create policy "Users can create puzzles." on public.puzzles for insert with check (auth.uid() = user_id);
create policy "Users can update their own puzzles." on public.puzzles for update using (auth.uid() = user_id);
create policy "Users can delete their own puzzles." on public.puzzles for delete using (auth.uid() = user_id);


-- USER PROGRESS TABLE
-- This table stores user progress metrics.
create table public.user_progress (
  user_id uuid not null primary key,
  rating integer not null default 1200,
  accuracy numeric(5, 2),
  blunder_rate numeric(5, 2),
  strengths jsonb,
  weaknesses jsonb,
  updated_at timestamptz not null default now(),
  constraint fk_user foreign key (user_id) references auth.users (id) on delete cascade
);

-- Add RLS policies for user_progress
alter table public.user_progress enable row level security;
create policy "Users can view their own progress." on public.user_progress for select using (auth.uid() = user_id);
create policy "Users can create their own progress record." on public.user_progress for insert with check (auth.uid() = user_id);
create policy "Users can update their own progress record." on public.user_progress for update using (auth.uid() = user_id);

-- Function to handle new user creation
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.email);
  insert into public.user_progress (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on new user sign up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
