import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { pawnPilotSystemPrompt } from "@/lib/prompts";
import { ChatRequestSchema } from "@/lib/validation/chat";
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
    try {
        const parse = ChatRequestSchema.partial({ explanation: true }).safeParse(await req.json());
        if (!parse.success) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }
        const {
            fen_before: fen,
            pv,
            move_san: moveSan,
            eval_cp: evalCp,
            mate_in: mateIn,
            content,
            // accept optional legacy
            gameHistory,
            messages = [],
        } = {
            gameHistory: (parse.data as any).gameHistory,
            messages: (parse.data as any).messages,
            ...parse.data,
        } as any;

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