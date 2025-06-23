import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    id?: number;
    created_at?: string;
}

export interface ChatContext {
    fen_before: string;
    move_san: string;
    pv: string;
    eval_cp: number | null;
    mate_in: number | null;
    explanation?: string;
}

export function useMoveChat(
    gameId: string | null,
    ply: number,
    context: ChatContext | undefined,
    open: boolean,
) {
    const queryClient = useQueryClient();
    const queryKey = ["moveChat", gameId ?? "live", ply];

    const query = useQuery<ChatMessage[]>({
        queryKey,
        queryFn: async () => {
            if (!gameId) return [];
            const r = await fetch(`/api/games/${gameId}/moves/${ply}/chat`);
            if (!r.ok) throw new Error("Failed to fetch chat");
            const json = await r.json();
            return json.messages as ChatMessage[];
        },
        staleTime: 0,
        enabled: !!gameId && open,
    });

    const mutation = useMutation({
        mutationFn: async (content: string) => {
            // temp id to ensure unique key
            const tempId = Date.now();
            queryClient.setQueryData<ChatMessage[]>(queryKey, (old = []) => [
                ...old,
                { role: "user", content, id: tempId },
            ]);

            const basePayload = { content, ...(context ?? {}) };
            const url = gameId
                ? `/api/games/${gameId}/moves/${ply}/chat`
                : "/api/chat";
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(basePayload),
            });
            if (!res.ok) throw new Error("Failed to send");
            const json = await res.json();
            // Update cache with assistant message
            queryClient.setQueryData<ChatMessage[]>(queryKey, (old = []) => [
                ...(old ?? []).map((m) => (m.id === tempId ? m : m)),
                { role: json.role as "assistant", content: json.content, id: tempId + 1 },
            ]);
            return json;
        },
        onError: () => {
            // rollback optimistic
            queryClient.invalidateQueries({ queryKey });
        },
    });

    return {
        messages: query.data ?? [],
        isLoading: query.isLoading,
        send: mutation.mutateAsync,
        sending: mutation.isPending,
    };
} 