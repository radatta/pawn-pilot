import { TypedSupabaseClient } from '@/lib/types'

export function getGamesByUserId(client: TypedSupabaseClient, userId: string) {
    return client
        .from('games')
        .select(
            `
      id,
      created_at,
      result,
      status
    `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
}