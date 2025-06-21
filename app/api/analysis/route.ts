import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function POST(req: NextRequest) {
    try {
        const { fen, gameHistory, pv } = await req.json();

        if (!fen || !gameHistory || !pv) {
            return NextResponse.json({ error: "Missing 'fen' or 'lastMoveSan' in request body" }, { status: 400 });
        }

        console.log("Position (FEN): ", fen);
        console.log("Full game history:", gameHistory);
        console.log("Principal variation:", pv);

        // Craft a concise prompt for the LLM
        const prompt = `You are a grandmaster-level chess coach giving advice to the WHITE player.

For each position, you will:
1. Evaluate the quality and impact of the last move in one short sentence (≤15 words).
2. ONLY IF WHITE MADE THE LAST MOVE, advise White on the best plan or next move in the current position, in one short sentence (≤15 words). If the last move was blacks's, do not advise.

Here are some examples:

Example 1:
Position (FEN): "5br1/1p3kp1/p2Pbp1p/3N4/3QP3/P1P1B3/1q3PPP/R3R1K1 w - - 1 24"
Full game history: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nge7 4. O-O a6 5. Bxc6 Nxc6 6. d4 exd4 7. Nxd4 Nxd4 8. Qxd4 d6 9. Nc3 Be6 10. Re1 Qd7 11. Be3 Rc8 12. Qa7 c5 13. a3 Qc7 14. b4 Qc6 15. bxc5 h6 16. Nd5 f6 17. cxd6 Kf7 18. Ne7 Qd7 19. Nxc8 Rg8 20. Nb6 Qb5 21. Nd5 Qb2 22. Qd4 Qb5 23. c3 Qb2"
Principal variation: "a1b1 b2b1 e1b1 b7b6 d4b6 e6d5 b6c7 f7g6 f2f3 d5e6"
Evaluation: Black's queen is deep on your side and vulnerable; you have a clear tactical shot.
Advice: Play Rab1 immediately, attacking the exposed queen and forcing a winning material exchange after Qxb1 Rxb1.

Complete the following analysis:
Position (FEN): "${fen}"
Full game history: "${gameHistory}"
Principal variation: "${pv}"
`;

        const result = await generateText({
            model: openai("gpt-4o"),
            prompt,
        });

        // "text" contains the generated string according to the ai SDK typings
        const analysis = (result as { text: string }).text ?? "Unable to generate analysis.";

        return NextResponse.json({ analysis });
    } catch (err) {
        console.error("/api/analysis error", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
