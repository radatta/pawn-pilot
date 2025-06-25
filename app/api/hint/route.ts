import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { hintPrompt } from "@/lib/prompts";
import { HintQuerySchema, HintResponseSchema } from "@/lib/validation/hint";
import { validateQuery } from "@/lib/validation/utils";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const queryParams = Object.fromEntries(searchParams.entries());

        const [parsedQuery, queryError] = await validateQuery(queryParams, HintQuerySchema);
        if (queryError) return queryError;

        const { fen } = parsedQuery;

        // Use centralized hint prompt
        const prompt = hintPrompt(fen);

        const result = await generateText({ model: openai("gpt-4o"), prompt });
        // According to the ai SDK typings, the generated text is exposed via the "text" key
        const analysis = (result as { text: string }).text ?? "Unable to generate hint.";

        // Validate response
        const response = { analysis };
        const responseResult = HintResponseSchema.safeParse(response);

        if (!responseResult.success) {
            console.error("Invalid hint response:", responseResult.error);
            return NextResponse.json({ error: "Failed to generate valid hint" }, { status: 500 });
        }

        return NextResponse.json(responseResult.data);
    } catch (err) {
        console.error("/api/hint error", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
} 