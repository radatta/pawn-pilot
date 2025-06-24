import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { createSupabaseServer } from "@/lib/supabase/server";
import { pawnPilotSystemPrompt } from "@/lib/prompts";
import { ChatRequestSchema } from "@/lib/validation/chat";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
/* eslint-disable @typescript-eslint/no-explicit-any */

export const GET = withErrorHandling(async function GET(
    _req: NextRequest,
    {
        params,
    }: {
        params: { gameId: string; move: string };
    },
) {
    const { gameId, move } = await params;

    const moveNumber = parseInt(move, 10);
    if (!Number.isFinite(moveNumber) || moveNumber < 1) {
        return NextResponse.json({ error: "Invalid move number" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
        .from("move_chat")
        .select("id, role, content, created_at")
        .eq("game_id", gameId)
        .eq("move_number", moveNumber)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("[MoveChat] GET error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
});

export const POST = withErrorHandling(async function POST(
    req: NextRequest,
    { params }: { params: { gameId: string; move: string } },
) {
    const { gameId, move } = await params;
    const moveNumber = parseInt(move, 10);
    if (!Number.isFinite(moveNumber) || moveNumber < 1) {
        return NextResponse.json({ error: "Invalid move number" }, { status: 400 });
    }

    const body = await req.json();
    const supabase = await createSupabaseServer();

    // Handle AI SDK format (useChat sends { messages: [...] })
    if (body.messages && Array.isArray(body.messages)) {
        const { messages } = body;
        const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();

        if (!lastUserMessage || !lastUserMessage.content) {
            return NextResponse.json({ error: "No user message found" }, { status: 400 });
        }

        // Insert user message
        const { error: insertUserErr } = await supabase.from("move_chat").insert({
            game_id: gameId,
            move_number: moveNumber,
            role: "user",
            content: lastUserMessage.content,
        });
        if (insertUserErr) {
            console.error("[MoveChat] insert user error", insertUserErr);
        }

        // Extract context from body (sent via useChat body option)
        const {
            fen_before,
            move_san: suppliedMoveSan,
            pv: suppliedPv,
            eval_cp: suppliedEval,
            mate_in: suppliedMate,
            explanation: suppliedExplanation,
        } = body;

        // Fetch existing explanation / best move from move_analysis
        const { data: analysisRow } = await supabase
            .from("move_analysis")
            .select("explanation, best_move, eval_cp, mate_in")
            .eq("game_id", gameId)
            .eq("move_number", moveNumber)
            .single();

        const pv = suppliedPv;
        const evalCp = suppliedEval;
        const mateIn = suppliedMate;
        const explanation = suppliedExplanation ?? analysisRow?.explanation ?? "";

        // Build system prompt using centralized helper
        const systemPrompt = pawnPilotSystemPrompt([
            `FEN before move: ${fen_before}`,
            `Played move: ${suppliedMoveSan}`,
            `Stockfish eval: ${evalCp ?? "—"} | Mate: ${mateIn !== null ? "M" + mateIn : "—"}`,
            `PV line: ${pv ?? ""}`,
            `Existing explanation: ${explanation}`,
        ]);

        // Build message history (last 20 messages)
        const { data: history } = await supabase
            .from("move_chat")
            .select("role, content")
            .eq("game_id", gameId)
            .eq("move_number", moveNumber)
            .order("created_at", { ascending: true })
            .limit(20);

        const historyMsgs = (history ?? []).map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));

        // Use ai-sdk to generate assistant text as a stream

        const result = streamText({
            model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
            system: systemPrompt,
            messages: [...historyMsgs, ...messages] as any,
            onFinish: async (completion) => {
                // Persist assistant message once stream is complete
                const { error: insertAssistErr } = await supabase.from("move_chat").insert({
                    game_id: gameId,
                    move_number: moveNumber,
                    role: "assistant",
                    content: completion.text || "(error)",
                });
                if (insertAssistErr) {
                    console.error("[MoveChat] insert assistant error", insertAssistErr);
                }
            },
        });

        return result.toDataStreamResponse();
    }

    // Handle legacy format
    const parseResult = ChatRequestSchema.safeParse(body);
    if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const {
        content,
        fen_before: suppliedFen,
        move_san: suppliedMoveSan,
        pv: suppliedPv,
        eval_cp: suppliedEval,
        mate_in: suppliedMate,
        explanation: suppliedExplanation,
    } = parseResult.data;

    // Insert user message
    const { error: insertUserErr } = await supabase.from("move_chat").insert({
        game_id: gameId,
        move_number: moveNumber,
        role: "user",
        content,
    });
    if (insertUserErr) {
        console.error("[MoveChat] insert user error", insertUserErr);
    }

    // ------------------------------------------------------------------
    // Build context for assistant
    // ------------------------------------------------------------------
    const fen_before = suppliedFen;
    const sanMove = suppliedMoveSan;

    // Fetch existing explanation / best move from move_analysis
    const { data: analysisRow } = await supabase
        .from("move_analysis")
        .select("explanation, best_move, eval_cp, mate_in")
        .eq("game_id", gameId)
        .eq("move_number", moveNumber)
        .single();

    const pv = suppliedPv;
    const evalCp = suppliedEval;
    const mateIn = suppliedMate;
    const explanation = suppliedExplanation ?? analysisRow?.explanation ?? "";

    // Build system prompt using centralized helper
    const systemPrompt = pawnPilotSystemPrompt([
        `FEN before move: ${fen_before}`,
        `Played move: ${sanMove}`,
        `Stockfish eval: ${evalCp ?? "—"} | Mate: ${mateIn !== null ? "M" + mateIn : "—"}`,
        `PV line: ${pv ?? ""}`,
        `Existing explanation: ${explanation}`,
    ]);

    // Build message history (last 20 messages)
    const { data: history } = await supabase
        .from("move_chat")
        .select("role, content")
        .eq("game_id", gameId)
        .eq("move_number", moveNumber)
        .order("created_at", { ascending: true })
        .limit(20);

    const msgs = (history ?? []).map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));

    // Add current user content at end (already persisted)
    msgs.push({ role: "user", content });

    // Use ai-sdk to generate assistant text as a stream

    const result = streamText({
        model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
        system: systemPrompt,
        messages: msgs,
        onFinish: async (completion) => {
            // Persist assistant message once stream is complete
            const { error: insertAssistErr } = await supabase.from("move_chat").insert({
                game_id: gameId,
                move_number: moveNumber,
                role: "assistant",
                content: completion.text || "(error)",
            });
            if (insertAssistErr) {
                console.error("[MoveChat] insert assistant error", insertAssistErr);
            }
        },
    });

    return result.toDataStreamResponse();
});
