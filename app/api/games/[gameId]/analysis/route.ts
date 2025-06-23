// Create a new serverless API route that accepts POST to analyse an entire game
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Chess } from "chess.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
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

// Build the same prompt template used in /api/analysis for consistency
function buildPrompt(fen: string, gameHistory: string, pv = ""): string {
    return `You are a grandmaster-level chess coach giving advice to the WHITE player.

For each position, you will:
1. Evaluate the quality and impact of the last move in one short sentence (≤15 words).
2. ONLY IF WHITE MADE THE LAST MOVE, advise White on the best plan or next move in the current position, in one short sentence (≤15 words). If the last move was blacks's, do not advise.

Here is an example:

Example 1:
Position (FEN): "5br1/1p3kp1/p2Pbp1p/3N4/3QP3/P1P1B3/1q3PPP/R3R1K1 w - - 1 24"
Full game history: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nge7 4. O-O a6 5. Bxc6 Nxc6 6. d4 exd4 7. Nxd4 Nxd4 8. Qxd4 d6 9. Nc3 Be6 10. Re1 Qd7 11. Be3 Rc8 12. Qa7 c5 13. a3 Qc7 14. b4 Qc6 15. bxc5 h6 16. Nd5 f6 17. cxd6 Kf7 18. Ne7 Qd7 19. Nxc8 Rg8 20. Nb6 Qb5 21. Nd5 Qb2 22. Qd4 Qb5 23. c3 Qb2"
Principal variation: "a1b1 b2b1 e1b1 b7b6 d4b6 e6d5 b6c7 f7g6 f2f3 d5e6"
Evaluation: Black's queen is deep on your side and vulnerable; you have a clear tactical shot.
Advice: Play Rab1 immediately, attacking the exposed queen and forcing a winning material exchange after Qxb1 Rxb1.

Complete the following analysis:
Position (FEN): "${fen}"
Full game history: "${gameHistory}"
Principal variation: "${pv}"`;
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
                generateText({ model: openai("gpt-4o"), prompt: buildPrompt(fen, history) })
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