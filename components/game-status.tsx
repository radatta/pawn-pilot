"use client";

import { useState, useEffect } from "react";
import { Clock, User, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GameStatusProps {
  currentPlayer: "white" | "black";
  playerColor: "white" | "black";
  gameState: "playing" | "check" | "checkmate" | "stalemate" | "draw";
  whiteTimeRemaining?: number;
  blackTimeRemaining?: number;
  onTimeUpdate?: (white: number, black: number) => void;
  gameOver?: boolean;
}

export function GameStatus({
  currentPlayer,
  playerColor,
  gameState,
  whiteTimeRemaining = 300,
  blackTimeRemaining = 300,
  onTimeUpdate,
  gameOver = false,
}: GameStatusProps) {
  const [whiteTime, setWhiteTime] = useState(whiteTimeRemaining);
  const [blackTime, setBlackTime] = useState(blackTimeRemaining);

  const isPlayerTurn = currentPlayer === playerColor;

  // Update local state when props change
  useEffect(() => {
    setWhiteTime(whiteTimeRemaining);
    setBlackTime(blackTimeRemaining);
  }, [whiteTimeRemaining, blackTimeRemaining]);

  // Handle countdown timer
  useEffect(() => {
    if (
      gameOver ||
      gameState === "checkmate" ||
      gameState === "stalemate" ||
      gameState === "draw"
    ) {
      return;
    }

    const interval = setInterval(() => {
      if (currentPlayer === "white" && whiteTime > 0) {
        const newTime = whiteTime - 1;
        setWhiteTime(newTime);
        if (onTimeUpdate) {
          onTimeUpdate(newTime, blackTime);
        }
        if (newTime === 0) {
          // Handle time out - white loses
          clearInterval(interval);
        }
      } else if (currentPlayer === "black" && blackTime > 0) {
        const newTime = blackTime - 1;
        setBlackTime(newTime);
        if (onTimeUpdate) {
          onTimeUpdate(whiteTime, newTime);
        }
        if (newTime === 0) {
          // Handle time out - black loses
          clearInterval(interval);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPlayer, whiteTime, blackTime, onTimeUpdate, gameOver, gameState]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    if (whiteTime === 0) return "White out of time!";
    if (blackTime === 0) return "Black out of time!";
    if (gameState === "check") return "Check!";
    if (gameState === "checkmate") return "Checkmate!";
    if (gameState === "stalemate") return "Stalemate";
    if (gameState === "draw") return "Draw";
    return isPlayerTurn ? "Your Turn" : "AI's Turn";
  };

  const getStatusColor = () => {
    if (whiteTime === 0 || blackTime === 0) return "destructive";
    if (gameState === "check") return "destructive";
    if (gameState === "checkmate") return "destructive";
    if (gameState === "stalemate" || gameState === "draw") return "secondary";
    return isPlayerTurn ? "default" : "secondary";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant={getStatusColor()} className="text-sm px-3 py-1">
          {getStatusText()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
            currentPlayer === "white" && !gameOver
              ? "bg-primary/10 border-primary/30"
              : "bg-card/50 border-border"
          }`}
        >
          <User className="w-4 h-4" />
          <div className="flex flex-col flex-1">
            <span className="text-xs text-muted-foreground">You</span>
            <span className="text-sm font-medium">White</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-mono">
            <Clock className="w-3 h-3" />
            <span className={whiteTime < 30 ? "text-destructive" : ""}>
              {formatTime(whiteTime)}
            </span>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
            currentPlayer === "black" && !gameOver
              ? "bg-primary/10 border-primary/30"
              : "bg-card/50 border-border"
          }`}
        >
          <Bot className="w-4 h-4" />
          <div className="flex flex-col flex-1">
            <span className="text-xs text-muted-foreground">PawnPilot</span>
            <span className="text-sm font-medium">Black</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-mono">
            <Clock className="w-3 h-3" />
            <span className={blackTime < 30 ? "text-destructive" : ""}>
              {formatTime(blackTime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
