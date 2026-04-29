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
 * 3. System (Database/Network/Crash) -> Log as critical, return classifiable message + trace ID
 * 4. Serialization (Safe DTO) -> Automatically serialize to plain objects (Phase 7.1)
 */
export type { ActionResponse, ErrorAction, ActionSuccess, ActionFailure } from '@/types/common';

export interface HandleActionOptions {
    skipSerialize?: boolean;
    context?: Record<string, any>;
}

/**
 * Classify unknown errors into user-readable categories.
 * 
 * ⚠️ Security: ห้ามส่ง stack trace หรือ SQL กลับไปยัง client
 * แต่ต้องให้ข้อมูลพอให้ user/admin เข้าใจว่าเกิดอะไร
 */
function classifyError(error: Error): { code: string; userMessage: string; severity: 'warn' | 'error' | 'critical' } {
    const msg = error.message || '';
    const name = error.name || '';

    // ── Prisma: Connection Pool ──────────────────────────────────────
    if (msg.includes('Timed out fetching a new connection from the connection pool')) {
        return {
            code: 'DB_POOL_TIMEOUT',
            userMessage: 'ระบบฐานข้อมูลมีภาระงานสูง กรุณารอสักครู่แล้วลองใหม่',
            severity: 'critical',
        };
    }

    // ── Prisma: Transaction timeout ─────────────────────────────────
    if (msg.includes('Transaction already closed') || msg.includes('Transaction API error')) {
        return {
            code: 'DB_TX_CLOSED',
            userMessage: 'การดำเนินการใช้เวลานานเกินไป ระบบยกเลิกอัตโนมัติ กรุณาลองใหม่',
            severity: 'error',
        };
    }

    // ── Prisma: Unique constraint ───────────────────────────────────
    if (msg.includes('Unique constraint failed') || (name === 'PrismaClientKnownRequestError' && msg.includes('P2002'))) {
        return {
            code: 'DB_DUPLICATE',
            userMessage: 'ข้อมูลนี้มีอยู่แล้วในระบบ กรุณาตรวจสอบรหัสหรือเลขที่เอกสาร',
            severity: 'warn',
        };
    }

    // ── Prisma: Record not found ────────────────────────────────────
    if (msg.includes('Record to update not found') || (name === 'PrismaClientKnownRequestError' && msg.includes('P2025'))) {
        return {
            code: 'DB_NOT_FOUND',
            userMessage: 'ไม่พบข้อมูลที่ต้องการ อาจถูกลบหรือแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรช',
            severity: 'warn',
        };
    }

    // ── Prisma: Foreign key / relation ───────────────────────────────
    if (msg.includes('Foreign key constraint failed') || (name === 'PrismaClientKnownRequestError' && msg.includes('P2003'))) {
        return {
            code: 'DB_RELATION_ERROR',
            userMessage: 'ไม่สามารถดำเนินการได้ เนื่องจากข้อมูลนี้มีความเชื่อมโยงกับรายการอื่น',
            severity: 'warn',
        };
    }

    // ── Prisma: Invalid input / missing field ───────────────────────
    if (msg.includes('Argument') && msg.includes('is missing') || name === 'PrismaClientValidationError') {
        return {
            code: 'DB_INVALID_INPUT',
            userMessage: 'ข้อมูลที่ส่งไม่ครบถ้วน กรุณาตรวจสอบฟอร์มแล้วลองใหม่',
            severity: 'error',
        };
    }

    // ── Network / Fetch errors ──────────────────────────────────────
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
        return {
            code: 'NETWORK_ERROR',
            userMessage: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
            severity: 'critical',
        };
    }

    // ── Permission / Auth ───────────────────────────────────────────
    if (msg.includes('permission') || msg.includes('unauthorized') || msg.includes('ไม่มีสิทธิ์')) {
        return {
            code: 'AUTH_DENIED',
            userMessage: 'คุณไม่มีสิทธิ์ในการดำเนินการนี้',
            severity: 'warn',
        };
    }

    // ── Default: Unknown system error ───────────────────────────────
    return {
        code: 'SYSTEM_ERROR',
        userMessage: 'เกิดข้อผิดพลาดภายในระบบ',
        severity: 'critical',
    };
}

/**
 * Generate a short trace ID for error tracking.
 * Format: ERR-XXXXXX (6 chars, alphanumeric uppercase)
 */
function generateTraceId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 (ambiguous)
    let result = 'ERR-';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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

        if (error instanceof ServiceError || (error as any)?.name === 'ServiceError') {
            return {
                success: false,
                message: (error as any).message,
                errors: (error as any).errors,
                action: (error as any).action,
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

        // ── Enhanced System Error Handling ───────────────────────────
        const typedError = error as Error;
        const traceId = generateTraceId();
        const classified = classifyError(typedError);

        // Log with full context for debugging (server-side only)
        await logger.error(`[${classified.code}] ${traceId}: ${typedError.message}`, typedError, {
            ...context,
            traceId,
            errorCode: classified.code,
            severity: classified.severity,
        });

        return {
            success: false,
            message: `${classified.userMessage} (รหัส: ${traceId})`,
        };
    }
}
