"use client"

import { Clock, User, Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface GameStatusProps {
  currentPlayer: "white" | "black"
  playerColor: "white" | "black"
  gameState: "playing" | "check" | "checkmate" | "stalemate" | "draw"
}

export function GameStatus({ currentPlayer, playerColor, gameState }: GameStatusProps) {
  const isPlayerTurn = currentPlayer === playerColor
  const isAITurn = currentPlayer !== playerColor

  const getStatusText = () => {
    if (gameState === "check") return "Check!"
    if (gameState === "checkmate") return "Checkmate!"
    if (gameState === "stalemate") return "Stalemate"
    if (gameState === "draw") return "Draw"
    return isPlayerTurn ? "Your Turn" : "AI's Turn"
  }

  const getStatusColor = () => {
    if (gameState === "check") return "destructive"
    if (gameState === "checkmate") return "destructive"
    if (gameState === "stalemate" || gameState === "draw") return "secondary"
    return isPlayerTurn ? "default" : "secondary"
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant={getStatusColor()} className="text-sm px-3 py-1">
          {getStatusText()}
        </Badge>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>5:00</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
            isPlayerTurn ? "bg-primary/10 border-primary/30" : "bg-card/50 border-border"
          }`}
        >
          <User className="w-4 h-4" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">You</span>
            <span className="text-sm font-medium">White</span>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
            isAITurn ? "bg-primary/10 border-primary/30" : "bg-card/50 border-border"
          }`}
        >
          <Bot className="w-4 h-4" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">PawnPilot</span>
            <span className="text-sm font-medium">Black</span>
          </div>
        </div>
      </div>
    </div>
  )
}
