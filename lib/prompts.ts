// Centralized prompt templates and helpers for PawnPilot
// ------------------------------------------------------
// All server routes that interact with the LLM should import their prompts
// from this file so we have a single source-of-truth for wording. Keeping
// them here makes it straightforward to iterate on tone and instructions
// without touching multiple files.

// -------------------------------------------------------------------------
// Generic helper to format the standard PawnPilot system prompt given a list
// of context lines. Each item will be rendered as a bullet ("• <line>").
// -------------------------------------------------------------------------
export function pawnPilotSystemPrompt(context: string | (string | null | undefined)[]): string {
    const lines = Array.isArray(context)
        ? (context.filter(Boolean) as string[])
        : [context].filter(Boolean) as string[];

    return `You are PawnPilot, a grand-master chess coach.
Context:
• ${lines.join("\n• ")}

Answer questions in ≤3 sentences unless asked for more detail.`;
}

// -------------------------------------------------------------------------
// Hint prompt – suggest the strongest continuation for the current side.
// -------------------------------------------------------------------------
export function hintPrompt(fen: string): string {
    return `You are a grandmaster-level chess coach.

Position (FEN): "${fen}"

Suggest the strongest continuation for the side to move and briefly explain why (≤30 words).`;
}

// -------------------------------------------------------------------------
// Position / game analysis prompt. This is shared by the single-position
// /api/analysis route and the batch variant under /games/[id]/analysis.
// -------------------------------------------------------------------------
export function analysisPrompt({
    fen,
    gameHistory,
    pv
}: {
    fen: string;
    gameHistory: string;
    pv: string;
}): string {
    return `You are a grandmaster-level chess coach giving advice to the WHITE player.

For each position, you will:
1. Evaluate the quality and impact of the last move in one short sentence (≤15 words).
2. ONLY IF WHITE MADE THE LAST MOVE, advise White on the best plan or next move in the current position, in one short sentence (≤15 words). If the last move was blacks's, do not advise.

Here is an example:

Example 1:
Position (FEN): "5br1/1p3kp1/p2Pbp1p/3N4/3QP3/P1P1B3/1q3PPP/R3R1K1 w - - 1 24"
Full game history: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nge7 4. O-O a6 5. Bxc6 Nxc6 6. d4 exd4 7. Nxd4 Nxd4 8. Qxd4 d6 9. Nc3 Be6 10. Re1 Qd7 11. Be3 Rc8 12. Qa7 c5 13. a3 Qc7 14. b4 Qc6 15. bxc5 h6 16. Nd5 f6 17. cxd6 Kf7 18. Ne7 Qd7 19. Nxc8 Rg8 20. Nb6 Qb5 21. Nd5 Qb2 22. Qd4 Qb5 23. c3 Qb2"
Principal variation: "a1b1 b2b1 e1b1 b7b6 d4b6 e6d5 b6c7 f7g6 f2f3 d5e6"
Evaluation: Black's queen is deep on your side and vulnerable; you have a clear tactical shot.
Advice: Play Rab1 immediately, attacking the exposed queen and forcing a winning material exchange after Qxb1 Rxb1.

Complete the following analysis:
Position (FEN): "${fen}"
Full game history: "${gameHistory}"
Principal variation: "${pv}"`;
} 