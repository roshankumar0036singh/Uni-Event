import * as functions from 'firebase-functions';
import { z } from 'zod';

export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        throw new functions.https.HttpsError('invalid-argument', 'Validation failed', {
            errors: result.error.flatten(),
        });
    }

    return result.data;
}
