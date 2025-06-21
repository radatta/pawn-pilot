export interface FormattedMove {
    moveNumber: number
    white: string
    black?: string
}

/**
 * Convert a flat SAN history list (['e4','e5',...]) into paired rows for display.
 */
export function formatMoveHistory(history: string[]): FormattedMove[] {
    const formatted: FormattedMove[] = []
    for (let i = 0; i < history.length; i += 2) {
        formatted.push({
            moveNumber: i / 2 + 1,
            white: history[i] as string,
            black: history[i + 1] as string | undefined,
        })
    }
    return formatted
} 