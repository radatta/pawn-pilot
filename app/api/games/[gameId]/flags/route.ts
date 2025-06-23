import { createSupabaseServer } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({ ply: z.number() });

export const GET = withErrorHandling(async function GET(_req: Request, { params }: { params: { gameId: string } }) {
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
});

export const POST = withErrorHandling(async function POST(req: Request, { params }: { params: { gameId: string } }) {
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
        .update({ is_flagged: true })
        .eq("game_id", (await params).gameId)
        .eq("move_number", ply);

    if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
});

export const DELETE = withErrorHandling(async function DELETE(req: Request, { params }: { params: { gameId: string } }) {
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
}); 