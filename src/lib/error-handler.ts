import { ServiceError } from '@/types/domain';
import type { ActionResponse } from '@/types/domain';
import { logger } from '@/lib/logger';

/**
 * Standardizes how Server Actions handle errors from the Service layer.
 * 
 * 1. ServiceError: Handled as expected business logic errors (passed to UI).
 * 2. Unexpected Error: Logged as CRITICAL and returned as a generic message to user.
 * 
 * @param error Any caught error
 * @param fallbackMessage Message to show if it's not a ServiceError
 * @param context Optional context for logging (e.g. { userId, action: 'createSale' })
 */
export async function handleActionError(
    error: unknown,
    fallbackMessage: string,
    context?: Record<string, any>
): Promise<ActionResponse<any>> {
    if (error instanceof ServiceError) {
        return {
            success: false,
            message: error.message,
            action: error.action,
        };
    }

    const typedError = error as Error;

    // Log unexpected errors
    await logger.error(fallbackMessage, typedError, context);

    return {
        success: false,
        message: typedError.message || fallbackMessage,
    };
}
