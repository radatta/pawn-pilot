/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

// Wrap a Next.js route handler with a top-level try/catch so unhandled
// exceptions are logged and converted into a consistent 500 response.

export function withErrorHandling<
    // Generic to preserve parameter & return types of the wrapped handler
    H extends (...args: any[]) => Promise<Response>
>(handler: H): (...args: Parameters<H>) => Promise<Response> {
    return async (...args: Parameters<H>): Promise<Response> => {
        try {
            return await handler(...args);
        } catch (err) {
            console.error("Unhandled API route error", err);
            return NextResponse.json(
                { error: "Internal Server Error" },
                { status: 500 }
            );
        }
    };
} 