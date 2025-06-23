import { useQuery } from "@tanstack/react-query";

export function useHint(fen: string, enabled: boolean) {
    return useQuery<{ analysis: string }>({
        queryKey: ["hint", fen],
        queryFn: () =>
            fetch(`/api/hint?fen=${encodeURIComponent(fen)}`).then((r) => {
                if (!r.ok) throw new Error("Failed to fetch hint");
                return r.json();
            }),
        enabled,
        staleTime: 60_000,
    });
} 