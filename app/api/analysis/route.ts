import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { analysisPrompt } from "@/lib/prompts";
import { AnalysisRequestSchema, AnalysisResponseSchema } from "@/lib/validation/analysis";
import { validateRequest } from "@/lib/validation/utils";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const [parsedBody, bodyError] = await validateRequest(body, AnalysisRequestSchema);

        if (bodyError) return bodyError;

        const { fen, gameHistory, pv, evalCp, mateIn } = parsedBody;

        // Build centralized analysis prompt with optional eval data
        const prompt = analysisPrompt({
            fen,
            gameHistory,
            pv,
            evalCp: evalCp ?? undefined,
            mateIn: mateIn ?? undefined
        });

        const result = await generateText({
            model: openai("gpt-4o"),
            prompt,
        });

        // "text" contains the generated string according to the ai SDK typings
        const analysis = (result as { text: string }).text ?? "Unable to generate analysis.";

        // Validate response
        const response = { analysis };
        const responseResult = AnalysisResponseSchema.safeParse(response);

        if (!responseResult.success) {
            console.error("Invalid analysis response:", responseResult.error);
            return NextResponse.json({ error: "Failed to generate valid analysis" }, { status: 500 });
        }

        return NextResponse.json(responseResult.data);
    } catch (err) {
        console.error("/api/analysis error", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
