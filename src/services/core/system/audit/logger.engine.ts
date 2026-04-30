import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { logger } from '@/lib/logger';
import { NotificationService } from '@/services/core/intelligence/notification.service';
import { AUDIT_STATUS, AuditStatus, SENSITIVE_FIELDS } from './constants';
import { AuditLogParams, RunWithAuditConfig } from './types';
import { internalMetrics } from './metrics.store';
import { redact } from '@/lib/redact';

/**
 * Helper: pickAuditFields - Implement Flat + Allowlist Policy
 */
export function pickAuditFields(obj: any, allowlist?: string[]): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  if (!allowlist || allowlist.length === 0) return null;

  const result: Record<string, unknown> = {};
  for (const field of allowlist) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * Strip sensitive fields from a snapshot before storing.
 * Best-effort — prevents logging credentials or tokens.
 * ERP Rule 12.1 — Explainable Automation Rule
 */
export function sanitizeSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return redact(snapshot) as Record<string, unknown>;
}

/**
 * เปรียบเทียบข้อมูล 2 ชุดเพื่อหาว่าฟิลด์ไหนเปลี่ยนบ้าง (Phase 12.1 Auto-Diff)
 */
export function calculateChangedFields(before?: any, after?: any): string[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];

  try {
    const changes: string[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of Array.from(keys)) {
      // ข้ามฟิลด์ที่เป็น metadata หรือความสัมพันธ์ที่ซับซ้อน
      if (['updatedAt', 'createdAt', 'version', 'id', 'shopId', 'userId'].includes(key)) continue;

      const valBefore = JSON.stringify(before[key]);
      const valAfter = JSON.stringify(after[key]);

      if (valBefore !== valAfter) {
        changes.push(key);
      }
    }
    return changes;
  } catch (e) {
    return [];
  }
}

export const AuditLoggerEngine = {
  /**
   * Log a business action with before/after snapshots.
   * Must NEVER throw — always best-effort.
   */
  async log(ctx: { userId: string; shopId?: string; userName?: string; userEmail?: string }, params: AuditLogParams, tx?: any): Promise<void> {
    const {
      action,
      status = AUDIT_STATUS.SUCCESS,
      targetType,
      targetId,
      beforeSnapshot,
      afterSnapshot,
      changedFields,
      reason,
      note,
      category,
      resourceId,
      details,
    } = params;

    const finalTargetType = targetType || category || null;
    const finalTargetId = targetId || resourceId || null;
    const finalNote = note || details || null;

    try {
      const client = tx || db;
      await client.auditLog.create({
        data: {
          shopId: ctx.shopId,
          actorUserId: ctx.userId ?? null,
          actorName: ctx.userName ?? null,
          actorEmail: ctx.userEmail ?? null,
          action,
          status,
          targetType: finalTargetType,
          targetId: finalTargetId,
          beforeSnapshot: sanitizeSnapshot(beforeSnapshot) as any,
          afterSnapshot: sanitizeSnapshot(afterSnapshot) as any,
          changedFields: changedFields ?? calculateChangedFields(beforeSnapshot, afterSnapshot),
          reason: reason ?? null,
          note: finalNote,
        },
      });

      // Update metrics for success types that are security relevant
      if (status === AUDIT_STATUS.DENIED) {
        internalMetrics.permissionDeniedCount++;
        internalMetrics.lastIncidentAt = new Date();

        // Trigger Proactive Alert (Phase 5)
        if (ctx.shopId) {
          NotificationService.create({
            shopId: ctx.shopId,
            type: 'GOVERNANCE_INCIDENT',
            severity: 'CRITICAL',
            title: 'ความพยายามเข้าถึงถูกปฏิเสธ',
            message: `ผู้ใช้ ${ctx.userName || 'Unknown'} พยายามทำรายการ ${action} แต่ไม่มีสิทธิ์`,
            link: `/system/audit-logs?status=DENIED`,
            groupKey: `gov-incident:${ctx.shopId}:${action}`, // Dedup per action type
          }).catch(err => logger.error('[AuditService] Failed to trigger notification', err));
        }
      }
      if (action === 'RATE_LIMIT_EXCEEDED') {
        internalMetrics.rateLimitExceededCount++;
      }
    } catch (error) {
      // Best-effort: log failure to system logger but never propagate
      internalMetrics.auditWriteFailures++;
      internalMetrics.lastIncidentAt = new Date();
      logger.error('[AuditService] Failed to write audit log', { error, action, targetId });
    }
  },

  /**
   * Modern wrapper for logging an audit event.
   * 
   * ERP Rule 12.1 — Proactive Traceability
   * Maps modern param names (actorId, before, after) to the internal log schema.
   */
  async record(params: {
    shopId?: string;
    userId?: string;
    actorId?: string; // alias for userId
    action: string;
    status?: AuditStatus;
    targetType?: string;
    targetId?: string;
    before?: any;
    after?: any;
    note?: string;
    reason?: string;
  }, tx?: any): Promise<void> {
    const {
      shopId, userId, actorId, action, status,
      targetType, targetId, before, after, note, reason
    } = params;

    return AuditLoggerEngine.log(
      {
        userId: (userId || actorId) as string,
        shopId
      },
      {
        action,
        status,
        targetType,
        targetId,
        beforeSnapshot: before,
        afterSnapshot: after,
        note,
        reason,
      },
      tx
    );
  },

  /**
   * orchestration wrapper - runWithAudit
   * Wrap critical business logic with automatic success/fail auditing.
   * Does NOT manage transactions (Flexible Policy).
   */
  async runWithAudit<T>(
    ctx: RequestContext,
    config: RunWithAuditConfig<T>,
    execute: () => Promise<T>,
    tx?: any
  ): Promise<T> {
    const { action, targetType, category, allowlist, resolveTargetId, note, details, resourceId } = config;
    const beforeFn = config.beforeSnapshot || config.getBefore;
    const afterFn = config.afterSnapshot || config.getAfter;

    let targetTypeVal = targetType || category || 'Unknown';
    let targetId = config.targetId || resourceId;
    let noteVal = note || details;
    let beforeSnapshot: any = null;

    // 1. Capture Before State (Optional)
    if (beforeFn) {
      try {
        const rawBefore = await beforeFn();
        beforeSnapshot = pickAuditFields(rawBefore, allowlist);
      } catch (err) {
        logger.warn('[AuditService] Failed to capture before snapshot', { action, err });
      }
    }

    try {
      // 2. Execute Business Logic
      const result = await execute();

      // 3. Resolve Target ID if not provided (e.g. for Create)
      if (!targetId && resolveTargetId) {
        targetId = resolveTargetId(result);
      }

      // 4. Capture After State (Optional)
      let afterSnapshot: any = null;
      if (afterFn) {
        try {
          const rawAfter = await afterFn(result);
          afterSnapshot = pickAuditFields(rawAfter, allowlist);
        } catch (err) {
          logger.warn('[AuditService] Failed to capture after snapshot', { action, err });
        }
      }
      else if (allowlist) {
        // Fallback: try to pick from the result directly if it's the entity
        afterSnapshot = pickAuditFields(result, allowlist);
      }

      // 5. Success Log (Non-blocking for performance)
      // ERP Phase 7 Solution: Fire-and-forget business side-effects
      const ctxMetadata = (ctx as any).auditMetadata || {};

      AuditLoggerEngine.log(ctx, {
        action,
        status: AUDIT_STATUS.SUCCESS,
        targetType: targetTypeVal,
        targetId,
        beforeSnapshot: beforeSnapshot ? { ...beforeSnapshot, ...ctxMetadata.before } : ctxMetadata.before,
        afterSnapshot: sanitizeSnapshot(afterSnapshot ? { ...afterSnapshot, ...ctxMetadata.after } : ctxMetadata.after) as any,
        note: noteVal,
      }, tx).catch(err => logger.error('[AuditService] success log failed', err));

      return result;
    } catch (error: any) {
      // 6. Failure Log (Non-blocking)
      AuditLoggerEngine.log(ctx, {
        action,
        status: AUDIT_STATUS.FAILED,
        targetType,
        targetId,
        beforeSnapshot,
        reason: error.message || 'Unknown error',
        note,
      }, tx).catch(err => logger.error('[AuditService] failure log failed', err));

      // 7. Rethrow original error (Safety Rule)
      throw error;
    }
  },

  /**
   * Log a PERMISSION_DENIED event (best-effort, never throws).
   */
  async logDenied(ctx: { userId: string; shopId?: string; userName?: string; userEmail?: string }, params: {
    action: string;
    permission: string;
    targetType?: string;
    targetId?: string;
    note?: string;
  }): Promise<void> {
    return AuditLoggerEngine.log(ctx, {
      action: params.action,
      status: AUDIT_STATUS.DENIED,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: `Missing permission: ${params.permission}`,
      note: params.note,
    });
  },
};
