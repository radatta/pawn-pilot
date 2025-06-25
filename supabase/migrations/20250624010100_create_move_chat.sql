  -- Create a new table with JSON column for chat history
CREATE TABLE public.move_chat (
  id          bigserial primary key,
  game_id     uuid,                    -- NULL for live game chats
  move_number integer not null,        -- 1-based ply index
  messages    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz default now(),
  created_at  timestamptz default now(),
  constraint fk_game foreign key (game_id) references public.games(id) on delete cascade
);
-- Apply Row Level Security to the new table
ALTER TABLE public.move_chat ENABLE ROW LEVEL SECURITY;

-- Create policies for the new table
CREATE POLICY "Players read chat history" ON public.move_chat
  FOR SELECT USING (
    game_id IS NULL OR EXISTS(
      SELECT 1 FROM public.games
      WHERE games.id = move_chat.game_id AND games.user_id = auth.uid()
    )
  );

CREATE POLICY "Players write chat history" ON public.move_chat
  FOR INSERT WITH CHECK (
    game_id IS NULL OR EXISTS(
      SELECT 1 FROM public.games
      WHERE games.id = move_chat.game_id AND games.user_id = auth.uid()
    )
  );

CREATE POLICY "Players update chat history" ON public.move_chat
  FOR UPDATE USING (
    game_id IS NULL OR EXISTS(
      SELECT 1 FROM public.games
      WHERE games.id = move_chat.game_id AND games.user_id = auth.uid()
    )
  );

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_move_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update the updated_at timestamp
CREATE TRIGGER update_move_chat_updated_at
BEFORE UPDATE ON public.move_chat
FOR EACH ROW
EXECUTE FUNCTION update_move_chat_updated_at();
