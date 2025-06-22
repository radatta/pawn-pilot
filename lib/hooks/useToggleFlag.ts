import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useToggleFlag(gameId?: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ ply, currentlyFlagged }: { ply: number; currentlyFlagged: boolean }) => {
            if (!gameId) return;
            const method = currentlyFlagged ? "DELETE" : "POST";
            await fetch(`/api/games/${gameId}/flags`, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ply }),
            });
        },
        onMutate: async (vars) => {
            await qc.cancelQueries({ queryKey: ["flagged", gameId] });
            const prev = qc.getQueryData<number[]>(["flagged", gameId]);
            qc.setQueryData<number[]>(["flagged", gameId], (old = []) => {
                if (vars.currentlyFlagged) return old.filter((p) => p !== vars.ply);
                return [...old, vars.ply];
            });
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) qc.setQueryData(["flagged", gameId], ctx.prev);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: ["flagged", gameId] }),
    });
} 