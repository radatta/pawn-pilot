import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function POST(req: NextRequest) {
    try {
        const { fen, lastMoveSan } = await req.json();

        if (!fen || !lastMoveSan) {
            return NextResponse.json({ error: "Missing 'fen' or 'lastMoveSan' in request body" }, { status: 400 });
        }

        console.log("lastMoveSan", lastMoveSan, fen);

        // Craft a concise prompt for the LLM
        const prompt = `You are a grandmaster-level chess coach giving advice to the WHITE player.

For each position, you will:
1. Repeat the full move sequence so far in SAN, ending with White's last move.
2. Evaluate the quality and impact of White's last move in one short sentence (≤15 words).
3. Advise White on the best plan or next move in the current position, in one short sentence (≤15 words).

Here are some examples:

Example 1:
Position (FEN): "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
Move sequence: (none yet)
White's last move (SAN): "e4"
Move sequence: 1. e4
Evaluation: Solid central control, opening theory.
Advice: Develop your kingside knight to f3.

Example 2:
Position (FEN): "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
Move sequence: 1. e4 e5 2. Nf3 Nf6
White's last move (SAN): "Nc3"
Move sequence: 1. e4 e5 2. Nf3 Nf6 3. Nc3
Evaluation: Good development, supports the center.
Advice: Consider d4 to challenge Black's center.

Now answer for this position:
Position (FEN): "${fen}"
White's last move (SAN): "${lastMoveSan}"

1. Evaluation:
2. Advice:`;

        const result = await generateText({
            model: openai("gpt-3.5-turbo-instruct"),
            prompt,
        });

        // "text" contains the generated string according to the ai SDK typings
        const analysis = (result as { text: string }).text ?? "Unable to generate analysis.";
        console.log("analysis", analysis);

        return NextResponse.json({ analysis });
    } catch (err) {
        console.error("/api/analysis error", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
// Move sequence: ${moveSequence}
// 