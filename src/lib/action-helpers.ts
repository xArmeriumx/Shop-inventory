import { ActionResponse, ActionSuccess } from '@/types/common';

/**
 * Type guard — narrow ActionResponse to success branch
 */
export function isActionSuccess<T>(
    result: ActionResponse<T>
): result is ActionSuccess<T> {
    return result.success;
}

/**
 * Unwrap data or throw — useful in server components
 * ใช้เมื่อ failure = ไม่สามารถ render หน้าได้เลย (เช่น 500 error)
 */
export function unwrapOrThrow<T>(result: ActionResponse<T>): T {
    if (!result.success) {
        throw new Error(result.message);
    }
    return result.data;
}

/**
 * Unwrap data or return fallback — useful for optional data
 */
export function unwrapOr<T>(result: ActionResponse<T>, fallback: T): T {
    return result.success ? result.data : fallback;
}
