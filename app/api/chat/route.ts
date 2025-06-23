import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { pawnPilotSystemPrompt } from "@/lib/prompts";
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const fen = body?.fen ?? body?.fen_before as string | undefined;
        const gameHistory = body?.gameHistory as string | undefined;
        const pv = body?.pv as string | undefined;
        const moveSan = body?.move_san as string | undefined;
        const evalCp = body?.eval_cp as number | undefined;
        const mateIn = body?.mate_in as number | undefined;
        const messages = (body?.messages as { role: string; content: string }[]) ?? [];
        const content = body?.content as string | undefined; // current user message

        if (!fen || !content) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        const contextLines = [
            `Position (FEN): ${fen}`,
            moveSan ? `Played move: ${moveSan}` : null,
            evalCp !== undefined ? `Stockfish eval: ${evalCp}` : null,
            mateIn !== undefined ? `Mate in: ${mateIn}` : null,
            pv ? `PV line: ${pv}` : null,
            gameHistory ? `Game History: ${gameHistory}` : null,
        ];

        const systemPrompt = pawnPilotSystemPrompt(contextLines);

        const allMsgs = [...messages, { role: "user", content }];

        const result = await generateText({
            model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
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