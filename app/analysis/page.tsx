"use client";

import { useEffect, useMemo, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GameStatus } from "@/components/game-status";
import { Chessboard } from "@/components/chessboard";
import { MoveHistory } from "@/components/move-history";
import { AIAnalysis } from "@/components/ai-analysis";
import { Square, Chess } from "chess.js";
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
import { useTriggerAnalysis } from "@/lib/hooks/useTriggerAnalysis";
import { useAnalysisState } from "@/lib/hooks/useAnalysisState";

function AnalysisPageContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId");
  const supabase = useSupabaseBrowser();

  const { game, updateGameExternal, goToPly, fullSanHistory, currentPly, loadPGN } =
    useReviewableGame();

  useEffect(() => {
    console.log("fullSanHistory", fullSanHistory);
  }, [fullSanHistory]);

  const clock = useChessClock({ start: 300, increment: 0 });

  // Flagged moves
  const { data: flaggedPlies = [] } = useFlaggedMoves(gameId ?? undefined);
  const flaggedSet = useMemo(() => new Set(flaggedPlies), [flaggedPlies]);

  // Fallback SAN history derived from PGN while ReviewableGame hasn't populated yet
  const [initialSanHistory, setInitialSanHistory] = useState<string[]>([]);

  const effectiveSanHistory =
    fullSanHistory.length > 0 ? fullSanHistory : initialSanHistory;

  const moveHistory = useMemo(
    () => formatMoveHistory(effectiveSanHistory),
    [effectiveSanHistory]
  );

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

  // Analysis data and loading states
  const {
    data: batchAnalysis,
    isLoading: analysisLoading,
    error: analysisError,
  } = useGameAnalysis(gameId ?? undefined);

  // Use our new FSM for analysis state management
  const {
    state: analysisState,
    isComplete,
    llmTriggered,
    setLlmTriggered,
  } = useAnalysisState({
    gameId,
    analysis: batchAnalysis,
    sanHistory: fullSanHistory,
    isLoading: analysisLoading,
    error: analysisError as Error | null,
  });

  // Display analysis state for debugging
  useEffect(() => {
    console.log("Analysis state:", analysisState);
  }, [analysisState]);

  const triggerAnalysisMutation = useTriggerAnalysis((newState) => {
    console.log(`Analysis state transition: ${analysisState} -> ${newState}`);
  });

  const currentAnalysis: PlyAnalysis | null =
    currentPly >= 0 && batchAnalysis ? batchAnalysis[currentPly] ?? null : null;

  const analysis = useMemo(() => {
    if (currentPly < 0) return "Select a move or use ← → keys to view insights.";

    // Show appropriate message based on analysis state
    switch (analysisState) {
      case "loading-data":
        return "Loading analysis data...";
      case "backfilling-engine":
        return "Running Stockfish analysis... This may take a moment.";
      case "waiting-llm":
        return "Generating AI insights... This may take a moment.";
      case "error":
        return "Error loading analysis. Please try again.";
    }

    if (!isComplete) {
      return "Analyzing game... This may take a moment.";
    }

    if (!currentAnalysis) return "No analysis available for this move.";

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
  }, [currentAnalysis, game, currentPly, analysisState, isComplete]);

  const isThinking = analysisState !== "complete" && analysisState !== "idle";
  const bestMove = currentAnalysis?.best_move ?? null;

  // Backfill missing engine data and trigger analysis
  useBackfillEngineAnalysis({
    gameId,
    sanHistory: fullSanHistory,
    analysis: batchAnalysis,
    analysisState,
    onStateChange: (newState) => {
      console.log(`Backfill state transition: ${analysisState} -> ${newState}`);
    },
  });

  // Trigger initial analysis if game is complete but has no analysis
  useEffect(() => {
    if (
      gameId &&
      batchAnalysis &&
      batchAnalysis.length === 0 &&
      fullSanHistory.length > 0 &&
      analysisState === "backfilling-engine" &&
      !triggerAnalysisMutation.isPending
    ) {
      console.log("Triggering initial analysis for completed game");
      triggerAnalysisMutation.mutate(gameId);
    }
  }, [
    gameId,
    batchAnalysis,
    fullSanHistory.length,
    triggerAnalysisMutation,
    analysisState,
  ]);

  // Trigger LLM analysis once for moves that have engine data but missing explanations
  useEffect(() => {
    if (!gameId || !batchAnalysis || batchAnalysis.length === 0) return;

    const needsExplanation = batchAnalysis.some(
      (row) => row.pv && (!row.explanation || row.explanation.trim() === "")
    );

    if (
      needsExplanation &&
      analysisState === "waiting-llm" &&
      !llmTriggered &&
      !triggerAnalysisMutation.isPending
    ) {
      setLlmTriggered(true);
      console.log("Triggering LLM analysis for missing explanations");
      triggerAnalysisMutation.mutate(gameId);
    }
  }, [
    gameId,
    batchAnalysis,
    triggerAnalysisMutation,
    analysisState,
    llmTriggered,
    setLlmTriggered,
  ]);

  // Reset trigger flag once analysis is complete
  useEffect(() => {
    if (isComplete) {
      setLlmTriggered(false);
    }
  }, [isComplete, setLlmTriggered]);

  // Load game data
  const { data: fetchedGame, isLoading: gameLoading } = useGameById(
    supabase,
    gameId ?? ""
  );

  useEffect(() => {
    if (!fetchedGame) return;

    // Type assertion with unknown first to handle the complex type mismatch
    const g = fetchedGame as unknown as {
      pgn?: string;
      white_time_remaining?: number;
      black_time_remaining?: number;
      clock_history?: { white: number; black: number }[];
      last_move_timestamp?: string;
    };

    if (g.pgn) loadPGN(g.pgn);

    clock.load({
      white: g.white_time_remaining || 300,
      black: g.black_time_remaining || 300,
      clock_history: g.clock_history || undefined,
      last_move_timestamp: g.last_move_timestamp || undefined,
    });
  }, [fetchedGame, loadPGN]);

  // Derive fallback SAN history directly from PGN if the Chess instance hasn't yet populated moves
  useEffect(() => {
    if (
      fullSanHistory.length === 0 &&
      initialSanHistory.length === 0 &&
      fetchedGame &&
      (fetchedGame as { pgn?: string }).pgn
    ) {
      const tmp = new Chess();
      try {
        tmp.loadPgn((fetchedGame as { pgn?: string }).pgn as string);
        setInitialSanHistory(tmp.history());
      } catch {
        /* ignore parse errors */
      }
    }
  }, [fetchedGame, fullSanHistory.length, initialSanHistory.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => terminateEngine();
  }, []);

  const arrows = useMemo(() => {
    if (currentPly < 0 || !bestMove) return undefined;

    const match = (bestMove as string).match(/^([a-h][1-8])([a-h][1-8])/);
    if (!match) return undefined;

    const from = match[1] as Square;
    const to = match[2] as Square;
    return [[from, to, "rgb(0,128,0)"] as [Square, Square, string]];
  }, [bestMove]);

  // Show loading state while game data is loading
  if (gameLoading || !fetchedGame) {
    return (
      <div className="min-h-screen bg-background">
        <GameHeader backHref="/dashboard" title="PawnPilot Analysis" />
        <div className="flex items-center justify-center h-64">
          <div>Loading game...</div>
        </div>
      </div>
    );
  }

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
              onTimeUpdate={() => {}}
              gameOver={true}
            />

            <MoveHistory
              moves={moveHistoryWithFlags}
              currentPly={currentPly}
              onSelect={goToPly}
              onToggleFlag={() => {}}
            />

            <AIAnalysis analysis={analysis} isThinking={isThinking} />
          </>
        }
      />
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AnalysisPageContent />
    </Suspense>
  );
}
