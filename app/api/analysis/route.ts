import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { analysisPrompt } from "@/lib/prompts";

export async function POST(req: NextRequest) {
    try {
        const { fen, gameHistory, pv } = await req.json();

        if (!fen || !gameHistory || !pv) {
            return NextResponse.json({ error: "Missing 'fen' or 'lastMoveSan' in request body" }, { status: 400 });
        }

        // console.log("Position (FEN): ", fen);
        // console.log("Full game history:", gameHistory);
        // console.log("Principal variation:", pv);

        // Build centralized analysis prompt
        const prompt = analysisPrompt({ fen, gameHistory, pv });

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
