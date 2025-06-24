import { useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { analyzePosition } from "@/lib/engine/stockfish";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlyAnalysis, gameAnalysisKey } from "@/lib/queries/game-analysis-tanstack";
import { AnalysisState } from "./useAnalysisState";

interface UseBackfillEngineOptions {
    gameId: string | null;
    sanHistory: string[];
    analysis: PlyAnalysis[] | undefined | null;
    analysisState: AnalysisState;
    onStateChange?: (newState: AnalysisState) => void;
}

// Runs client-side Stockfish to fill in missing best_move/eval_cp/mate_in/pv data
// Then triggers LLM analysis for moves with engine data but no explanations
export function useBackfillEngineAnalysis({
    gameId,
    sanHistory,
    analysis,
    analysisState,
    onStateChange
}: UseBackfillEngineOptions) {
    const queryClient = useQueryClient();
    const abortControllerRef = useRef<AbortController | null>(null);

    const uploadMutation = useMutation({
        mutationFn: async (updates: { move_number: number; best_move: string; eval_cp?: number; mate_in?: number; pv?: string; status: string }[]) => {
            if (!gameId) return;
            const response = await fetch(`/api/games/${gameId}/analysis`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        },
        onSuccess: async () => {
            if (gameId) {
                try {
                    console.log("Engine data stored, triggering LLM analysis");
                    onStateChange?.('waiting-llm');
                    const response = await fetch(`/api/games/${gameId}/analysis`, { method: "POST" });
                    if (response.ok) {
                        queryClient.invalidateQueries({ queryKey: gameAnalysisKey(gameId) });
                        console.log("LLM analysis completed");
                    }
                } catch (err) {
                    console.error("Failed to trigger LLM analysis:", err);
                    onStateChange?.('error');
                }
            }
        },
        onError: () => {
            onStateChange?.('error');
        }
    });

    const startedRef = useRef(false);

    // Reset started flag when analysis data or state changes
    useEffect(() => {
        startedRef.current = false;
    }, [analysis, analysisState]);

    // Only run backfill when in the appropriate state
    useEffect(() => {
        if (analysisState !== 'backfilling-engine') return;
        if (!gameId || !analysis || sanHistory.length === 0 || startedRef.current) return;

        const missingEngineData = analysis
            .map((row, i) => (!row.best_move || !row.pv ? i : -1))
            .filter((i) => i !== -1);

        if (missingEngineData.length === 0) {
            // If no missing engine data but we're in backfilling state,
            // we should move to the next state
            onStateChange?.('waiting-llm');
            return;
        }

        console.log(`Backfilling engine data for ${missingEngineData.length} moves`);
        startedRef.current = true;

        // Create abort controller for this run
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        (async () => {
            const chess = new Chess();
            const updates: { move_number: number; best_move: string; eval_cp?: number; mate_in?: number; pv?: string; status: string }[] = [];

            for (let i = 0; i < sanHistory.length && !signal.aborted; i++) {
                const san = sanHistory[i];
                chess.move(san);
                if (!missingEngineData.includes(i)) continue;

                try {
                    const res = await analyzePosition(chess.fen(), 18);
                    updates.push({
                        move_number: i + 1,
                        best_move: res.bestMove,
                        eval_cp: res.evaluationCp,
                        mate_in: res.mateIn,
                        pv: res.pv,
                        status: 'engine_complete' // Mark as engine complete but waiting for LLM
                    });

                    // Update cache optimistically
                    queryClient.setQueryData(gameAnalysisKey(gameId), (old: PlyAnalysis[] | undefined) => {
                        if (!old) return old;
                        const copy = [...old];
                        const row = copy[i] ?? { explanation: "", best_move: null, eval_cp: null, mate_in: null, pv: null };
                        copy[i] = {
                            ...row,
                            best_move: res.bestMove,
                            eval_cp: res.evaluationCp ?? null,
                            mate_in: res.mateIn ?? null,
                            pv: res.pv ?? null,
                        };
                        return copy;
                    });
                } catch (err) {
                    if (signal.aborted) break;
                    console.error(`Stockfish error for move ${i + 1}:`, err);
                }
            }

            if (!signal.aborted && updates.length) {
                uploadMutation.mutate(updates);
            }
        })();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, [gameId, sanHistory.length, analysis, analysisState, onStateChange, queryClient, uploadMutation]);
} 