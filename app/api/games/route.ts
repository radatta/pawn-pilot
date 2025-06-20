import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For simplicity, user always plays white for now
    const { data, error } = await supabase
        .from("games")
        .insert([
            {
                user_id: user.id,
                white_player: "user",
                black_player: "ai",
                status: "in_progress",
                pgn: "", // Start with an empty PGN
            },
        ])
        .select()
        .single();

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
