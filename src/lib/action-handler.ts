import { ActionResponse, ServiceError } from '@/types/domain';
import { ZodError } from 'zod';
import { serialize } from '@/lib/utils';
import { logger } from '@/lib/logger';

/**
 * Standardized Action Wrapper for Server Actions (Phase OB5.2)
 * 
 * # Goal: POS Stabilization & ERP Action/Service Standardization
 * 
 * Stabilize the POS architecture and standardize the ERP Action/Service layers for high-integrity audit trails and maintainable code.
 * 
 * ## Phase 1: Resource Migration (POS)
 * - DONE: Establish RPC Bridge for POS.
 * - DONE: Fix server module boundaries.
 * - DONE: Standardize sales channel filtering.
 * 
 * ## Phase 2: Inventory Standardization (CURRENT)
 * - [ ] Centralize ID validation via `entityIdSchema`.
 * - [ ] Move Audit ownership from Action to Service layer.
 * - [ ] Implement Metadata-driven revalidation in Services.
 * - [ ] Cleanup `products.actions.ts`.
 * 
 * Implements a 4-layer strategy:
 * 1. Business Logic (ServiceError) -> Propagate as safe message
 * 2. Validation (ZodError) -> Map to field-specific error keys
 * 3. System (Database/Network/Crash) -> Log as critical, return generic message
 * 4. Serialization (Safe DTO) -> Automatically serialize to plain objects (Phase 7.1)
 */
export type { ActionResponse, ErrorAction, ActionSuccess, ActionFailure } from '@/types/common';

export interface HandleActionOptions {
    skipSerialize?: boolean;
    context?: Record<string, any>;
}

export async function handleAction<T>(
    action: () => Promise<T>,
    options: HandleActionOptions = {}
): Promise<ActionResponse<T>> {
    const { skipSerialize = false, context = {} } = options;
    try {
        const data = await action();

        // 1. Skip serialization if requested
        if (skipSerialize) {
            return { success: true, data: data as T };
        }

        return {
            success: true,
            data: serialize(data) as T,
        };
    } catch (error: unknown) {
        // Handle next.js redirect - should be re-thrown
        if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
            throw error;
        }

        if (error instanceof ServiceError) {
            return {
                success: false,
                message: error.message,
                errors: error.errors,
                action: error.action,
            };
        }

        if (error instanceof ZodError) {
            const fieldErrors: Record<string, string[]> = {};
            error.errors.forEach((err) => {
                const path = err.path.join('.');
                if (!fieldErrors[path]) fieldErrors[path] = [];
                fieldErrors[path].push(err.message);
            });

            return {
                success: false,
                message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
                errors: fieldErrors,
            };
        }

        // Unexpected system error
        const typedError = error as Error;
        await logger.error('Unhandled Action Exception', typedError, context);

        return {
            success: false,
            message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้งหรือติดต่อเจ้าหน้าที่',
        };
    }
}
