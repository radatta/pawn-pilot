import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST() {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
    return NextResponse.json({ message: "Signed out" }, { status: 200 });
} 