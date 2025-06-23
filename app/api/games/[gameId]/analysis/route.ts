// Create a new serverless API route that accepts POST to analyse an entire game
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Chess } from "chess.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { analysisPrompt } from "@/lib/prompts";
import type { Database } from "@/lib/database.types";

// Helper: convert SAN moves array to a single PGN-like string "1. e4 e5 2. ..."
function movesArrayToString(moves: string[]): string {
    const parts: string[] = [];
    for (let i = 0; i < moves.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = moves[i];
        const blackMove = moves[i + 1] ?? "";
        parts.push(`${moveNumber}. ${whiteMove}${blackMove ? " " + blackMove : ""}`);
    }
    return parts.join(" ");
}

export const POST = withErrorHandling(async function POST(req: NextRequest, { params }: { params: { gameId: string } }) {
    const { gameId } = await params;
    if (!gameId) {
        return NextResponse.json({ error: "Missing gameId in URL" }, { status: 400 });
    }

    // Optional body: { concurrency?: number }
    let concurrency = 5;
    try {
        const body = await req.json();
        if (body?.concurrency && Number.isInteger(body.concurrency) && body.concurrency > 0) {
            concurrency = body.concurrency;
        }
    } catch {
        // ignore – body is optional
    }

    // ------------------------------------------------------------------
    // Fetch the PGN for the requested game
    // ------------------------------------------------------------------
    console.debug("[ANALYZE] Starting batch analysis for game", gameId);
    const supabase = await createSupabaseServer();
    const { data: gameRow, error: fetchErr } = await supabase
        .from("games")
        .select("pgn")
        .eq("id", gameId)
        .single();

    if (fetchErr || !gameRow?.pgn) {
        return NextResponse.json({ error: fetchErr?.message || "Game not found or PGN missing" }, { status: 404 });
    }

    const pgn: string = gameRow.pgn;
    console.debug("[ANALYZE] PGN fetched (chars)", pgn.length);

    // ------------------------------------------------------------------
    // Walk through the game, capturing FEN & move history after every ply
    // ------------------------------------------------------------------
    const moves = [] as string[];
    const positions: { fen: string; history: string }[] = [];

    const loader = new Chess();
    try {
        loader.loadPgn(pgn);
    } catch {
        return NextResponse.json({ error: "Invalid PGN" }, { status: 400 });
    }
    // After loading, we have moves array
    const allMoves = loader.history();
    console.debug("[ANALYZE] Total plies", allMoves.length);

    const simulator = new Chess(); // start from initial position
    for (let i = 0; i < allMoves.length; i++) {
        const moveSan = allMoves[i];
        simulator.move(moveSan);
        moves.push(moveSan);
        positions.push({ fen: simulator.fen(), history: movesArrayToString([...moves]) });
    }

    // ------------------------------------------------------------------
    // Analyse each position in batches of `concurrency` using OpenAI
    // ------------------------------------------------------------------
    const results: string[] = new Array(positions.length);

    let active = 0;
    let currentIdx = 0;

    console.debug("[ANALYZE] Launching OpenAI calls with concurrency", concurrency);
    return await new Promise<Response>((resolve) => {
        const maybeLaunch = () => {
            if (currentIdx >= positions.length && active === 0) {
                // All done, respond
                console.debug("[ANALYZE] Analysis completed for game", gameId);

                // ------------------------------------------------------------------
                // Persist explanations into move_analysis
                // ------------------------------------------------------------------
                (async () => {
                    try {
                        // Upsert explanations into move_analysis
                        type Row = Database["public"]["Tables"]["move_analysis"]["Insert"];
                        const rows: Row[] = results.map((explanation, idx) => ({
                            game_id: gameId,
                            move_number: idx + 1,
                            explanation,
                        }));

                        const { error: upErr } = await supabase
                            .from("move_analysis")
                            .upsert(rows, { onConflict: "game_id,move_number" });

                        if (upErr) {
                            console.error("[ANALYZE] move_analysis upsert error", upErr);
                        }
                        console.debug("[ANALYZE] Explanations persisted");
                    } catch (e) {
                        console.error("[ANALYZE] Persist explanations failed", e);
                    }
                })();

                return resolve(NextResponse.json({ analysis: results }));
            }
            while (active < concurrency && currentIdx < positions.length) {
                const idx = currentIdx++;
                const { fen, history } = positions[idx];
                active++;
                console.debug(`[ANALYZE] Requesting analysis for ply ${idx}`);
                generateText({ model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"), prompt: analysisPrompt({ fen, gameHistory: history }) })
                    .then((res) => {
                        // res.text according to typings
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const text = (res as any).text as string | undefined;
                        results[idx] = text ?? "Unable to generate analysis.";
                        console.debug(`[ANALYZE] Completed ply ${idx}`);
                    })
                    .catch((err) => {
                        console.error("Analysis error", err);
                        results[idx] = "Analysis error";
                    })
                    .finally(() => {
                        active--;
                        maybeLaunch();
                    });
            }
        };
        maybeLaunch();
    });
});

// ------------------------------------------------------------------
// GET  /api/games/[gameId]/analysis  – return stored analysis rows
// ------------------------------------------------------------------
export const GET = withErrorHandling(async function GET(
    _req: NextRequest,
    { params }: { params: { gameId: string } }
) {
    const { gameId } = await params;
    if (!gameId) {
        return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
        .from("move_analysis")
        .select("move_number, explanation, best_move, eval_cp, mate_in")
        .eq("game_id", gameId)
        .order("move_number");

    if (error) {
        console.error("[ANALYZE] GET error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const analysis = (data ?? []).map((row) => ({
        explanation: row.explanation ?? "",
        best_move: (row as { best_move?: string }).best_move ?? null,
        eval_cp: (row as { eval_cp?: number | null }).eval_cp ?? null,
        mate_in: (row as { mate_in?: number | null }).mate_in ?? null,
    }));

    return NextResponse.json({ analysis });
});

// ------------------------------------------------------------------
// PUT  /api/games/[gameId]/analysis  – bulk update engine fields
// Body: { updates: { move_number: number; best_move: string; eval_cp?: number; mate_in?: number }[] }
// ------------------------------------------------------------------
export const PUT = withErrorHandling(async function PUT(
    req: NextRequest,
    { params }: { params: { gameId: string } }
) {
    const { gameId } = await params;
    if (!gameId) {
        return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    const body = await req.json();
    const updates = body?.updates as
        | { move_number: number; best_move: string; eval_cp?: number; mate_in?: number }[]
        | undefined;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Build rows
    const rows = updates.map((u) => ({
        game_id: gameId,
        move_number: u.move_number,
        best_move: u.best_move,
        eval_cp: u.eval_cp ?? null,
        mate_in: u.mate_in ?? null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("move_analysis").upsert(rows as any, {
        onConflict: "game_id,move_number",
    });

    if (error) {
        console.error("[ANALYZE] PUT upsert engine info error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: rows.length });
}); 