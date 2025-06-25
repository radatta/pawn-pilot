import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Validates request body against a Zod schema and returns the parsed data or an error response
 * 
 * @param body The request body to validate
 * @param schema The Zod schema to validate against
 * @returns A tuple of [parsedData, null] if validation succeeds, or [null, errorResponse] if it fails
 */
export async function validateRequest<T extends z.ZodType>(
    body: unknown,
    schema: T
): Promise<[z.infer<T>, null] | [null, NextResponse]> {
    const result = await schema.safeParseAsync(body);

    if (!result.success) {
        const errorResponse = NextResponse.json(
            {
                error: "Validation error",
                details: result.error.format()
            },
            { status: 400 }
        );
        return [null, errorResponse];
    }

    return [result.data, null];
}

/**
 * Validates request params against a Zod schema and returns the parsed data or an error response
 * 
 * @param params The request params to validate
 * @param schema The Zod schema to validate against
 * @returns A tuple of [parsedData, null] if validation succeeds, or [null, errorResponse] if it fails
 */
export async function validateParams<T extends z.ZodType>(
    params: unknown,
    schema: T
): Promise<[z.infer<T>, null] | [null, NextResponse]> {
    const result = await schema.safeParseAsync(params);

    if (!result.success) {
        const errorResponse = NextResponse.json(
            {
                error: "Invalid parameters",
                details: result.error.format()
            },
            { status: 400 }
        );
        return [null, errorResponse];
    }

    return [result.data, null];
}

/**
 * Validates query parameters against a Zod schema and returns the parsed data or an error response
 * 
 * @param query The query parameters to validate
 * @param schema The Zod schema to validate against
 * @returns A tuple of [parsedData, null] if validation succeeds, or [null, errorResponse] if it fails
 */
export async function validateQuery<T extends z.ZodType>(
    query: Record<string, string | string[]>,
    schema: T
): Promise<[z.infer<T>, null] | [null, NextResponse]> {
    const result = await schema.safeParseAsync(query);

    if (!result.success) {
        const errorResponse = NextResponse.json(
            {
                error: "Invalid query parameters",
                details: result.error.format()
            },
            { status: 400 }
        );
        return [null, errorResponse];
    }

    return [result.data, null];
}

/**
 * Creates a Zod schema for validating route parameters
 * 
 * @param schema The schema definition object
 * @returns A Zod schema for route parameters
 */
export function createRouteParamsSchema<T extends Record<string, z.ZodType>>(schema: T) {
    return z.object(schema);
}

/**
 * Validates that a string is a valid UUID
 */
export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Validates that a string is a valid positive integer
 */
export const positiveIntSchema = z
    .string()
    .refine((val) => /^\d+$/.test(val), {
        message: "Must be a positive integer",
    })
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, {
        message: "Must be greater than 0",
    });

/**
 * Common route parameter schema for game routes
 */
export const gameRouteParamsSchema = createRouteParamsSchema({
    gameId: uuidSchema,
});

/**
 * Common route parameter schema for move routes
 */
export const moveRouteParamsSchema = createRouteParamsSchema({
    gameId: uuidSchema,
    moveNumber: positiveIntSchema,
}); 