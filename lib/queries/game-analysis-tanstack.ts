import { useQuery } from "@tanstack/react-query";

export interface PlyAnalysis {
    explanation: string;
    best_move: string | null;
    eval_cp: number | null;
    mate_in: number | null;
    pv: string | null;
    status?: 'pending' | 'engine_complete' | 'complete' | string;
}

export const gameAnalysisKey = (gameId: string) => ["game-analysis", gameId] as const;

export function useGameAnalysis(gameId: string | undefined) {
    return useQuery({
        queryKey: gameId ? gameAnalysisKey(gameId) : ["game-analysis"],
        queryFn: async () => {
            if (!gameId) return [];
            const response = await fetch(`/api/games/${gameId}/analysis`);
            if (!response.ok) {
                throw new Error(`Failed to fetch analysis: ${response.status}`);
            }
            const json = await response.json();
            return json.analysis;
        },
        enabled: !!gameId,
        // staleTime: 1000 * 60 * 60,
    });
} 