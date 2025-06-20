"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Crown, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chessboard } from "@/components/chessboard";
import { GameStatus } from "@/components/game-status";
import { MoveHistory } from "@/components/move-history";
import { AIAnalysis } from "@/components/ai-analysis";
import { GameControls } from "@/components/game-controls";
import { Chess, Move as ChessMove } from "chess.js";

interface FormattedMove {
  moveNumber: number;
  white: string;
  black?: string;
}

// Function to format the history from chess.js
function formatMoveHistory(history: ChessMove[]): FormattedMove[] {
  const formatted: FormattedMove[] = [];
  for (let i = 0; i < history.length; i += 2) {
    formatted.push({
      moveNumber: i / 2 + 1,
      white: history[i].san,
      black: history[i + 1]?.san,
    });
  }
  return formatted;
}

export default function PlayPage() {
  const [game, setGame] = useState(new Chess());
  const [gameId, setGameId] = useState<string | null>(null);
  const [flippedBoard, setFlippedBoard] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<"white" | "black">("white");
  const [analysis, setAnalysis] = useState("Start a new game to begin!");

  // Read ?gameId= from URL
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get("gameId");

  const moveHistory = formatMoveHistory(game.history({ verbose: true }));

  // Function to update game state via API
  const updateGame = (newGame: Chess) => {
    // Optimistically update UI first
    setGame(newGame);

    // Persist to backend (fire-and-forget)
    if (!gameId) return;
    fetch(`/api/games/${gameId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pgn: newGame.pgn() }),
    }).catch((err) => console.error("Failed to persist game:", err));
  };

  // Effect to handle AI moves
  useEffect(() => {
    setCurrentPlayer(game.turn() === "w" ? "white" : "black");

    if (game.turn() === "b" && !game.isGameOver() && gameId) {
      const thinkTime = 500 + Math.random() * 500;

      setTimeout(() => {
        const gameCopy = new Chess();
        gameCopy.loadPgn(game.pgn());
        const moves = gameCopy.moves();
        if (moves.length > 0) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          gameCopy.move(randomMove);
          updateGame(gameCopy);
        }
      }, thinkTime);
    }
  }, [game, gameId]);

  const handleNewGame = async () => {
    try {
      const response = await fetch("/api/games", { method: "POST" });
      if (!response.ok) throw new Error("Failed to create new game");
      const newGameData = await response.json();

      setGameId(newGameData.id);
      const newGameInstance = new Chess();
      if (newGameData.pgn) {
        newGameInstance.loadPgn(newGameData.pgn);
      }
      setGame(newGameInstance);
      setCurrentPlayer("white");
      setAnalysis(
        "Welcome to a new game! Start with a strong opening move like 1.e4 or 1.d4 to control the center."
      );
    } catch (error) {
      console.error("Error starting new game:", error);
      setAnalysis("Could not start a new game. Please try again.");
    }
  };

  const handleResign = async () => {
    if (!gameId) return;
    try {
      await fetch(`/api/games/${gameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resigned" }),
      });
      setAnalysis("Game resigned. Don't worry - every game is a learning opportunity!");
    } catch (error) {
      console.error("Failed to resign:", error);
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
      const loadedGame = new Chess();
      if (data.pgn) {
        loadedGame.loadPgn(data.pgn);
      }
      setGame(loadedGame);
      setCurrentPlayer(loadedGame.turn() === "w" ? "white" : "black");
      setAnalysis("Reviewing saved game. Continue playing or explore moves.");
    } catch (err) {
      console.error(err);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="flex items-center gap-2">
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
            <Chessboard game={game} setGame={updateGame} flipped={flippedBoard} />
          </div>
        </div>

        {/* Sidebar Panel */}
        <div className="w-80 border-l bg-card/30 backdrop-blur-sm p-6 space-y-6 overflow-y-auto">
          {/* Game Status */}
          <GameStatus
            currentPlayer={currentPlayer}
            playerColor="white"
            gameState="playing"
          />

          {/* Move History */}
          <MoveHistory moves={moveHistory} />

          {/* AI Analysis */}
          <AIAnalysis analysis={analysis} />

          {/* Game Controls */}
          <GameControls
            onNewGame={handleNewGame}
            onResign={handleResign}
            onFlipBoard={handleFlipBoard}
          />
        </div>
      </div>
    </div>
  );
}
