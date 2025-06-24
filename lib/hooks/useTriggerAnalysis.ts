import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gameAnalysisKey, PlyAnalysis } from "@/lib/queries/game-analysis-tanstack";

/**
 * useTriggerAnalysis
 * ------------------
 * Returns a React-Query mutation that triggers the batch-analysis endpoint for a game.
 * On success it writes the returned analysis array directly into the cache under
 * gameAnalysisKey(gameId) so any subsequent page (e.g. /analysis) can read it instantly.
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
            // Transform the POST response (string[]) to match the GET response format (PlyAnalysis[])
            const transformedAnalysis: PlyAnalysis[] = data.analysis.map((explanation) => ({
                explanation,
                best_move: null,
                eval_cp: null,
                mate_in: null,
            }));

            // Cache the analysis so other components can access it immediately.
            queryClient.setQueryData(gameAnalysisKey(gameId), transformedAnalysis);
        },
    });
} 