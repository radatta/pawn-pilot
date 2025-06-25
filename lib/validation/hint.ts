import { z } from "zod";

export const HintQuerySchema = z.object({
    fen: z.string().min(1, "FEN position is required"),
});

export type HintQuery = z.infer<typeof HintQuerySchema>;

export const HintResponseSchema = z.object({
    analysis: z.string(),
});

export type HintResponse = z.infer<typeof HintResponseSchema>; 