import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { analyzePosition } from '@/lib/engine/stockfish'
import { useDebouncedCallback } from 'use-debounce'

export interface StockfishAnalysis {
    analysisText: string
    bestMove: string | null
    thinking: boolean
}

function movesArrayToString(moves: string[]) {
    const result: string[] = [];
    for (let i = 0; i < moves.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = moves[i];
        const blackMove = moves[i + 1] || "";
        result.push(`${moveNumber}. ${whiteMove}${blackMove ? " " + blackMove : ""}`);
    }
    return result.join(" ");
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

    // Create a debounced analysis function.  It will run only once the
    // position has been stable for 1000 ms, regardless of how many times it
    // is invoked during rapid navigation.
    const debouncedAnalyze = useDebouncedCallback(async (targetFen: string, normFen: string) => {
        setState((s) => ({ ...s, thinking: true }))

        try {
            const engineRes = await analyzePosition(targetFen, depth)

            const llmRes = await fetch("/api/analysis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fen: targetFen,
                    gameHistory: movesArrayToString(game.history()),
                    pv: engineRes.pv,
                }),
            })
                .then((r) => r.json())
                .then((j) => (j.analysis as string | undefined) ?? "Analysis unavailable");


            // Build details line (best move + evaluation)
            const detailsParts: string[] = [];
            if (engineRes.bestMove) detailsParts.push(`Best: ${engineRes.bestMove}`);

            if (engineRes.mateIn !== undefined) {
                detailsParts.push(`Mate in ${engineRes.mateIn}`);
            } else if (engineRes.evaluationCp !== undefined) {
                const cp = (game.turn() === "w" ? 1 : -1) * (engineRes.evaluationCp / 100);
                detailsParts.push(`Eval: ${cp.toFixed(2)}`);
            }

            const text = detailsParts.length ? `${llmRes}\n${detailsParts.join(" | ")}` : llmRes;

            cache.current.set(normFen, { text, best: engineRes.bestMove })
            setState({ analysisText: text, bestMove: engineRes.bestMove ?? null, thinking: false })
        } catch (err) {
            console.error("useStockfishAnalysis error", err)
            setState({ analysisText: "Analysis error", bestMove: null, thinking: false })
        }
    }, 1000)

    useEffect(() => {
        const cached = cache.current.get(normalisedFen)
        if (cached) {
            setState({ analysisText: cached.text, bestMove: cached.best, thinking: false })
            return
        }

        debouncedAnalyze(fen, normalisedFen)

        // Cancel pending debounced callback if the component unmounts or the
        // dependencies change before the timer fires.
        return () => {
            debouncedAnalyze.cancel()
        }
    }, [normalisedFen, fen, debouncedAnalyze])

    return state
} 