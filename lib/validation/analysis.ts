import { z } from "zod";

export const AnalysisRequestSchema = z.object({
    fen: z.string().min(1, "FEN position is required"),
    gameHistory: z.string().min(1, "Game history is required"),
    pv: z.string().min(1, "Principal variation is required"),
    evalCp: z.number().nullable().optional(),
    mateIn: z.number().nullable().optional(),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export const AnalysisResponseSchema = z.object({
    analysis: z.string(),
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>; 