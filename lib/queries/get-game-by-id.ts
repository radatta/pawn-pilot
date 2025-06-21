import { TypedSupabaseClient } from '@/lib/types'

export function getGameById(client: TypedSupabaseClient, gameId: string) {
    return client
        .from('games')
        .select('*')
        .eq('id', gameId)
        .throwOnError()
        .single()
} 