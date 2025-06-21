import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const GameStatusSchema = z.enum(["in_progress", "completed"]);

const GameResultSchema = z.enum([
    "checkmate",
    "draw",
    "resigned",
    "stalemate",
    "insufficient_material",
    "threefold_repetition",
    "timeout",
]);

export type GameResult = z.infer<typeof GameResultSchema>;

const ClockHistorySchema = z.array(z.object({ white: z.number(), black: z.number() }));

const BodySchema = z.object({
    pgn: z.string().optional(),
    status: GameStatusSchema.optional(),
    result: GameResultSchema.optional(),
    white_time_remaining: z.number().optional(),
    black_time_remaining: z.number().optional(),
    last_move_timestamp: z.string().optional(),
    clock_history: ClockHistorySchema.optional(),
});

export async function GET(
    req: Request,
    { params }: { params: { gameId: string } }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", (await params).gameId)
        .eq("user_id", user.id)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json(data);
}

export async function PUT(
    req: Request,
    { params }: { params: { gameId: string } }
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!body.pgn && !body.status && !body.result && !body.white_time_remaining && !body.black_time_remaining) {
        return NextResponse.json(
            { error: "pgn, status, result, or time update is required" },
            { status: 400 }
        );
    }

    const parsedBody = BodySchema.safeParse(body);

    if (!parsedBody.success) {
        console.error(parsedBody.error);
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { pgn, status, result, white_time_remaining, black_time_remaining, last_move_timestamp, clock_history } = parsedBody.data;

    // First, verify the user owns the game they are trying to update
    const { data: game, error: fetchError } = await supabase
        .from("games")
        .select("id, white_time_remaining, black_time_remaining, increment")
        .eq("id", (await params).gameId)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !game) {
        return NextResponse.json({ error: "Game not found or access denied" }, { status: 404 });
    }

    // Build update object
    const updateData: {
        pgn?: string;
        status?: z.infer<typeof GameStatusSchema>;
        result?: GameResult;
        white_time_remaining?: number;
        black_time_remaining?: number;
        last_move_timestamp?: string;
        clock_history?: z.infer<typeof ClockHistorySchema>;
    } = {};
    if (pgn !== undefined) updateData.pgn = pgn;
    if (status !== undefined) updateData.status = status;
    if (result !== undefined) updateData.result = result;
    if (white_time_remaining !== undefined) updateData.white_time_remaining = white_time_remaining;
    if (black_time_remaining !== undefined) updateData.black_time_remaining = black_time_remaining;
    if (last_move_timestamp !== undefined) updateData.last_move_timestamp = last_move_timestamp;
    if (clock_history !== undefined) updateData.clock_history = clock_history;

    // Now, perform the update
    const { data, error } = await supabase
        .from("games")
        .update(updateData)
        .eq("id", (await params).gameId)
        .select()
        .single();

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
} 