import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({ ply: z.number() });

export async function GET(_req: Request, { params }: { params: { gameId: string } }) {
    const supabase = await createSupabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("move_history")
        .select("move_number")
        .eq("game_id", (await params).gameId)
        .eq("is_flagged", true);

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ flagged: data?.map((d) => d.move_number) || [] });
}

export async function POST(req: Request, { params }: { params: { gameId: string } }) {
    const supabase = await createSupabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    console.log("parsed", parsed.data, (await params).gameId);

    const { ply } = parsed.data;

    // verifying the move number exists
    const { data: moveHistory, error: moveHistoryError } = await supabase
        .from("move_history")
        .select("move_number")
        .eq("game_id", (await params).gameId)
        .eq("move_number", ply);

    if (moveHistoryError) {
        console.error(moveHistoryError);
        return NextResponse.json({ error: moveHistoryError.message }, { status: 500 });
    }

    if (!moveHistory) {
        return NextResponse.json({ error: "Move number does not exist" }, { status: 400 });
    }

    console.log("moveHistory", moveHistory, ply);

    // updating the move number
    const { error } = await supabase
        .from("move_history")
        .update({ is_flagged: true })
        .eq("game_id", (await params).gameId)
        .eq("move_number", ply);

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: { gameId: string } }) {
    const supabase = await createSupabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { ply } = parsed.data;
    const { error } = await supabase
        .from("move_history")
        .update({ is_flagged: false })
        .eq("game_id", (await params).gameId)
        .eq("move_number", ply);

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
} 