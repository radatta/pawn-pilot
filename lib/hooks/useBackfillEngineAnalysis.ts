import { useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { analyzePosition } from "@/lib/engine/stockfish";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlyAnalysis, gameAnalysisKey } from "@/lib/queries/game-analysis-tanstack";

interface UseBackfillEngineOptions {
    gameId: string | null;
    sanHistory: string[];
    analysis: PlyAnalysis[] | undefined | null;
    onAnalysisComplete?: () => void;
}

// Runs client-side Stockfish to fill in missing best_move/eval_cp/mate_in/pv data
// Then triggers LLM analysis for moves with engine data but empty explanations
export function useBackfillEngineAnalysis({ gameId, sanHistory, analysis, onAnalysisComplete }: UseBackfillEngineOptions) {
    const queryClient = useQueryClient();

    const uploadMutation = useMutation({
        mutationFn: async (updates: { move_number: number; best_move: string; eval_cp?: number; mate_in?: number; pv?: string }[]) => {
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
                    const response = await fetch(`/api/games/${gameId}/analysis`, { method: "POST" });
                    if (response.ok) {
                        queryClient.invalidateQueries({ queryKey: gameAnalysisKey(gameId) });
                        console.log("LLM analysis completed");
                        onAnalysisComplete?.();
                    }
                } catch (err) {
                    console.error("Failed to trigger LLM analysis:", err);
                }
            }
        },
    });

    const startedRef = useRef(false);

    useEffect(() => {
        startedRef.current = false;
    }, [analysis]);

    useEffect(() => {
        if (!gameId || !analysis || sanHistory.length === 0 || startedRef.current) return;

        const missingEngineData = analysis
            .map((row, i) => (!row.best_move ? i : -1))
            .filter((i) => i !== -1);

        if (missingEngineData.length === 0) return;

        console.log(`Backfilling engine data for ${missingEngineData.length} moves`);
        startedRef.current = true;
        let cancelled = false;

        (async () => {
            const chess = new Chess();
            const updates: { move_number: number; best_move: string; eval_cp?: number; mate_in?: number; pv?: string }[] = [];

            for (let i = 0; i < sanHistory.length && !cancelled; i++) {
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
                    console.error(`Stockfish error for move ${i + 1}:`, err);
                }
            }

            if (!cancelled && updates.length) {
                uploadMutation.mutate(updates);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [gameId, sanHistory.length]);
} 