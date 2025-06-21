"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Crown, ArrowLeft } from "lucide-react";
import { Chess, Square } from "chess.js";
import toast from "react-hot-toast";

import { Chessboard } from "@/components/chessboard";
import { MoveHistory } from "@/components/move-history";
import { AIAnalysis } from "@/components/ai-analysis";
import { Button } from "@/components/ui/button";
import { GameStatus } from "@/components/game-status";
import { analyzePosition, AnalysisResult, terminateEngine } from "@/lib/engine/stockfish";
import { useReviewableGame } from "@/lib/hooks/useReviewableGame";
import useSupabaseBrowser from "@/lib/supabase/client";
import { useGameById } from "@/lib/queries/game-tanstack";

interface FormattedMove {
  moveNumber: number;
  white: string;
  black?: string;
}

function formatMoveHistory(history: string[]): FormattedMove[] {
  const formatted: FormattedMove[] = [];
  for (let i = 0; i < history.length; i += 2) {
    formatted.push({
      moveNumber: i / 2 + 1,
      white: history[i] as string,
      black: history[i + 1] as string | undefined,
    });
  }
  return formatted;
}

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId");
  const supabase = useSupabaseBrowser();

  const {
    game,
    updateGameExternal,
    stepBackward,
    stepForward,
    goToPly,
    fullSanHistory,
    currentPly,
  } = useReviewableGame();

  const [analysis, setAnalysis] = useState<string>(
    "Load a game or start exploring to begin analysis."
  );
  const [isThinking, setIsThinking] = useState(false);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [clockHistory, setClockHistory] = useState<{ white: number; black: number }[]>([
    {
      white: 300,
      black: 300,
    },
  ]);
  const [whiteTime, setWhiteTime] = useState(300);
  const [blackTime, setBlackTime] = useState(300);

  const moveHistory = formatMoveHistory(fullSanHistory);

  // --------------------------------------------------------------------
  // Memoised FEN & normalisation helpers
  // --------------------------------------------------------------------
  const fen = useMemo(() => game.fen(), [game]);
  const normalisedFen = useMemo(() => fen.split(" ").slice(0, 4).join(" "), [fen]);

  // Simple in-memory cache for analysis results keyed by normalised FEN.
  const analysisCache = useRef<
    Map<
      string,
      {
        analysisText: string;
        bestMove: string | null;
      }
    >
  >(new Map());

  // Update displayed time when currentPly changes
  useEffect(() => {
    const entry = clockHistory[currentPly] ?? clockHistory[clockHistory.length - 1];
    if (entry) {
      setWhiteTime(entry.white);
      setBlackTime(entry.black);
    }
  }, [currentPly, clockHistory]);

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

  // Listen for left / right arrow keys globally.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepBackward();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepForward();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepBackward, stepForward]);

  // --------------------------------------------------------------------
  // Evaluate position whenever the POSITION (not the object) changes.
  // Uses cache to avoid duplicate engine evaluation of identical FENs.
  // --------------------------------------------------------------------
  useEffect(() => {
    let canceled = false;

    // First, see if we already analysed this position.
    const cached = analysisCache.current.get(normalisedFen);
    if (cached) {
      setAnalysis(cached.analysisText);
      setBestMove(cached.bestMove);
      return; // Skip expensive Stockfish call
    }

    async function evaluate() {
      setIsThinking(true);
      try {
        const result: AnalysisResult = await analyzePosition(fen, 18);
        if (canceled) return;

        // Build human-readable analysis string.
        let analysisText = "";
        if (result.mateIn !== undefined) {
          analysisText = `Mate in ${result.mateIn}`;
        } else if (result.evaluationCp !== undefined) {
          const evalScore = (game.turn() === "w" ? 1 : -1) * (result.evaluationCp / 100);
          analysisText = `Eval: ${evalScore.toFixed(2)} | Depth: ${
            result.depth
          } | Best line: ${result.pv?.slice(0, 60)}...`;
        } else {
          analysisText = "Evaluation unavailable";
        }

        // Update state.
        setAnalysis(analysisText);
        setBestMove(result.bestMove);

        // Cache for future visits.
        analysisCache.current.set(normalisedFen, {
          analysisText,
          bestMove: result.bestMove,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "An error occurred");
        if (!canceled) setAnalysis("Engine error");
      } finally {
        if (!canceled) setIsThinking(false);
      }
    }

    evaluate();

    return () => {
      canceled = true;
    };
  }, [normalisedFen, fen, game]);

  // ------------------------------------------------------------
  // React Query: load game data if gameId provided
  // ------------------------------------------------------------
  const { data: fetchedGame } = useGameById(supabase, gameId ?? "");

  // When fetched, load into chess
  useEffect(() => {
    if (!fetchedGame) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = fetchedGame as any;
    const loaded = new Chess();
    if (g.pgn) loaded.loadPgn(g.pgn);
    updateGameExternal(loaded);
    if (g.clock_history) setClockHistory(g.clock_history);
  }, [fetchedGame, updateGameExternal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => terminateEngine();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
              <Crown className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">PawnPilot Analysis</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/30">
          <div className="w-full max-w-2xl">
            <Chessboard game={game} setGame={updateGameExternal} arrows={arrows} />
          </div>
        </div>

        {/* Sidebar Panel */}
        <div className="w-96 border-l bg-card/30 backdrop-blur-sm p-6 space-y-6 overflow-y-auto">
          {/* Clock Status */}
          <GameStatus
            currentPlayer={game.turn() === "w" ? "white" : "black"}
            playerColor="white"
            gameState="playing"
            whiteTimeRemaining={whiteTime}
            blackTimeRemaining={blackTime}
            gameOver={true}
          />

          {/* Move History */}
          <MoveHistory moves={moveHistory} currentPly={currentPly} onSelect={goToPly} />

          {/* AI Analysis */}
          <AIAnalysis analysis={analysis} isThinking={isThinking} />
        </div>
      </div>
    </div>
  );
}
