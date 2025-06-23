import { useQuery } from "@tanstack/react-query";

export const gameAnalysisKey = (id: string) => ["gameAnalysis", id] as const;

export function useGameAnalysis(gameId: string | undefined) {
    return useQuery({
        queryKey: gameAnalysisKey(gameId ?? ""),
        queryFn: async () => {
            if (!gameId) return null;
            const res = await fetch(`/api/games/${gameId}/analysis`, { method: "GET" });
            if (!res.ok) {
                throw new Error("Failed to fetch analysis");
            }
            const json = (await res.json()) as { analysis: string[] };
            return json.analysis;
        },
        enabled: !!gameId,
        staleTime: 1000 * 60 * 60,
    });
} 