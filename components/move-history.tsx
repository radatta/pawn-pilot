"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

interface Move {
  moveNumber: number;
  white: string;
  black?: string;
}

interface MoveHistoryProps {
  moves: Move[];
  /** Index (0-based) of the current ply. */
  currentPly?: number;
  /** Callback when the user clicks a move ply index. */
  onSelect?: (ply: number) => void;
}

export function MoveHistory({ moves, currentPly = -1, onSelect }: MoveHistoryProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Move History</h3>
      <ScrollArea className="h-48 w-full rounded-lg border bg-card/50 p-3">
        <div className="space-y-1">
          {moves.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No moves yet</p>
          ) : (
            moves.map((move) => {
              const whiteIdx = (move.moveNumber - 1) * 2;
              const blackIdx = whiteIdx + 1;

              const whiteActive = currentPly === whiteIdx;
              const blackActive = currentPly === blackIdx;

              return (
                <div key={move.moveNumber} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-6">{move.moveNumber}.</span>

                  <button
                    type="button"
                    className={`font-mono ${
                      whiteActive ? "text-primary" : "text-foreground"
                    }`}
                    onClick={() => onSelect?.(whiteIdx)}
                    disabled={!onSelect}
                  >
                    {move.white}
                  </button>

                  {move.black && (
                    <button
                      type="button"
                      className={`font-mono ${
                        blackActive ? "text-primary" : "text-foreground"
                      }`}
                      onClick={() => onSelect?.(blackIdx)}
                      disabled={!onSelect}
                    >
                      {move.black}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
