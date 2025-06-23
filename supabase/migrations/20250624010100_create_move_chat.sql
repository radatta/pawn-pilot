create table public.move_chat (
  id          bigserial primary key,
  game_id     uuid,                    -- NULL for live game chats
  move_number integer not null,        -- 1-based ply index
  role        text   not null check (role in ('user','assistant','system')),
  content     text   not null,
  created_at  timestamptz default now(),
  constraint fk_game foreign key (game_id) references public.games(id) on delete cascade
);

/* Row Level Security */
alter table public.move_chat enable row level security;

create policy "Players read chats" on public.move_chat
  for select using (
    game_id is null or exists(
      select 1 from public.games
      where games.id = move_chat.game_id and games.user_id = auth.uid()
    )
  );

create policy "Players write chats" on public.move_chat
  for insert with check (
    game_id is null or exists(
      select 1 from public.games
      where games.id = move_chat.game_id and games.user_id = auth.uid()
    )
  ); 