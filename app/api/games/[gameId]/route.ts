import { createSupabaseServer } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { Chess } from "chess.js";
import {
    GameUpdateRequestSchema,
    MoveHistoryInsertSchema,
    MoveHistoryInsert
} from "@/lib/validation/schemas";
import {
    validateRequest,
    validateParams,
    gameRouteParamsSchema
} from "@/lib/validation/utils";

export const GET = withErrorHandling(async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const [parsedParams, paramsError] = await validateParams(await params, gameRouteParamsSchema);
    if (paramsError) return paramsError;

    const { gameId } = parsedParams;

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
        .eq("id", gameId)
        .eq("user_id", user.id)
        .single();

    if (error) {
        console.error("[GAME] Error fetching game:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json(data);
});

export const PUT = withErrorHandling(async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const [parsedParams, paramsError] = await validateParams(await params, gameRouteParamsSchema);
    if (paramsError) return paramsError;

    const { gameId } = parsedParams;

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

    const [parsedBody, bodyError] = await validateRequest(body, GameUpdateRequestSchema);
    if (bodyError) return bodyError;

    const { pgn, status, result, white_time_remaining, black_time_remaining, last_move_timestamp, clock_history } = parsedBody;

    // Build update object
    const updateData: {
        pgn?: string;
        status?: typeof status;
        result?: typeof result;
        white_time_remaining?: number;
        black_time_remaining?: number;
        last_move_timestamp?: string;
        clock_history?: typeof clock_history;
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
        .eq("id", gameId)
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
                .eq("game_id", gameId);

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
                    game_id: gameId,
                    move_number: i + 1, // 1-based
                    move: move.san,
                    fen_before,
                    fen_after,
                });
            }

            if (rowsToInsert.length > 0) {
                // Validate move history records
                const validatedRows: MoveHistoryInsert[] = [];

                for (const row of rowsToInsert) {
                    const result = MoveHistoryInsertSchema.safeParse(row);
                    if (result.success) {
                        validatedRows.push(result.data);
                    } else {
                        console.error("Invalid move history row:", result.error);
                    }
                }

                if (validatedRows.length > 0) {
                    const { error: insertError } = await supabase
                        .from("move_history")
                        .upsert(validatedRows, {
                            onConflict: "game_id,move_number",
                            ignoreDuplicates: true,
                        });

                    if (insertError) {
                        console.error("move_history insert error", insertError);
                        // We swallow the error to avoid breaking the game update flow.
                    }
                }
            }
        } catch (err) {
            console.error("Failed to persist move_history", err);
            // Do not fail the request; the game update has succeeded.
        }
    }

    return NextResponse.json(data);
}); 