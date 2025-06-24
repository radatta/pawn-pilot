import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gameAnalysisKey } from "@/lib/queries/game-analysis-tanstack";

/**
 * useTriggerAnalysis
 * ------------------
 * Triggers batch analysis for a game and invalidates the cache when complete.
 */
export function useTriggerAnalysis() {
    const queryClient = useQueryClient();

    return useMutation<{ analysis: string[] }, Error, string>({
        mutationFn: async (gameId: string) => {
            const res = await fetch(`/api/games/${gameId}/analysis`, { method: "POST" });
            if (!res.ok) {
                throw new Error("Analysis request failed");
            }
            return (await res.json()) as { analysis: string[] };
        },
        onSuccess: (data, gameId) => {
            // Just invalidate the cache to trigger a fresh fetch
            queryClient.invalidateQueries({ queryKey: gameAnalysisKey(gameId) });
        },
    });
} 