import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    const { pgn, status } = await req.json();

    if (!pgn && !status) {
        return NextResponse.json(
            { error: "pgn or status is required" },
            { status: 400 }
        );
    }

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
        .update({ pgn, status })
        .eq("id", (await params).gameId)
        .select()
        .single();

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
} 