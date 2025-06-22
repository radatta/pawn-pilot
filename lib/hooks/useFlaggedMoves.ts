import { useQuery } from "@tanstack/react-query";

export function useFlaggedMoves(gameId?: string) {
    return useQuery<number[]>({
        queryKey: ["flagged", gameId],
        queryFn: async () => {
            if (!gameId) return [];
            const res = await fetch(`/api/games/${gameId}/flags`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch flags");
            const json = (await res.json()) as { flagged: number[] };
            return json.flagged;
        },
        enabled: !!gameId,
        staleTime: 30_000,
    });
} 