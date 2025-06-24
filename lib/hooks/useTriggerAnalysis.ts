import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gameAnalysisKey } from "@/lib/queries/game-analysis-tanstack";
import React from "react";

/**
 * useTriggerAnalysis
 * ------------------
 * Triggers batch analysis for a game and invalidates the cache when complete.
 * Works with the FSM approach to update analysis state.
 */
export function useTriggerAnalysis() {
    const queryClient = useQueryClient();
    const abortControllerRef = React.useRef<AbortController | null>(null);

    return useMutation<{ analysis: string[] }, Error, string>({
        mutationFn: async (gameId: string) => {
            // Cancel any in-progress request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            try {
                const res = await fetch(`/api/games/${gameId}/analysis`, {
                    method: "POST",
                    signal: abortControllerRef.current.signal
                });

                if (!res.ok) {
                    throw new Error("Analysis request failed");
                }

                return (await res.json()) as { analysis: string[] };
            } catch (err) {
                if ((err as Error).name === 'AbortError') {
                    return { analysis: [] };
                }
                throw err;
            }
        },
        onSuccess: (data, gameId) => {
            // Just invalidate the cache to trigger a fresh fetch
            queryClient.invalidateQueries({ queryKey: gameAnalysisKey(gameId) });

            // We don't set state to 'complete' here because we need to wait for the
            // invalidated query to refetch and then the useAnalysisState hook will
            // determine if we're actually complete
        },

    });
} 