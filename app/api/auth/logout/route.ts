import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/utils/api-error-wrapper";
import { createSupabaseServer } from "@/lib/supabase/server";

export const POST = withErrorHandling(async function POST() {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
    return NextResponse.json({ message: "Signed out" }, { status: 200 });
}); 