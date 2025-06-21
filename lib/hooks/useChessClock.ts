import { useCallback, useRef, useState } from 'react'

export interface ClockEntry {
    white: number
    black: number
}

export interface UseChessClockOptions {
    start: number // seconds
    increment: number // increment per move (seconds)
}

export interface UseChessClockReturn {
    white: number
    black: number
    history: ClockEntry[]
    lastMoveTs: Date | null
    tick: (color: 'w' | 'b', elapsed: number) => ClockEntry // returns new entry
    load: (entry: { white: number; black: number; last_move_timestamp?: string; clock_history?: ClockEntry[] }) => void
}

export function useChessClock(opts: UseChessClockOptions): UseChessClockReturn {
    const [white, setWhite] = useState(opts.start)
    const [black, setBlack] = useState(opts.start)
    const [history, setHistory] = useState<ClockEntry[]>([{ white: opts.start, black: opts.start }])
    const lastMove = useRef<Date | null>(null)

    const tick = useCallback(
        (color: 'w' | 'b', elapsed: number) => {
            let newWhite = white
            let newBlack = black
            if (color === 'w') {
                newWhite = Math.max(0, white - elapsed) + opts.increment
            } else {
                newBlack = Math.max(0, black - elapsed) + opts.increment
            }
            setWhite(newWhite)
            setBlack(newBlack)
            const entry = { white: newWhite, black: newBlack }
            setHistory((h) => [...h, entry])
            lastMove.current = new Date()
            return entry
        },
        [white, black, opts.increment],
    )

    const load = useCallback((data: { white: number; black: number; last_move_timestamp?: string; clock_history?: ClockEntry[] }) => {
        setWhite(data.white)
        setBlack(data.black)
        if (data.clock_history) setHistory(data.clock_history)
        if (data.last_move_timestamp) lastMove.current = new Date(data.last_move_timestamp)
    }, [])

    return {
        white,
        black,
        history,
        lastMoveTs: lastMove.current,
        tick,
        load,
    }
} 