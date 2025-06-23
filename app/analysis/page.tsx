"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { GameStatus } from "@/components/game-status";
import { Chessboard } from "@/components/chessboard";
import { MoveHistory } from "@/components/move-history";
import { AIAnalysis } from "@/components/ai-analysis";
import { Square } from "chess.js";
import { terminateEngine } from "@/lib/engine/stockfish";
import { useReviewableGame } from "@/lib/hooks/useReviewableGame";
import useSupabaseBrowser from "@/lib/supabase/client";
import { useGameById } from "@/lib/queries/game-tanstack";
import { useChessClock } from "@/lib/hooks/useChessClock";
import { formatMoveHistory } from "@/lib/utils/format-move-history";
import { TwoPaneLayout } from "@/components/two-pane-layout";
import { GameHeader } from "@/components/game-header";
import { useFlaggedMoves } from "@/lib/hooks/useFlaggedMoves";
import { useGameAnalysis } from "@/lib/queries/game-analysis-tanstack";

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId");
  const supabase = useSupabaseBrowser();

  const pgnParam = decodeURIComponent(searchParams.get("pgn") ?? "");
    useReviewableGame({ pgn: pgnParam });
    useReviewableGame();

  const clock = useChessClock({ start: 300, increment: 0 });

  const moveHistory = formatMoveHistory(fullSanHistory);

  // Flagged moves
  const { data: flaggedPlies = [] } = useFlaggedMoves(gameId ?? undefined);
  const flaggedSet = useMemo(() => new Set(flaggedPlies), [flaggedPlies]);

  const moveHistoryWithFlags = useMemo(() => {
    return moveHistory.map((m) => {
      const whiteIdx = (m.moveNumber - 1) * 2;
      const blackIdx = whiteIdx + 1;
      return {
        ...m,
        whiteFlagged: flaggedSet.has(whiteIdx),
        blackFlagged: flaggedSet.has(blackIdx),
      };
    });
  }, [moveHistory, flaggedSet]);

  // --------------------------------------------------------------------
  // Pre-computed analysis (batch) vs on-the-fly analysis
  // --------------------------------------------------------------------
  const { data: batchAnalysis } = useGameAnalysis(gameId ?? undefined);

  const analysis = batchAnalysis
    ? batchAnalysis[currentPly] ?? ""
    : "Generating analysis…";
  const isThinking = !batchAnalysis;

  // Best-move arrows are no longer available without live Stockfish; disable.
  const bestMove: string | null = null;

  // Update displayed time when currentPly changes
  useEffect(() => {
    const entry = clock.history[currentPly] ?? clock.history[clock.history.length - 1];
    if (entry) {
      // load times in hook; nothing else needed
    }
  }, [currentPly, clock.history]);

  const arrows = useMemo(() => {
    // Only draw an arrow when the engine provides a standard LAN move (e.g. "e2e4" or "e7e8q").
    // Stockfish returns "(none)" when no legal moves are available which would otherwise
    // produce invalid square coordinates and trigger React warnings (NaN SVG attributes).
    if (!bestMove) return undefined;

    // Match the first four characters representing the from and to squares.
    // This covers normal moves ("e2e4") as well as promotions ("e7e8q").
    const match = bestMove.match(/^([a-h][1-8])([a-h][1-8])/);
    if (!match) return undefined;

    const from = match[1] as Square;
    const to = match[2] as Square;
    return [[from, to, "rgb(0,128,0)"] as [Square, Square, string]];
  }, [bestMove]);

  // ------------------------------------------------------------
  // React Query: load game data if gameId provided
  // ------------------------------------------------------------
  const { data: fetchedGame } = useGameById(supabase, gameId ?? "");

  // When fetched, load into chess
  useEffect(() => {
    if (!fetchedGame) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = fetchedGame;
    if (g.pgn) loadPGN(g.pgn);
    clock.load({
      white: g.white_time_remaining || 300,
      black: g.black_time_remaining || 300,
      clock_history: g.clock_history || undefined,
      last_move_timestamp: g.last_move_timestamp || undefined,
    });
  }, [fetchedGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => terminateEngine();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <GameHeader backHref="/dashboard" title="PawnPilot Analysis" />
      <TwoPaneLayout
        board={<Chessboard game={game} setGame={updateGameExternal} arrows={arrows} />}
        sidebar={
          <>
            <GameStatus
              currentPlayer={game.turn() === "w" ? "white" : "black"}
              playerColor="white"
              gameState="playing"
              whiteTimeRemaining={clock.white}
              blackTimeRemaining={clock.black}
              gameOver={true}
            />
            <MoveHistory
              moves={moveHistoryWithFlags}
              currentPly={currentPly}
              onSelect={goToPly}
            />
            <AIAnalysis analysis={analysis} isThinking={isThinking} />
          </>
        }
      />
    </div>
  );
}
