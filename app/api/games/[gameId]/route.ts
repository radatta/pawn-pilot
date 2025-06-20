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
]);

export type GameResult = z.infer<typeof GameResultSchema>;

const BodySchema = z.object({
    pgn: z.string(),
    status: GameStatusSchema.optional(),
    result: GameResultSchema.optional(),
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

    if (!body.pgn && !body.status && !body.result) {
        return NextResponse.json(
            { error: "pgn, status, or result is required" },
            { status: 400 }
        );
    }

    const parsedBody = BodySchema.safeParse(body);

    if (!parsedBody.success) {
        console.error(parsedBody.error);
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { pgn, status, result } = parsedBody.data;

    // First, verify the user owns the game they are trying to update
    const { data: game, error: fetchError } = await supabase
        .from("games")
        .select("id")
        .eq("id", (await params).gameId)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !game) {
        return NextResponse.json({ error: "Game not found or access denied" }, { status: 404 });
    }


    // Now, perform the update
    const { data, error } = await supabase
        .from("games")
        .update({ pgn, status, result })
        .eq("id", (await params).gameId)
        .select()
        .single();

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
} 