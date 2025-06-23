"use client";

import { Button } from "@/components/ui/button";
import { RotateCcw, Flag, RefreshCw, Lightbulb } from "lucide-react";

interface GameControlsProps {
  onNewGame: () => void;
  onResign: () => void;
  onFlipBoard: () => void;
  onHint?: () => void;
  hintLoading?: boolean;
  disabled?: boolean;
}

export function GameControls({
  onNewGame,
  onResign,
  onFlipBoard,
  onHint,
  hintLoading = false,
  disabled = false,
}: GameControlsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Game Controls</h3>
      <div className={`grid gap-2 ${onHint ? "grid-cols-4" : "grid-cols-3"}`}>
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

        {onHint && (
          <Button
            variant="outline"
            size="sm"
            onClick={onHint}
            disabled={disabled || hintLoading}
            className="flex flex-col gap-1 h-auto py-3"
          >
            <Lightbulb className="w-4 h-4" />
            <span className="text-xs">{hintLoading ? "…" : "Hint"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
