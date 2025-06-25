import { z } from "zod";
import type { Database } from "@/lib/database.types";

// Game Status and Result
export const GameStatusSchema = z.enum(["in_progress", "completed"]);
export type GameStatus = z.infer<typeof GameStatusSchema>;

export const GameResultSchema = z.enum([
    "checkmate",
    "draw",
    "resigned",
    "stalemate",
    "insufficient_material",
    "threefold_repetition",
    "timeout",
]);
export type GameResult = z.infer<typeof GameResultSchema>;

// Clock History
export const ClockHistoryEntrySchema = z.object({
    white: z.number(),
    black: z.number(),
});
export type ClockHistoryEntry = z.infer<typeof ClockHistoryEntrySchema>;

export const ClockHistorySchema = z.array(ClockHistoryEntrySchema);
export type ClockHistory = z.infer<typeof ClockHistorySchema>;

// Game - Using Database types for reference
export type DbGame = Database["public"]["Tables"]["games"]["Row"];
export const GameSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    created_at: z.string().datetime(),
    status: GameStatusSchema,
    result: GameResultSchema.nullable(),
    pgn: z.string().nullable(),
    white_player: z.string().nullable(),
    black_player: z.string().nullable(),
    time_control: z.number(),
    increment: z.number(),
    white_time_remaining: z.number(),
    black_time_remaining: z.number(),
    last_move_timestamp: z.string().datetime().nullable(),
    clock_history: ClockHistorySchema.nullable(),
});
export type Game = z.infer<typeof GameSchema>;

// Game Insert/Update
export type DbGameInsert = Database["public"]["Tables"]["games"]["Insert"];
export const GameInsertSchema = GameSchema.partial().required({
    user_id: true,
});
export type GameInsert = z.infer<typeof GameInsertSchema>;

export type DbGameUpdate = Database["public"]["Tables"]["games"]["Update"];
export const GameUpdateSchema = GameSchema.partial();
export type GameUpdate = z.infer<typeof GameUpdateSchema>;

// Move History
export type DbMoveHistory = Database["public"]["Tables"]["move_history"]["Row"];
export const MoveHistorySchema = z.object({
    id: z.number(),
    game_id: z.string().uuid(),
    move_number: z.number().int().positive(),
    move: z.string(),
    fen_before: z.string(),
    fen_after: z.string(),
    created_at: z.string().datetime(),
    is_flagged: z.boolean(),
});
export type MoveHistory = z.infer<typeof MoveHistorySchema>;

export type DbMoveHistoryInsert = Database["public"]["Tables"]["move_history"]["Insert"];
export const MoveHistoryInsertSchema = MoveHistorySchema.omit({ id: true, created_at: true, is_flagged: true }).extend({
    created_at: z.string().datetime().optional(),
    is_flagged: z.boolean().optional(),
});
export type MoveHistoryInsert = z.infer<typeof MoveHistoryInsertSchema>;

// Move Analysis
export type DbMoveAnalysis = Database["public"]["Tables"]["move_analysis"]["Row"];
export const MoveAnalysisSchema = z.object({
    id: z.number(),
    game_id: z.string().uuid(),
    move_number: z.number().int().positive(),
    created_at: z.string().datetime(),
    best_move: z.string().nullable(),
    eval_cp: z.number().nullable(),
    mate_in: z.number().nullable(),
    explanation: z.string().nullable(),
    pv: z.string().nullable(),
    status: z.string().nullable(),
});
export type MoveAnalysis = z.infer<typeof MoveAnalysisSchema>;

export type DbMoveAnalysisInsert = Database["public"]["Tables"]["move_analysis"]["Insert"];
export const MoveAnalysisInsertSchema = MoveAnalysisSchema.omit({ id: true, created_at: true }).extend({
    created_at: z.string().datetime().optional(),
});
export type MoveAnalysisInsert = z.infer<typeof MoveAnalysisInsertSchema>;

// Move Chat Message
export const ChatMessageSchema = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    created_at: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Move Chat
export type DbMoveChat = Database["public"]["Tables"]["move_chat"]["Row"];
export const MoveChatSchema = z.object({
    id: z.number(),
    game_id: z.string().uuid(),
    move_number: z.number().int().positive(),
    messages: z.array(ChatMessageSchema),
    created_at: z.string().datetime().nullable(),
    updated_at: z.string().datetime().nullable(),
});
export type MoveChat = z.infer<typeof MoveChatSchema>;

export type DbMoveChatInsert = Database["public"]["Tables"]["move_chat"]["Insert"];
export const MoveChatInsertSchema = MoveChatSchema.omit({ id: true, created_at: true, updated_at: true }).extend({
    created_at: z.string().datetime().nullable().optional(),
    updated_at: z.string().datetime().nullable().optional(),
});
export type MoveChatInsert = z.infer<typeof MoveChatInsertSchema>;

// Puzzle
export type DbPuzzle = Database["public"]["Tables"]["puzzles"]["Row"];
export const PuzzleSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    fen: z.string(),
    solution: z.array(z.string()),
    theme: z.string().nullable(),
    game_id: z.string().uuid().nullable(),
    attempts: z.number().int().nonnegative(),
    successes: z.number().int().nonnegative(),
    created_at: z.string().datetime(),
});
export type Puzzle = z.infer<typeof PuzzleSchema>;

// User Progress
export type DbUserProgress = Database["public"]["Tables"]["user_progress"]["Row"];
export const UserProgressSchema = z.object({
    user_id: z.string().uuid(),
    rating: z.number().int(),
    accuracy: z.number().nullable(),
    blunder_rate: z.number().nullable(),
    strengths: z.record(z.string(), z.any()).nullable(),
    weaknesses: z.record(z.string(), z.any()).nullable(),
    updated_at: z.string().datetime(),
});
export type UserProgress = z.infer<typeof UserProgressSchema>;

// API Request/Response Schemas
export const GameUpdateRequestSchema = z.object({
    pgn: z.string().optional(),
    status: GameStatusSchema.optional(),
    result: GameResultSchema.optional(),
    white_time_remaining: z.number().optional(),
    black_time_remaining: z.number().optional(),
    last_move_timestamp: z.string().datetime().optional(),
    clock_history: ClockHistorySchema.optional(),
});
export type GameUpdateRequest = z.infer<typeof GameUpdateRequestSchema>; 