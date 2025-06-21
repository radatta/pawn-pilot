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
import { useStockfishAnalysis } from "@/lib/hooks/useStockfishAnalysis";
import { useChessClock } from "@/lib/hooks/useChessClock";
import { formatMoveHistory } from "@/lib/utils/format-move-history";
import { TwoPaneLayout } from "@/components/two-pane-layout";
import { GameHeader } from "@/components/game-header";

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId");
  const supabase = useSupabaseBrowser();

  const { game, updateGameExternal, goToPly, fullSanHistory, currentPly, loadPGN } =
    useReviewableGame();

  const clock = useChessClock({ start: 300, increment: 0 });

  const moveHistory = formatMoveHistory(fullSanHistory);

  // --------------------------------------------------------------------
  // Memoised FEN & normalisation helpers
  // --------------------------------------------------------------------
  const {
    analysisText: analysis,
    bestMove,
    thinking: isThinking,
  } = useStockfishAnalysis(game);

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
            <MoveHistory moves={moveHistory} currentPly={currentPly} onSelect={goToPly} />
            <AIAnalysis analysis={analysis} isThinking={isThinking} />
          </>
        }
      />
    </div>
  );
}
