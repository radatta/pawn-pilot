"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Chess, Square } from "chess.js";
import toast from "react-hot-toast";
import { useGameById, useCreateGame, useUpdateGame } from "@/lib/queries/game-tanstack";
import useSupabaseBrowser from "@/lib/supabase/client";
import { formatMoveHistory } from "@/lib/utils/format-move-history";
import { GameHeader } from "@/components/game-header";

import { Button } from "@/components/ui/button";
import { Chessboard } from "@/components/chessboard";
import { GameStatus } from "@/components/game-status";
import { MoveHistory } from "@/components/move-history";
import { AIAnalysis } from "@/components/ai-analysis";
import { GameControls } from "@/components/game-controls";

import {
  terminateEngine,
  analyzePosition,
  initEngine,
  getBestMove,
} from "@/lib/engine/stockfish";
import { useReviewableGame } from "@/lib/hooks/useReviewableGame";
import { GameResult } from "../api/games/[gameId]/route";
import { useFlaggedMoves } from "@/lib/hooks/useFlaggedMoves";
import { useToggleFlag } from "@/lib/hooks/useToggleFlag";
import { useTriggerAnalysis } from "@/lib/hooks/useTriggerAnalysis";
import { MoveChatDrawer } from "@/components/move-chat-drawer";
import { MoveChatButton } from "@/components/move-chat-button";
import { ChatContext } from "@/lib/types";

export default function PlayPage() {
  const router = useRouter();
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
  const [gameId, setGameId] = useState<string | null>(null);
  const [flippedBoard, setFlippedBoard] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<"white" | "black">("white");
  const [analysis, setAnalysis] = useState("Start a new game to begin!");
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [whiteTimeRemaining, setWhiteTimeRemaining] = useState(300);
  const [blackTimeRemaining, setBlackTimeRemaining] = useState(300);
  const [lastMoveTimestamp, setLastMoveTimestamp] = useState<Date | null>(null);
  const [clockHistory, setClockHistory] = useState<{ white: number; black: number }[]>([
    { white: 300, black: 300 },
  ]);
  const [hintArrows, setHintArrows] = useState<[Square, Square, string][]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintActive, setHintActive] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPly, setChatPly] = useState<number>(1);
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);

  // Read ?gameId= from URL
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get("gameId");

  const moveHistory = formatMoveHistory(fullSanHistory);

  // ------------------------------------------------------------
  // Flagged moves (React Query)
  // ------------------------------------------------------------
  const { data: flaggedPlies = [] } = useFlaggedMoves(gameId ?? undefined);
  const toggleFlagMutation = useToggleFlag(gameId ?? undefined);

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

  // ------------------------------------------------------------
  // React-Query: load existing game (if ?gameId=)
  // ------------------------------------------------------------
  const { data: fetchedGame } = useGameById(supabase, gameId ?? undefined);

  // Whenever fetchedGame changes, sync local Chess state
  useEffect(() => {
    if (!fetchedGame) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = fetchedGame as any;
      const loadedGame = new Chess();
      if (g.pgn) loadedGame.loadPgn(g.pgn);

      updateGameExternal(loadedGame);

      // --------------------------------------------------------
      // Sync clocks – account for time elapsed since last move
      // --------------------------------------------------------
      let whiteRemaining = g.white_time_remaining ?? 300;
      let blackRemaining = g.black_time_remaining ?? 300;

      if (g.last_move_timestamp) {
        const lastTs = new Date(g.last_move_timestamp);

        const elapsedSeconds = Math.floor((Date.now() - lastTs.getTime()) / 1000);

        // Whose turn is it? loadedGame.turn() returns 'w' | 'b'
        if (loadedGame.turn() === "w") {
          whiteRemaining = Math.max(0, whiteRemaining - elapsedSeconds);
        } else {
          blackRemaining = Math.max(0, blackRemaining - elapsedSeconds);
        }

        // After adjusting for elapsed time, treat NOW as the new reference point
        setLastMoveTimestamp(new Date());
      }

      setWhiteTimeRemaining(whiteRemaining);
      setBlackTimeRemaining(blackRemaining);
      setClockHistory(g.clock_history || [{ white: 300, black: 300 }]);

      if (g.status === "completed") {
        setGameResult(g.result);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedGame]);

  // ------------------------------------------------------------
  // React-Query: create new game mutation (still via API route)
  // ------------------------------------------------------------
  const createGameMutation = useCreateGame();

  // ------------------------------------------------------------
  // React Query: generic mutation for updating a game via PUT
  // ------------------------------------------------------------
  const updateGameMutation = useUpdateGame(gameId ?? undefined);

  // ------------------------------------------------------------------
  // Mutation: trigger batch analysis when game is completed
  // ------------------------------------------------------------------
  const analysisMutation = useTriggerAnalysis();

  const handleNewGame = async () => {
    try {
      const data = await createGameMutation.mutateAsync({
        timeControl: 300,
        increment: 0,
      });
      setGameId(data.id);
      router.replace(`/play?gameId=${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  // Function to handle time updates
  const handleTimeUpdate = async (white: number, black: number) => {
    if (!gameId) return;

    // Update local state
    setWhiteTimeRemaining(white);
    setBlackTimeRemaining(black);

    // Check for time out
    if (white === 0 && gameResult === null) {
      // White ran out of time - Black wins
      setGameResult("timeout");
      setAnalysis("White ran out of time. Black wins!");
      await handleTimeOut("white");
    } else if (black === 0 && gameResult === null) {
      // Black ran out of time - White wins
      setGameResult("timeout");
      setAnalysis("Black ran out of time. White wins!");
      await handleTimeOut("black");
    }
  };

  // Handle time out
  const handleTimeOut = async (loser: "white" | "black") => {
    if (!gameId) return;
    updateGameMutation.mutate({
      status: "completed",
      result: "timeout",
      white_time_remaining: loser === "white" ? 0 : whiteTimeRemaining,
      black_time_remaining: loser === "black" ? 0 : blackTimeRemaining,
    });
  };

  // ------------------------------------------------------------
  // Centralized evaluation of game-over conditions
  // ------------------------------------------------------------
  const evaluateGameOver = (g: Chess): GameResult | null => {
    if (!g.isGameOver()) return null;

    let result: GameResult;
    if (g.isCheckmate()) {
      result = "checkmate";
      setAnalysis(
        g.turn() === "w" ? "Black wins by checkmate!" : "White wins by checkmate!"
      );
    } else if (g.isStalemate()) {
      result = "stalemate";
      setAnalysis("Draw by stalemate.");
    } else if (g.isThreefoldRepetition()) {
      result = "threefold_repetition";
      setAnalysis("Draw by threefold repetition.");
    } else if (g.isInsufficientMaterial()) {
      result = "insufficient_material";
      setAnalysis("Draw by insufficient material.");
    } else if (g.isDraw()) {
      result = "draw";
      setAnalysis("Draw.");
    } else {
      result = "draw";
      setAnalysis("Game over.");
    }

    setGameResult(result);
    return result;
  };

  // Function to update game state via API
  const updateGame = async (newGame: Chess) => {
    // Calculate time spent on move
    const now = new Date();
    const timeUpdate: { white_time_remaining?: number; black_time_remaining?: number } =
      {};

    let newWhite = whiteTimeRemaining;
    let newBlack = blackTimeRemaining;

    if (lastMoveTimestamp && gameId) {
      const elapsedSeconds = Math.floor(
        (now.getTime() - lastMoveTimestamp.getTime()) / 1000
      );

      if (game.turn() === "w") {
        // White just made a move, so deduct from white's time
        newWhite = Math.max(0, whiteTimeRemaining - elapsedSeconds);
        setWhiteTimeRemaining(newWhite);
        timeUpdate.white_time_remaining = newWhite;
      } else {
        // Black just made a move, so deduct from black's time
        newBlack = Math.max(0, blackTimeRemaining - elapsedSeconds);
        setBlackTimeRemaining(newBlack);
        timeUpdate.black_time_remaining = newBlack;
      }
    }

    // Update clock history
    const newClockHistory = [...clockHistory, { white: newWhite, black: newBlack }];
    setClockHistory(newClockHistory);

    setLastMoveTimestamp(now);

    // Optimistically update UI first
    updateGameExternal(newGame);

    // Evaluate game-over conditions (may set result)
    const finalResult = evaluateGameOver(newGame);

    // If the game ended because of this move, persist the completion result
    if (finalResult) {
      handleCompleteGame(finalResult);
    }

    // Persist to backend (fire-and-forget) **only**
    // – after the AI (Black) move, i.e. when it's White's turn again, so we
    //   bundle the user's and the engine's moves in one request
    // – or immediately if the game just ended on the current move
    if (!gameId) return;

    if (newGame.turn() === "w" || finalResult !== null) {
      updateGameMutation.mutate({
        pgn: newGame.pgn(),
        ...timeUpdate,
        last_move_timestamp: now.toISOString(),
        clock_history: newClockHistory,
      });
    }
  };

  // Only allow the engine to move when we are on the latest ply (i.e., not navigating history)
  const atLatestPosition = currentPly === fullSanHistory.length - 1;

  // Effect to handle Stockfish moves
  useEffect(() => {
    setCurrentPlayer(game.turn() === "w" ? "white" : "black");

    if (atLatestPosition && game.turn() === "b" && gameResult === null && gameId) {
      // Artificial delay: 2-5 seconds for early game, 5-10 seconds for mid/endgame
      const moveNumber = Math.floor(game.history().length / 2) + 1;
      const thinkTime =
        moveNumber <= 10
          ? 500 + Math.random() * 1000 // 2-5 seconds for moves 1-10
          : 1000 + Math.random() * 2000; // 5-10 seconds for moves 11+

      setTimeout(async () => {
        const gameCopy = new Chess();
        gameCopy.loadPgn(game.pgn());

        try {
          // Get the move quickly for gameplay
          const uci = await getBestMove(gameCopy.fen(), moveNumber);

          // Parse UCI and make the move immediately
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          const promotion = uci.length === 5 ? uci[4] : undefined;
          const positionBeforeMove = gameCopy.fen(); // Store position for analysis
          gameCopy.move({ from, to, promotion });

          // Update game immediately for responsive UI
          Bye.updateGame(gameCopy);

          // Run analysis in background (don't await)
          const currentMoveNumber = gameCopy.history().length;
          analyzePosition(positionBeforeMove, 18)
            .then(async (analysis) => {
              try {
                await fetch(`/api/games/${gameId}/analysis`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    updates: [
                      {
                        move_number: currentMoveNumber,
                        best_move: analysis.bestMove,
                        eval_cp: analysis.evaluationCp ?? null,
                        mate_in: analysis.mateIn ?? null,
                        pv: analysis.pv ?? null,
                      },
                    ],
                  }),
                });
              } catch (err) {
                console.error("Failed to store analysis data:", err);
              }
            })
            .catch((err) => {
              console.error("Background analysis failed:", err);
            });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "An error occurred");
          if (err instanceof Error && err.message === "WASM not supported") {
            toast.error("Stockfish is not supported on this browser");
          }
        }
      }, thinkTime);
    }
  }, [game, gameId, currentPly, fullSanHistory, gameResult]);

  const handleResign = async () => {
    if (!gameId) return;
    updateGameMutation.mutate(
      { status: "completed", result: "resigned" },
      {
        onSuccess: () => {
          setAnalysis(
            "Game resigned. Don't worry - every game is a learning opportunity!"
          );
          setGameResult("resigned");
          // Trigger batch analysis once game completed
          if (gameId && !analysisMutation.isPending && !analysisMutation.isSuccess) {
            analysisMutation.mutate(gameId);
          }
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "An error occurred");
        },
      }
    );
  };

  const handleCompleteGame = async (finalResult: GameResult) => {
    if (!gameId) return;
    updateGameMutation.mutate(
      { status: "completed", result: finalResult },
      {
        onSuccess: () => setAnalysis("Game completed. Congratulations!"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "An error occurred"),
        onSettled: () => {
          // Trigger batch analysis once game completed
          if (gameId && !analysisMutation.isPending && !analysisMutation.isSuccess) {
            analysisMutation.mutate(gameId);
          }
        },
      }
    );
  };

  const handleFlipBoard = () => {
    setFlippedBoard(!flippedBoard);
  };

  const hasInitializedRef = useRef(false);
  // When URL param changes, update gameId or create new game
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (urlGameId) {
      setGameId(urlGameId);
    } else if (!gameId) {
      handleNewGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlGameId]);

  // Cleanup Stockfish worker when leaving the page
  useEffect(() => {
    return () => {
      terminateEngine();
    };
  }, []);

  // Keyboard navigation
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

  const handleHint = async () => {
    if (hintLoading) return;
    setHintLoading(true);
    try {
      const fen = game.fen();
      // Optimistic UI update
      setAnalysis("Generating hint…");

      // Fire off Stockfish analysis and LLM call in parallel
      const [engineRes, hintRes] = await Promise.all([
        analyzePosition(fen, 12),
        fetch(`/api/hint?fen=${encodeURIComponent(fen)}`).then(
          (r) => r.json() as Promise<{ analysis: string }>
        ),
      ]);

      // Build combined analysis string (LLM + engine details)
      const detailsParts: string[] = [];
      if (engineRes.bestMove) detailsParts.push(`Best: ${engineRes.bestMove}`);
      if (engineRes.mateIn !== undefined && engineRes.mateIn !== null) {
        detailsParts.push(`Mate in ${engineRes.mateIn}`);
      } else if (
        engineRes.evaluationCp !== undefined &&
        engineRes.evaluationCp !== null
      ) {
        const cp = (game.turn() === "w" ? 1 : -1) * (engineRes.evaluationCp / 100);
        detailsParts.push(`Eval: ${cp.toFixed(2)}`);
      }
      const analysisText = detailsParts.length
        ? `${hintRes.analysis}\n${detailsParts.join(" | ")}`
        : hintRes.analysis;

      setAnalysis(analysisText);
      setHintActive(true);

      // Draw arrow for the suggested move (from Stockfish)
      const match = engineRes.bestMove.match(/^([a-h][1-8])([a-h][1-8])/);
      if (match) {
        const from = match[1] as Square;
        const to = match[2] as Square;
        setHintArrows([[from, to, "rgb(0,128,0)"]]);
        // Remove arrow after 5 seconds (visual only)
        setTimeout(() => setHintArrows([]), 30000);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate hint");
    } finally {
      setHintLoading(false);
    }
  };

  // Clear hint visuals & text when a new move is made (history length changes)
  useEffect(() => {
    if (hintActive) {
      setHintActive(false);
      setHintArrows([]);
      setAnalysis("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullSanHistory.length]);

  // Preload Stockfish engine on page load (non-blocking)
  useEffect(() => {
    const preloadEngine = async () => {
      try {
        await initEngine();
      } catch (error) {
        console.warn("Failed to preload Stockfish engine:", error);
        // Don't show error to user as this is just a performance optimization
      }
    };

    preloadEngine();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <GameHeader backHref="/dashboard" />

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Main Panel - Chessboard */}
        <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/30">
          <div className="w-full max-w-2xl">
            <Chessboard
              game={game}
              setGame={updateGame}
              flipped={flippedBoard}
              disabled={gameResult !== null}
              arrows={hintArrows}
            />
          </div>
        </div>

        {/* Sidebar Panel */}
        <div className="w-96 border-l bg-card/30 backdrop-blur-sm p-6 space-y-6 overflow-y-auto">
          {/* Game Status */}
          <GameStatus
            currentPlayer={currentPlayer}
            playerColor="white"
            gameState="playing"
            whiteTimeRemaining={whiteTimeRemaining}
            blackTimeRemaining={blackTimeRemaining}
            onTimeUpdate={handleTimeUpdate}
            gameOver={gameResult !== null}
          />

          {/* Move History */}
          <MoveHistory
            moves={moveHistoryWithFlags}
            currentPly={currentPly}
            onSelect={goToPly}
            onToggleFlag={(ply, currently) =>
              toggleFlagMutation.mutate({ ply, currentlyFlagged: currently })
            }
            onChat={async (ply) => {
              setChatPly(ply + 1);
              setChatOpen(true);

              // compute context asynchronously
              const chessCopy = new Chess();
              chessCopy.loadPgn(game.pgn());
              chessCopy.reset();
              fullSanHistory.slice(0, ply).forEach((m) => chessCopy.move(m));
              const fen_before = chessCopy.fen();
              const move_san = fullSanHistory[ply] ?? "";
              const engineRes = await analyzePosition(fen_before, 12);
              setChatContext({
                fen_before,
                move_san,
                pv: engineRes.pv ?? "",
                eval_cp: engineRes.evaluationCp ?? null,
                mate_in: engineRes.mateIn ?? null,
              });
            }}
          />

          {/* AI Analysis */}
          <div className="space-y-2">
            <AIAnalysis analysis={analysis} />
            <div className="flex justify-end">
              <MoveChatButton
                onClick={async () => {
                  setChatPly(currentPly + 1);
                  setChatOpen(true);

                  const chessCopy = new Chess();
                  chessCopy.loadPgn(game.pgn());
                  chessCopy.reset();
                  fullSanHistory.slice(0, currentPly).forEach((m) => chessCopy.move(m));
                  const fen_before = chessCopy.fen();
                  const move_san = fullSanHistory[currentPly] ?? "";
                  const engineRes = await analyzePosition(fen_before, 12);
                  setChatContext({
                    fen_before,
                    move_san,
                    pv: engineRes.pv ?? "",
                    eval_cp: engineRes.evaluationCp ?? null,
                    mate_in: engineRes.mateIn ?? null,
                  });
                }}
              />
            </div>
          </div>

          {/* Game Controls */}
          <GameControls
            onNewGame={handleNewGame}
            onResign={handleResign}
            onFlipBoard={handleFlipBoard}
            onHint={handleHint}
            hintLoading={hintLoading}
            disabled={gameResult !== null}
          />

          {/* Post-game Actions */}
          {gameResult && gameId && (
            <Button asChild size="sm" className="w-full">
              <Link
                href={`/analysis?gameId=${gameId}&pgn=${encodeURIComponent(game.pgn())}`}
              >
                Go to Analysis
              </Link>
            </Button>
          )}

          {/* Chat Drawer */}
          <MoveChatDrawer
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            gameId={gameId}
            ply={chatPly}
            context={chatContext ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
