import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const fen = body?.fen as string | undefined;
        const gameHistory = body?.gameHistory as string | undefined;
        const pv = body?.pv as string | undefined;
        const messages = (body?.messages as { role: string; content: string }[]) ?? [];
        const content = body?.content as string | undefined; // current user message

        if (!fen || !gameHistory || !content) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        const systemPrompt = `You are PawnPilot, a grand-master chess coach.
Context:\n• Position (FEN): ${fen}\n• Game History: ${gameHistory}\n• PV line: ${pv ?? ""}\n\nAnswer questions in ≤3 sentences unless asked for more detail.`;

        const allMsgs = [...messages, { role: "user", content }];

        const result = await generateText({
            model: openai("gpt-4o"),
            system: systemPrompt,
            messages: allMsgs as any,
        });


        const assistantText = (result as any).text ?? "(error)";

        return NextResponse.json({ role: "assistant", content: assistantText });
    } catch (e) {
        console.error("/api/chat error", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
} 