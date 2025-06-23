import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const fen = searchParams.get("fen");

        if (!fen) {
            return NextResponse.json({ error: "Missing 'fen' query parameter" }, { status: 400 });
        }

        // Prompt: suggest the strongest continuation from the current position
        const prompt = `You are a grandmaster-level chess coach.

Position (FEN): "${fen}"

Suggest the strongest continuation for the side to move and briefly explain why (≤30 words).`;

        const result = await generateText({ model: openai("gpt-4o"), prompt });
        // According to the ai SDK typings, the generated text is exposed via the "text" key
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const analysis = (result as any).text ?? "Unable to generate hint.";

        return NextResponse.json({ analysis });
    } catch (err) {
        console.error("/api/hint error", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
} 