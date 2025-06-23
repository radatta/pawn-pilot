import { createSupabaseServer } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Chess } from "chess.js";

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

export const GET = withErrorHandling(async function GET(
    req: Request,
    { params }: { params: { gameId: string } }
) {
    const supabase = await createSupabaseServer();
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
});

export const PUT = withErrorHandling(async function PUT(
    req: Request,
    { params }: { params: { gameId: string } }
) {
    const supabase = await createSupabaseServer();
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

    // -------------------------------------------------------------------------
    // Persist newly added moves into `move_history`
    // -------------------------------------------------------------------------
    if (pgn) {
        try {
            // 1. Figure out how many moves we already have stored for this game
            const { count: existingCount, error: countError } = await supabase
                .from("move_history")
                .select("id", { count: "exact", head: true })
                .eq("game_id", (await params).gameId);

            if (countError) {
                console.error("move_history count error", countError);
                // We still succeed in updating the game even if the move persistence fails
            }

            const alreadyStored = existingCount ?? 0;

            // 2. Re-parse the PGN so we can capture FENs before/after every ply
            //    We parse once to get the move list, then replay to capture FENs.
            const chessLoaded = new Chess();
            chessLoaded.loadPgn(pgn);
            const verboseMoves = chessLoaded.history({ verbose: true });

            // Nothing to do if no new moves
            if (verboseMoves.length <= alreadyStored) {
                return NextResponse.json(data);
            }

            // 3. Replay from the start to collect rows only for the moves we need to insert
            const rowsToInsert: {
                game_id: string;
                move_number: number;
                move: string;
                fen_before: string;
                fen_after: string;
            }[] = [];

            const chessReplay = new Chess();
            for (let i = 0; i < verboseMoves.length; i++) {
                const move = verboseMoves[i];

                if (i < alreadyStored) {
                    // Fast-forward without creating rows — we already have them
                    chessReplay.move(move);
                    continue;
                }

                const fen_before = chessReplay.fen();
                chessReplay.move(move);
                const fen_after = chessReplay.fen();

                rowsToInsert.push({
                    game_id: (await params).gameId,
                    move_number: i + 1, // 1-based
                    move: move.san,
                    fen_before,
                    fen_after,
                });
            }

            if (rowsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from("move_history")
                    .upsert(rowsToInsert, {
                        onConflict: "game_id,move_number",
                        ignoreDuplicates: true,
                    });

                if (insertError) {
                    console.error("move_history insert error", insertError);
                    // We swallow the error to avoid breaking the game update flow.
                }
            }
        } catch (err) {
            console.error("Failed to persist move_history", err);
            // Do not fail the request; the game update has succeeded.
        }
    }

    return NextResponse.json(data);
}); 