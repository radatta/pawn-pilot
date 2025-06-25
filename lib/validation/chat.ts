import { z } from "zod";

export const ChatRequestSchema = z.object({
    content: z.string().min(1, "Message content is required"),
    fen_before: z.string().min(1, "FEN position is required"),
    move_san: z.string().min(1, "Move in SAN notation is required"),
    pv: z.string().default(""),
    eval_cp: z.number().nullable(),
    mate_in: z.number().nullable(),
    explanation: z.string().optional(),
    gameHistory: z.string().optional(),
    messages: z.array(
        z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string(),
            created_at: z.string().datetime().optional()
        })
    ).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
    messages: z.array(
        z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string(),
            created_at: z.string().datetime()
        })
    )
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const ChatMessageSchema = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    created_at: z.string().datetime()
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>; 