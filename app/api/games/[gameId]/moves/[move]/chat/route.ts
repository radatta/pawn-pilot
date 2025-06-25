import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { createSupabaseServer } from "@/lib/supabase/server";
import { pawnPilotSystemPrompt } from "@/lib/prompts";
import { ChatRequestSchema, ChatMessageSchema } from "@/lib/validation/chat";
import { MoveChatInsertSchema } from "@/lib/validation/schemas";
import {
    validateRequest,
    validateParams,
    moveRouteParamsSchema
} from "@/lib/validation/utils";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

// Define a type for chat messages to avoid any[] casts
type ChatMessageType = {
    role: "user" | "assistant" | "system";
    content: string;
    created_at: string;
};

export const GET = withErrorHandling(async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ gameId: string; move: string }> }
) {
    const [parsedParams, paramsError] = await validateParams(await params, moveRouteParamsSchema);
    if (paramsError) return paramsError;

    const { gameId, moveNumber } = parsedParams;

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
        .from("move_chat")
        .select("messages")
        .eq("game_id", gameId)
        .eq("move_number", moveNumber)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            // No messages found for this move
            return NextResponse.json({ messages: [] });
        }
        console.error("[MoveChat] GET error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data?.messages ?? [] });
});

export const POST = withErrorHandling(async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string; move: string }> },
) {
    const [parsedParams, paramsError] = await validateParams(await params, moveRouteParamsSchema);
    if (paramsError) return paramsError;

    const { gameId, moveNumber } = parsedParams;

    const body = await req.json();
    const supabase = await createSupabaseServer();

    // Handle AI SDK format (useChat sends { messages: [...] })
    if (body.messages && Array.isArray(body.messages)) {
        const { messages } = body;
        const lastUserMessage = messages.filter((m: { role: string; content: string }) => m.role === "user").pop();

        if (!lastUserMessage || !lastUserMessage.content) {
            return NextResponse.json({ error: "No user message found" }, { status: 400 });
        }

        // Get existing chat history or create new entry
        const { data: existingChat, error: fetchError } = await supabase
            .from("move_chat")
            .select("id, messages")
            .eq("game_id", gameId)
            .eq("move_number", moveNumber)
            .single();

        if (fetchError && fetchError.code !== "PGRST116") {
            console.error("[MoveChat] fetch error", fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        // Add user message to chat history
        const userMessage = {
            role: "user",
            content: lastUserMessage.content,
            created_at: new Date().toISOString()
        };

        // Validate user message
        const userMessageResult = ChatMessageSchema.safeParse(userMessage);
        if (!userMessageResult.success) {
            console.error("[MoveChat] Invalid user message:", userMessageResult.error);
            return NextResponse.json({ error: "Invalid user message format" }, { status: 400 });
        }

        const existingMessages = (existingChat?.messages ?? []) as ChatMessageType[];
        const updatedMessages = [...existingMessages, userMessageResult.data];

        // Insert or update chat history
        if (existingChat) {
            const { error: updateError } = await supabase
                .from("move_chat")
                .update({ messages: updatedMessages })
                .eq("id", existingChat.id);

            if (updateError) {
                console.error("[MoveChat] update error", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }
        } else {
            const moveChatData = {
                game_id: gameId,
                move_number: moveNumber,
                messages: updatedMessages
            };

            const moveChatResult = MoveChatInsertSchema.safeParse(moveChatData);
            if (!moveChatResult.success) {
                console.error("[MoveChat] Invalid move chat data:", moveChatResult.error);
                return NextResponse.json({ error: "Invalid move chat data" }, { status: 400 });
            }

            const { error: insertError } = await supabase
                .from("move_chat")
                .insert(moveChatResult.data);

            if (insertError) {
                console.error("[MoveChat] insert error", insertError);
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }
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

        // Convert stored messages to format expected by AI SDK
        const historyMsgs = updatedMessages.map(m => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content
        }));

        // Use ai-sdk to generate assistant text as a stream
        const result = streamText({
            model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
            system: systemPrompt,
            messages: historyMsgs,
            onFinish: async (completion) => {
                // Persist assistant message once stream is complete
                const assistantMessage = {
                    role: "assistant",
                    content: completion.text || "(error)",
                    created_at: new Date().toISOString()
                };

                // Validate assistant message
                const assistantMessageResult = ChatMessageSchema.safeParse(assistantMessage);
                if (!assistantMessageResult.success) {
                    console.error("[MoveChat] Invalid assistant message:", assistantMessageResult.error);
                    return;
                }

                const { data: latestChat } = await supabase
                    .from("move_chat")
                    .select("id, messages")
                    .eq("game_id", gameId)
                    .eq("move_number", moveNumber)
                    .single();

                if (latestChat) {
                    const latestMessages = (latestChat.messages ?? []) as ChatMessageType[];
                    const { error: updateError } = await supabase
                        .from("move_chat")
                        .update({
                            messages: [...latestMessages, assistantMessageResult.data]
                        })
                        .eq("id", latestChat.id);

                    if (updateError) {
                        console.error("[MoveChat] update assistant error", updateError);
                    }
                }
            },
        });

        return result.toDataStreamResponse();
    }

    // Handle legacy format
    const [parsedBody, bodyError] = await validateRequest(body, ChatRequestSchema);
    if (bodyError) return bodyError;

    const {
        content,
        fen_before: suppliedFen,
        move_san: suppliedMoveSan,
        pv: suppliedPv,
        eval_cp: suppliedEval,
        mate_in: suppliedMate,
        explanation: suppliedExplanation,
    } = parsedBody;

    // Get existing chat history or create new entry
    const { data: existingChat, error: fetchError } = await supabase
        .from("move_chat")
        .select("id, messages")
        .eq("game_id", gameId)
        .eq("move_number", moveNumber)
        .single();

    if (fetchError && fetchError.code !== "PGRST116") {
        console.error("[MoveChat] fetch error", fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Add user message to chat history
    const userMessage = {
        role: "user",
        content,
        created_at: new Date().toISOString()
    };

    // Validate user message
    const userMessageResult = ChatMessageSchema.safeParse(userMessage);
    if (!userMessageResult.success) {
        console.error("[MoveChat] Invalid user message:", userMessageResult.error);
        return NextResponse.json({ error: "Invalid user message format" }, { status: 400 });
    }

    const existingMessages = (existingChat?.messages ?? []) as ChatMessageType[];
    const updatedMessages = [...existingMessages, userMessageResult.data];

    // Insert or update chat history
    if (existingChat) {
        const { error: updateError } = await supabase
            .from("move_chat")
            .update({ messages: updatedMessages })
            .eq("id", existingChat.id);

        if (updateError) {
            console.error("[MoveChat] update error", updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
    } else {
        const moveChatData = {
            game_id: gameId,
            move_number: moveNumber,
            messages: updatedMessages
        };

        const moveChatResult = MoveChatInsertSchema.safeParse(moveChatData);
        if (!moveChatResult.success) {
            console.error("[MoveChat] Invalid move chat data:", moveChatResult.error);
            return NextResponse.json({ error: "Invalid move chat data" }, { status: 400 });
        }

        const { error: insertError } = await supabase
            .from("move_chat")
            .insert(moveChatResult.data);

        if (insertError) {
            console.error("[MoveChat] insert error", insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
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

    // Convert stored messages to format expected by AI SDK
    const msgs = updatedMessages.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content
    }));

    // Use ai-sdk to generate assistant text as a stream
    const result = streamText({
        model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
        system: systemPrompt,
        messages: msgs,
        onFinish: async (completion) => {
            // Persist assistant message once stream is complete
            const assistantMessage = {
                role: "assistant",
                content: completion.text || "(error)",
                created_at: new Date().toISOString()
            };

            // Validate assistant message
            const assistantMessageResult = ChatMessageSchema.safeParse(assistantMessage);
            if (!assistantMessageResult.success) {
                console.error("[MoveChat] Invalid assistant message:", assistantMessageResult.error);
                return;
            }

            const { data: latestChat } = await supabase
                .from("move_chat")
                .select("id, messages")
                .eq("game_id", gameId)
                .eq("move_number", moveNumber)
                .single();

            if (latestChat) {
                const latestMessages = (latestChat.messages ?? []) as ChatMessageType[];
                const { error: updateError } = await supabase
                    .from("move_chat")
                    .update({
                        messages: [...latestMessages, assistantMessageResult.data]
                    })
                    .eq("id", latestChat.id);

                if (updateError) {
                    console.error("[MoveChat] update assistant error", updateError);
                }
            }
        },
    });

    return result.toDataStreamResponse();
});
