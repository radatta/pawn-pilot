"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Star } from "lucide-react";
import { MoveChatButton } from "@/components/move-chat-button";

interface Move {
  moveNumber: number;
  white: string;
  black?: string;
  whiteFlagged?: boolean;
  blackFlagged?: boolean;
}

interface MoveHistoryProps {
  moves: Move[];
  /** Index (0-based) of the current ply. */
  currentPly?: number;
  /** Callback when the user clicks a move ply index. */
  onSelect?: (ply: number) => void;
  /** Optional callback to toggle flag */
  onToggleFlag?: (ply: number, currentlyFlagged: boolean) => void;
  /** Optional callback to open chat */
  onChat?: (ply: number) => void;
}

export function MoveHistory({
  moves,
  currentPly = -1,
  onSelect,
  onToggleFlag,
  onChat,
}: MoveHistoryProps) {
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

                  <div className="flex items-center gap-1">
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
                    <button
                      type="button"
                      className={`p-0.5 ${
                        move.whiteFlagged ? "text-yellow-500" : "text-muted-foreground"
                      }`}
                      onClick={() => onToggleFlag?.(whiteIdx, !!move.whiteFlagged)}
                      disabled={!onToggleFlag}
                    >
                      <Star
                        size={14}
                        strokeWidth={1.5}
                        fill={move.whiteFlagged ? "currentColor" : "none"}
                      />
                    </button>
                  </div>

                  {move.black && (
                    <div className="flex items-center gap-1">
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
                      <button
                        type="button"
                        className={`p-0.5 ${
                          move.blackFlagged ? "text-yellow-500" : "text-muted-foreground"
                        }`}
                        onClick={() => onToggleFlag?.(blackIdx, !!move.blackFlagged)}
                        disabled={!onToggleFlag}
                      >
                        <Star
                          size={14}
                          strokeWidth={1.5}
                          fill={move.blackFlagged ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                  )}

                  {/* Chat button at end of row */}
                  {onChat && <MoveChatButton onClick={() => onChat(whiteIdx)} />}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
