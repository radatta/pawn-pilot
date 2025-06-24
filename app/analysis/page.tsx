"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { useGameAnalysis, PlyAnalysis } from "@/lib/queries/game-analysis-tanstack";
import { useBackfillEngineAnalysis } from "@/lib/hooks/useBackfillEngineAnalysis";
import { MoveChatDrawer } from "@/components/move-chat-drawer";
import { MoveChatButton } from "@/components/move-chat-button";
import { Chess } from "chess.js";
import { analyzePosition } from "@/lib/engine/stockfish";
import { ChatContext } from "@/lib/types";

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = searchParams.get("gameId");
  const supabase = useSupabaseBrowser();

  const pgnParam = decodeURIComponent(searchParams.get("pgn") ?? "");
  const { game, updateGameExternal, goToPly, fullSanHistory, currentPly, loadPGN } =
    useReviewableGame({ pgn: pgnParam });

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

  const currentAnalysis: PlyAnalysis | null =
    currentPly >= 0 && batchAnalysis ? batchAnalysis[currentPly] ?? null : null;

  const analysis = useMemo(() => {
    if (currentPly < 0) return "Select a move or use ← → keys to view insights.";

    if (!currentAnalysis) return "Generating analysis…";

    const parts: string[] = [];
    parts.push(currentAnalysis.explanation);

    const details: string[] = [];
    if (currentAnalysis.best_move) details.push(`Best: ${currentAnalysis.best_move}`);
    if (currentAnalysis.mate_in !== null && currentAnalysis.mate_in !== undefined) {
      details.push(`Mate in ${currentAnalysis.mate_in}`);
    } else if (
      currentAnalysis.eval_cp !== null &&
      currentAnalysis.eval_cp !== undefined
    ) {
      const cp = (game.turn() === "w" ? 1 : -1) * (currentAnalysis.eval_cp / 100);
      details.push(`Eval: ${cp.toFixed(2)}`);
    }
    if (details.length) parts.push(details.join(" | "));
    return parts.join("\n");
  }, [currentAnalysis, game]);

  const isThinking = currentPly >= 0 && (!currentAnalysis || !currentAnalysis.best_move);

  const bestMove = currentAnalysis?.best_move ?? null;

  useBackfillEngineAnalysis({
    gameId,
    sanHistory: fullSanHistory,
    analysis: batchAnalysis,
    onAnalysisComplete: () => {
      if (pgnParam && gameId) {
        // Remove PGN from search params since analysis is now complete and stored on server
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("pgn");
        const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
        router.replace(newUrl);
      }
    },
  });

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
    if (currentPly < 0 || !bestMove) return undefined;

    // Match the first four characters representing the from and to squares.
    // This covers normal moves ("e2e4") as well as promotions ("e7e8q").
    const match = (bestMove as string).match(/^([a-h][1-8])([a-h][1-8])/);
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

    // If we have a PGN parameter, only load from server if it's different or if we don't have any PGN loaded yet
    if (pgnParam) {
      // Check if the server PGN is different from what we have in the query parameter
      if (g.pgn && g.pgn !== pgnParam && g.pgn !== game.pgn()) {
        // Server has newer/different PGN, load it
        loadPGN(g.pgn);
      }
      // If PGNs match or server has no PGN, keep using the query parameter PGN
    } else {
      // No PGN parameter, load from server if available
      if (g.pgn) loadPGN(g.pgn);
    }

    clock.load({
      white: g.white_time_remaining || 300,
      black: g.black_time_remaining || 300,
      clock_history: g.clock_history || undefined,
      last_move_timestamp: g.last_move_timestamp || undefined,
    });
  }, [fetchedGame, loadPGN, pgnParam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => terminateEngine();
  }, []);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatPly, setChatPly] = useState<number>(1);
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);

  const buildContext = async (ply: number) => {
    const chessCopy = new Chess();
    chessCopy.loadPgn(game.pgn());
    chessCopy.reset();
    fullSanHistory.slice(0, ply).forEach((m) => chessCopy.move(m));
    const fen_before = chessCopy.fen();
    const move_san = fullSanHistory[ply] ?? "";
    const engineRes = await analyzePosition(fen_before, 12);
    const ctx: ChatContext = {
      fen_before,
      move_san,
      pv: engineRes.pv ?? "",
      eval_cp: engineRes.evaluationCp ?? null,
      mate_in: engineRes.mateIn ?? null,
    };
    setChatContext(ctx);
  };

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
              onChat={(ply) => {
                setChatPly(ply + 1);
                setChatOpen(true);
              }}
            />
            <div className="space-y-2">
              <AIAnalysis analysis={analysis} isThinking={isThinking} />
              <div className="flex justify-end">
                <MoveChatButton
                  onClick={async () => {
                    await buildContext(currentPly);
                    setChatPly(currentPly + 1);
                    setChatOpen(true);
                  }}
                />
              </div>
            </div>
            <MoveChatDrawer
              open={chatOpen}
              onClose={() => setChatOpen(false)}
              gameId={gameId}
              ply={chatPly}
              context={chatContext ?? undefined}
            />
          </>
        }
      />
    </div>
  );
}
