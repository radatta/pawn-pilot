"use client"

import { ScrollArea } from "@/components/ui/scroll-area"

interface Move {
  moveNumber: number
  white: string
  black?: string
}

interface MoveHistoryProps {
  moves: Move[]
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Move History</h3>
      <ScrollArea className="h-48 w-full rounded-lg border bg-card/50 p-3">
        <div className="space-y-1">
          {moves.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No moves yet</p>
          ) : (
            moves.map((move) => (
              <div key={move.moveNumber} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-6">{move.moveNumber}.</span>
                <span className="text-foreground font-mono">{move.white}</span>
                {move.black && <span className="text-foreground font-mono">{move.black}</span>}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
