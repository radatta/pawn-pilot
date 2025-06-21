import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const supabase = await createSupabaseServer();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse optional time control from request body
    let timeControl = 300; // Default 5 minutes
    let increment = 0; // Default no increment

    try {
        const body = await req.json();
        if (body.timeControl) timeControl = body.timeControl;
        if (body.increment) increment = body.increment;
    } catch {
        // Use defaults if no body provided
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
                time_control: timeControl,
                white_time_remaining: timeControl,
                black_time_remaining: timeControl,
                increment: increment,
                last_move_timestamp: new Date().toISOString(),
                clock_history: [{ white: timeControl, black: timeControl }],
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
