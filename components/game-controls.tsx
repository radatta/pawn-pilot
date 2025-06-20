"use client"

import { Button } from "@/components/ui/button"
import { RotateCcw, Flag, RefreshCw } from "lucide-react"

interface GameControlsProps {
  onNewGame: () => void
  onResign: () => void
  onFlipBoard: () => void
  disabled?: boolean
}

export function GameControls({ onNewGame, onResign, onFlipBoard, disabled = false }: GameControlsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Game Controls</h3>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewGame}
          disabled={disabled}
          className="flex flex-col gap-1 h-auto py-3"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-xs">New Game</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onResign}
          disabled={disabled}
          className="flex flex-col gap-1 h-auto py-3"
        >
          <Flag className="w-4 h-4" />
          <span className="text-xs">Resign</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onFlipBoard}
          disabled={disabled}
          className="flex flex-col gap-1 h-auto py-3"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-xs">Flip Board</span>
        </Button>
      </div>
    </div>
  )
}
