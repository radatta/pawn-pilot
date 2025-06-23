import { z } from "zod";

export const ChatRequestSchema = z.object({
    content: z.string().min(1),
    fen_before: z.string(),
    move_san: z.string(),
    pv: z.string(),
    eval_cp: z.number().nullable(),
    mate_in: z.number().nullable(),
    explanation: z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>; 