import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { createSupabaseServer } from "@/lib/supabase/server";
import { pawnPilotSystemPrompt } from "@/lib/prompts";

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

    const body = await req.json().catch(() => null);
    const content = body?.content as string | undefined;
    const suppliedFen = body?.fen_before as string | undefined;
    const suppliedMoveSan = body?.move_san as string | undefined;
    const suppliedPv = body?.pv as string | undefined;
    const suppliedEval = body?.eval_cp as number | null | undefined;
    const suppliedMate = body?.mate_in as number | null | undefined;
    const suppliedExplanation = body?.explanation as string | undefined;
    if (
        !content ||
        !suppliedFen ||
        !suppliedMoveSan ||
        suppliedPv === undefined ||
        suppliedEval === undefined ||
        suppliedMate === undefined
    ) {
        return NextResponse.json({ error: "Missing required context" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

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

    // Use ai-sdk to generate assistant text (non-streaming)
    const { generateText } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");
    const result = await generateText({
        model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
        system: systemPrompt,
        messages: msgs,
    });

    const assistantText = result.text ?? "(error)";

    // Persist assistant message
    const { error: insertAssistErr } = await supabase.from("move_chat").insert({
        game_id: gameId,
        move_number: moveNumber,
        role: "assistant",
        content: assistantText,
    });
    if (insertAssistErr) {
        console.error("[MoveChat] insert assistant error", insertAssistErr);
    }

    return NextResponse.json({ role: "assistant", content: assistantText });
});
