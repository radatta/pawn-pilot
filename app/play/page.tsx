"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Crown, ArrowLeft } from "lucide-react";
import { Chess } from "chess.js";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Chessboard } from "@/components/chessboard";
import { GameStatus } from "@/components/game-status";
import { MoveHistory } from "@/components/move-history";
import { AIAnalysis } from "@/components/ai-analysis";
import { GameControls } from "@/components/game-controls";

import { getBestMove, terminateEngine } from "@/lib/engine/stockfish";
import { useReviewableGame } from "@/lib/hooks/useReviewableGame";
import { GameResult } from "../api/games/[gameId]/route";

interface FormattedMove {
  moveNumber: number;
  white: string;
  black?: string;
}

function formatMoveHistory(historySan: string[]): FormattedMove[] {
  const formatted: FormattedMove[] = [];
  for (let i = 0; i < historySan.length; i += 2) {
    formatted.push({
      moveNumber: i / 2 + 1,
      white: historySan[i] as string,
      black: historySan[i + 1] as string | undefined,
    });
  }
  return formatted;
}

export default function PlayPage() {
  const router = useRouter();
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

  // Read ?gameId= from URL
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get("gameId");

  const moveHistory = formatMoveHistory(fullSanHistory);

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
    try {
      await fetch(`/api/games/${gameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          result: "timeout",
          white_time_remaining: loser === "white" ? 0 : whiteTimeRemaining,
          black_time_remaining: loser === "black" ? 0 : blackTimeRemaining,
        }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
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

    // Check for game over and set analysis message
    if (newGame.isGameOver()) {
      if (newGame.isCheckmate()) {
        setAnalysis(
          newGame.turn() === "w" ? "Black wins by checkmate!" : "White wins by checkmate!"
        );
      } else if (newGame.isStalemate()) {
        setAnalysis("Draw by stalemate.");
        setGameResult("draw");
      } else if (newGame.isThreefoldRepetition()) {
        setAnalysis("Draw by threefold repetition.");
        setGameResult("threefold_repetition");
      } else if (newGame.isInsufficientMaterial()) {
        setAnalysis("Draw by insufficient material.");
        setGameResult("insufficient_material");
      } else if (newGame.isDraw()) {
        setAnalysis("Draw.");
        setGameResult("draw");
      } else {
        setAnalysis("Game over.");
        setGameResult("draw");
      }
    }

    // Persist to backend (fire-and-forget)
    if (!gameId) return;
    fetch(`/api/games/${gameId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pgn: newGame.pgn(),
        ...timeUpdate,
        last_move_timestamp: now.toISOString(),
        clock_history: newClockHistory,
      }),
    }).catch((err) =>
      toast.error(err instanceof Error ? err.message : "An error occurred")
    );
  };

  // Only allow the engine to move when we are on the latest ply (i.e., not navigating history)
  const atLatestPosition = currentPly === fullSanHistory.length - 1;

  // Effect to handle AI moves
  useEffect(() => {
    setCurrentPlayer(game.turn() === "w" ? "white" : "black");

    if (atLatestPosition && game.turn() === "b" && gameResult === null && gameId) {
      // Artificial delay: 2-5 seconds for early game, 5-10 seconds for mid/endgame
      const moveNumber = Math.floor(game.history().length / 2) + 1;
      const thinkTime =
        moveNumber <= 10
          ? 2000 + Math.random() * 3000 // 2-5 seconds for moves 1-10
          : 5000 + Math.random() * 5000; // 5-10 seconds for moves 11+

      setTimeout(async () => {
        const gameCopy = new Chess();
        gameCopy.loadPgn(game.pgn());

        try {
          const uci = await getBestMove(gameCopy.fen());
          // parse UCI, e.g., e2e4 or e7e8q
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          const promotion = uci.length === 5 ? uci[4] : undefined;
          gameCopy.move({ from, to, promotion });
          updateGame(gameCopy);
          // After AI move, check for game over and set analysis if needed
          if (gameCopy.isGameOver()) {
            if (gameCopy.isCheckmate()) {
              setAnalysis(
                gameCopy.turn() === "w"
                  ? "Black wins by checkmate!"
                  : "White wins by checkmate!"
              );
              setGameResult("checkmate");
            } else if (gameCopy.isStalemate()) {
              setAnalysis("Draw by stalemate.");
              setGameResult("stalemate");
            } else if (gameCopy.isThreefoldRepetition()) {
              setAnalysis("Draw by threefold repetition.");
              setGameResult("threefold_repetition");
            } else if (gameCopy.isInsufficientMaterial()) {
              setAnalysis("Draw by insufficient material.");
              setGameResult("insufficient_material");
            } else if (gameCopy.isDraw()) {
              setAnalysis("Draw.");
              setGameResult("draw");
            } else {
              setAnalysis("Game over.");
            }
            handleCompleteGame();
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "An error occurred");
          if (err instanceof Error && err.message === "WASM not supported") {
            toast.error("Stockfish is not supported on this browser");
          }
        }
      }, thinkTime);
    }
  }, [game, gameId, currentPly, fullSanHistory, gameResult]);

  const handleNewGame = async () => {
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: 300, increment: 0 }), // 5 minute game
      });
      if (!response.ok) throw new Error("Failed to create new game");
      const newGameData = await response.json();

      setGameId(newGameData.id);
      setWhiteTimeRemaining(newGameData.white_time_remaining || 300);
      setBlackTimeRemaining(newGameData.black_time_remaining || 300);
      setLastMoveTimestamp(new Date(newGameData.last_move_timestamp || new Date()));
      setClockHistory(newGameData.clock_history || [{ white: 300, black: 300 }]);

      const newGameInstance = new Chess();
      if (newGameData.pgn) {
        newGameInstance.loadPgn(newGameData.pgn);
      }
      updateGameExternal(newGameInstance);
      setCurrentPlayer("white");
      // Update URL so refresh stays in the same game
      router.replace(`/play?gameId=${newGameData.id}`);
      setAnalysis(
        "Welcome to a new game! Start with a strong opening move like 1.e4 or 1.d4 to control the center."
      );
      // Reset previous game result so post-game actions disappear.
      setGameResult(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
      setAnalysis("Could not start a new game. Please try again.");
    }
  };

  const handleResign = async () => {
    if (!gameId) return;
    try {
      await fetch(`/api/games/${gameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", result: "resigned" }),
      });
      setAnalysis("Game resigned. Don't worry - every game is a learning opportunity!");
      // Mark game as completed locally so post-game actions appear.
      setGameResult("resigned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleCompleteGame = async () => {
    if (!gameId) return;
    try {
      await fetch(`/api/games/${gameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: { completed: true },
          result: gameResult,
        }),
      });
      setAnalysis("Game completed. Congratulations!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleFlipBoard = () => {
    setFlippedBoard(!flippedBoard);
  };

  // Load existing game if id in URL, else start new
  const loadGame = async (id: string) => {
    try {
      const res = await fetch(`/api/games/${id}`);
      if (!res.ok) throw new Error("Game not found");
      const data = await res.json();
      setGameId(data.id);
      if (data.status === "completed") {
        setGameResult(data.result);
      }

      // Load time data
      setWhiteTimeRemaining(data.white_time_remaining || 300);
      setBlackTimeRemaining(data.black_time_remaining || 300);
      if (data.last_move_timestamp) {
        setLastMoveTimestamp(new Date(data.last_move_timestamp));
      }
      setClockHistory(data.clock_history || [{ white: 300, black: 300 }]);

      const loadedGame = new Chess();
      if (data.pgn) {
        loadedGame.loadPgn(data.pgn);
      }
      updateGameExternal(loadedGame);
      setCurrentPlayer(loadedGame.turn() === "w" ? "white" : "black");
      setAnalysis("Reviewing saved game. Continue playing or explore moves.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
      // fallback to new game
      handleNewGame();
    }
  };

  useEffect(() => {
    if (urlGameId) {
      loadGame(urlGameId);
    } else {
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
            <span className="text-xl font-semibold">PawnPilot</span>
          </div>
        </div>
      </header>

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
          <MoveHistory moves={moveHistory} currentPly={currentPly} onSelect={goToPly} />

          {/* AI Analysis */}
          <AIAnalysis analysis={analysis} />

          {/* Game Controls */}
          <GameControls
            onNewGame={handleNewGame}
            onResign={handleResign}
            onFlipBoard={handleFlipBoard}
          />

          {/* Post-game Actions */}
          {gameResult && gameId && (
            <Button asChild size="sm" className="w-full">
              <Link href={`/analysis?gameId=${gameId}`}>Go to Analysis</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
