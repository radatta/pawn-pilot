# PawnPilot

> An AI-driven web app that helps chess players improve through adaptive gameplay, real-time explanations, and personalized analytics.

## Overview

- **Purpose** – Serve as an all-in-one training companion that lets users _play_, _analyze_, and _learn_ chess faster.
- **Audience** – Casual to intermediate players who want structured, data-backed coaching without hiring a human trainer.
- **Problem Solved** – Traditional sites focus on competition; PawnPilot focuses exclusively on self-improvement with instant feedback, weakness tracking, and tailored practice.

---

## Features

- 🧠 **Adaptive AI Opponent** – Stockfish WASM engine throttled to match the player's rating.
- ⏱️ **Real-Time Move Explanations** – LLM (OpenAI) describes the reasoning behind every move in ≤3 sentences.
- 💡 **Interactive Hints** – One-click "What should I play?" suggestions with concise strategy.
- 💬 **Move-by-Move Chat** – Ask follow-up questions about any position via an in-game chat drawer.
- 🧐 **Automatic Post-Game Analysis** – Centipawn loss, blunder detection, and best-line arrows.
- 🚩 **Flag & Review System** – Mark dubious moves during play for deeper study later.
- 📊 **Personal Dashboard** – Graph accuracy trends and phase-specific strengths (openings, endgames, etc.).
- 🧩 **Custom Puzzle Generation** – Create tactics from the user's own mistakes. _Planned_

Unique / innovative aspects:

- Combines a deterministic engine (Stockfish) with an LLM to give human-friendly explanations.
- Uses Supabase row-level security + middleware to provide serverless, authenticated, multi-tenant storage with zero backend code.

---

## Tech Stack

| Layer        | Technology                                                                         |
| ------------ | ---------------------------------------------------------------------------------- |
| Runtime      | Bun (TypeScript)                                                                   |
| Frontend     | Next.js 14 App Router, React Server & Client Components, Tailwind CSS w/ shadcn-ui |
| State & Data | TanStack React Query, Supabase (PostgreSQL + RLS)                                  |
| AI / Engine  | Stockfish 16.1 (WebAssembly), OpenAI Chat Completion API                           |
| Tooling      | ESLint (flat config), Prettier, Supabase CLI                                       |

Architectural notes:

- **Island architecture** – heavy components (chessboard, engine) run on the client; queries/mutations handled through API Route RPC wrappers.
- **Thin server** – Next.js API routes primarily validate input and proxy to Supabase or OpenAI.
- **Optimistic UI** – All game actions update locally first, then sync.

---

## How It Works (High-Level Flow)

1. **Play a game** – User starts `/play`; a `Chess()` instance holds local state while Stockfish (web worker) provides engine moves.
2. **On each move** –
   - Client requests `/api/games/[id]/moves` to persist SAN and timestamps.
   - Optional call to `/api/hint` streams a single best-move line.
3. **Explain** – Frontend sends position context to `/api/chat`; the route builds a system prompt (`lib/prompts.ts`) and streams OpenAI output back.
4. **Store & Analyse** – After the game, `/api/analysis` runs batch engine evaluations and stores results in `move_analysis` table.
5. **Dashboard** – React Query pulls aggregated stats via `queries/*.ts` and renders charts.

User interaction surface:

- **Landing** `/` – marketing page with CTA.
- **Auth** `/signin`, `/signup` – Supabase magic-link + password auth.
- **Play** `/play` – main chessboard with hint, chat, and flag buttons.
- **Analysis** `/analysis?id=⟨gameId⟩` – interactive review board.
- **Dashboard** `/dashboard` – progress overview.

---

## Setup & Installation

### Prerequisites

- **Bun ≥1.1.0** – `brew install bun`
- **Supabase CLI** – `brew install supabase/tap/supabase`
- **Docker** – for running the local Postgres container (supabase start)
- - OpenAI API key _optional but required for chat_

### Steps

```bash
# 1. Clone & enter
git clone https://github.com/radatta/pawn-pilot && cd pawn-pilot  # or fork/clone normally

# 2. Install deps
bun install

# 3. Configure environment
cp .env.example .env.local  # edit the following vars
# NEXT_PUBLIC_SUPABASE_URL= http://localhost:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY= <from `supabase start`>
# OPENAI_API_KEY= sk-...
# OPENAI_MODEL= gpt-4o  # optional override

# 4. Start database & run migrations
supabase start  # spins up Postgres at 54321
supabase db reset --local  # loads SQL in /supabase/migrations

# 5. Launch dev server
bun run dev  # http://localhost:3000
```

_Use `bun run supabase:types` to regenerate `lib/database.types.ts` after altering the schema._

---

## Usage Examples

### Play a Game

```text
1. Navigate to http://localhost:3000/play
2. Make a move – engine responds instantly.
3. Click the 💡 icon for a hint or the 💬 icon to ask "Why is that good?".
```

### Request a Hint via API (cURL)

```bash
curl -X POST http://localhost:3000/api/hint \
  -H 'Content-Type: application/json' \
  -d '{"fen":"r1bqkbnr/pppppppp/n7/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 2 2"}'
```

---

## Project Structure

```
├─ app/                # Next.js App Router routes (RSC)
│  ├─ play/            # /play page & logic
│  ├─ analysis/        # /analysis page
│  └─ api/             # REST-like endpoints (hint, chat, games, auth)
├─ components/         # Reusable UI & feature widgets
│  ├─ chessboard.tsx   # Wrapper around `@react-chess/chessboard`
│  └─ ui/              # shadcn-ui primitives
├─ lib/
│  ├─ engine/          # Stockfish WASM wrapper
│  ├─ supabase/        # Client / server helpers & middleware
│  ├─ hooks/           # Custom React hooks (useChessClock, useHint, …)
│  ├─ queries/         # Typed tanstack query fetchers
│  └─ prompts.ts       # Central system / user prompts for the LLM
├─ supabase/           # SQL migrations + config
└─ public/             # Static assets (stockfish.wasm, piece images, sounds)
```

Entry points:

- **Frontend** – `app/page.tsx` (landing) & `app/play/page.tsx` (core).
- **Serverless API** – e.g. `app/api/chat/route.ts`.

---

## Challenges & Learnings

- **Streaming LLM + SSE** – Learned to stream OpenAI completions through Next.js `Response` objects without blocking UI.
- **Bun Compatibility** – Some node packages assume `fs` polyfills; patched or replaced offending libs.
- **Stockfish WASM Tuning** – Balancing depth/threads to keep analysis <50 ms on mid-range laptops.
- **Supabase RLS** – Designing table policies that allow per-row multi-tenant access while supporting anonymous previews.
- **Optimistic Updates** – Implemented generic wrapper to reduce boilerplate around TanStack mutation rollback.

---

## Future Improvements

- 🤝 **Multiplayer Mode** - Play human vs. human directly in the browser via WebRTC.
- 🧩 **Puzzle Generator & SRS** - Auto-create tactics and add them to a spaced-repetition review queue.
- 📱 **Mobile PWA** - Installable, offline-friendly version for seamless play on phones.
- 📈 **Rating Calibration** - Dynamically adjust engine strength using a Glicko model.
- ♿️ **Accessibility Upgrades** - Add screen-reader support and high-contrast piece themes.

---

## Credits & Inspiration

- **Stockfish** – open-source chess engine (GPL).
- **Shadcn UI** – UI toolkit for React + Tailwind.
- **Supabase** – Postgres-as-a-service powering database & auth.
- **OpenAI** – Chat Completion API for natural-language explanations.
- Big thanks to Lichess & Chess.com for inspiring UX patterns.

---

> Built with ❤️, caffeine, and a passion for learning chess.
