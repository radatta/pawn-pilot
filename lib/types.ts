import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface GameResult {
    white_wins: boolean;
    black_wins: boolean;
    draw: boolean;
    timeout: boolean;
    resignation: boolean;
}

export type ChatContext = {
    fen_before: string;
    move_san: string;
    pv: string;
    eval_cp: number | null;
    mate_in: number | null;
    explanation?: string;
};