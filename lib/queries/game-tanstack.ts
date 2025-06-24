// TanStack Query hooks for game operations
import { useQuery } from '@supabase-cache-helpers/postgrest-react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TypedSupabaseClient } from '@/lib/types'
import { getGameById } from '@/lib/queries/get-game-by-id'

export const gameKey = (id: string) => ['game', id] as const

// Always refetch on mount to ensure latest PGN and other fields
export const useGameById = (client: TypedSupabaseClient, id?: string) =>
    useQuery(getGameById(client, id ?? ''), {
        enabled: !!id,
        staleTime: 0,
        refetchOnMount: 'always',
    })

export const useCreateGame = () =>
    useMutation(async (body: { timeControl: number; increment: number }) => {
        const res = await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Failed to create game')
        return res.json() as Promise<{ id: string }>
    })

export const useUpdateGame = (gameId?: string) => {
    const qc = useQueryClient()
    return useMutation(
        async (payload: Record<string, unknown>) => {
            if (!gameId) throw new Error('gameId missing')
            const res = await fetch(`/api/games/${gameId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error('Failed to update game')
            return res.json()
        },
        {
            onSuccess: () => {
                if (gameId) qc.invalidateQueries(gameKey(gameId))
            },
        },
    )
} 