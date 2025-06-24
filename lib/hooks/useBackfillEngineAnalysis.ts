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

// Runs client-side Stockfish to fill in missing best_move/eval_cp/mate_in
export function useBackfillEngineAnalysis({ gameId, sanHistory, analysis, onAnalysisComplete }: UseBackfillEngineOptions) {
    const queryClient = useQueryClient();


    const uploadMutation = useMutation({
        mutationFn: async (updates: { move_number: number; best_move: string; eval_cp?: number; mate_in?: number }[]) => {
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
        onSuccess: () => {
            onAnalysisComplete?.();
        },
    });
    const uploadMutationRef = useRef(uploadMutation);
    uploadMutationRef.current = uploadMutation;

    const startedRef = useRef(false);

    // Reset started flag when analysis data changes
    useEffect(() => {
        startedRef.current = false;
    }, [analysis]);

    useEffect(() => {
        if (!gameId || !analysis || sanHistory.length === 0 || startedRef.current) return;

        const snapshot = analysis;
        const missing = snapshot
            .map((row, i) => (!row.best_move ? i : -1))
            .filter((i) => i !== -1);
        if (missing.length === 0) return;

        startedRef.current = true;
        let cancelled = false;

        (async () => {
            const chess = new Chess();
            const updates: { move_number: number; best_move: string; eval_cp?: number; mate_in?: number }[] = [];
            for (let i = 0; i < sanHistory.length && !cancelled; i++) {
                const san = sanHistory[i];
                chess.move(san);
                if (!missing.includes(i)) continue;

                try {
                    const res = await analyzePosition(chess.fen(), 12);
                    updates.push({
                        move_number: i + 1,
                        best_move: res.bestMove,
                        eval_cp: res.evaluationCp,
                        mate_in: res.mateIn,
                    });

                    // optimistic cache update
                    queryClient.setQueryData(gameAnalysisKey(gameId), (old: PlyAnalysis[] | undefined) => {
                        if (!old) return old;
                        const copy = [...old];
                        const row = copy[i] ?? { explanation: "", best_move: null, eval_cp: null, mate_in: null };
                        copy[i] = { ...row, best_move: res.bestMove, eval_cp: res.evaluationCp ?? null, mate_in: res.mateIn ?? null };
                        return copy;
                    });
                } catch (err) {
                    console.error("Stockfish backfill error", err);
                }
            }

            console.log("useBackfillEngineAnalysis - updates", cancelled, updates.length);
            if (!cancelled && updates.length) {
                uploadMutationRef.current.mutate(updates);
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId, sanHistory.length]);
} 