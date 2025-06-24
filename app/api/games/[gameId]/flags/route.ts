import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { createSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET  /api/games/[gameId]/flags  →  list all flagged plies for game
export const GET = withErrorHandling(async function GET(_req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = await params;
    if (!gameId) {
        return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
        .from("move_history")
        .select("move_number")
        .eq("game_id", gameId)
        .eq("is_flagged", true);

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ flagged: data?.map((d) => d.move_number) || [] });
});

// POST  /api/games/[gameId]/flags  →  toggle flag for given ply
export const POST = withErrorHandling(async function POST(req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = await params;
    if (!gameId) {
        return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const body = await req.json();
    const { ply, currentlyFlagged } = body as { ply: number; currentlyFlagged: boolean };

    if (typeof ply !== "number" || typeof currentlyFlagged !== "boolean") {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    const { error } = await supabase
        .from("move_history")
        .update({ is_flagged: !currentlyFlagged })
        .eq("game_id", gameId)
        .eq("move_number", ply + 1); // Convert 0-based ply to 1-based move_number

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
});

// DELETE  /api/games/[gameId]/flags  →  remove all flags for game
export const DELETE = withErrorHandling(async function DELETE(req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = await params;
    if (!gameId) {
        return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    const { error } = await supabase
        .from("move_history")
        .update({ is_flagged: false })
        .eq("game_id", gameId);

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}); 