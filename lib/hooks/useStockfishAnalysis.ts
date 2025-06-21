import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { analyzePosition, AnalysisResult } from '@/lib/engine/stockfish'

export interface StockfishAnalysis {
    analysisText: string
    bestMove: string | null
    thinking: boolean
}

/**
 * Evaluate the given position with Stockfish and memo-cache by normalised FEN.
 * Returns a human-readable analysis string and best move (LAN/UCi).
 */
export function useStockfishAnalysis(game: Chess, depth = 18): StockfishAnalysis {
    const fen = game.fen()
    const normalisedFen = useMemo(() => fen.split(' ').slice(0, 4).join(' '), [fen])

    const cache = useRef<Map<string, { text: string; best: string | null }>>(new Map())

    const [state, setState] = useState<StockfishAnalysis>({
        analysisText: 'Evaluating…',
        bestMove: null,
        thinking: false,
    })

    useEffect(() => {
        let cancelled = false

        const cached = cache.current.get(normalisedFen)
        if (cached) {
            setState({ analysisText: cached.text, bestMove: cached.best, thinking: false })
            return
        }

        async function run() {
            setState((s) => ({ ...s, thinking: true }))
            try {
                const res: AnalysisResult = await analyzePosition(fen, depth)
                if (cancelled) return

                let text = ''
                if (res.mateIn !== undefined) {
                    text = `Mate in ${res.mateIn}`
                } else if (res.evaluationCp !== undefined) {
                    const cp = (game.turn() === 'w' ? 1 : -1) * (res.evaluationCp / 100)
                    text = `Eval: ${cp.toFixed(2)} | Depth: ${res.depth}`
                } else {
                    text = 'Eval unavailable'
                }

                cache.current.set(normalisedFen, { text, best: res.bestMove })
                setState({ analysisText: text, bestMove: res.bestMove ?? null, thinking: false })
            } catch {
                if (!cancelled) setState({ analysisText: 'Engine error', bestMove: null, thinking: false })
            }
        }
        run()

        return () => {
            cancelled = true
        }
    }, [normalisedFen, fen, game, depth])

    return state
} 