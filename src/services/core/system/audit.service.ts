import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { logger } from '@/lib/logger';
import { NotificationService } from '@/services/core/intelligence/notification.service';

// ============================================================================
// AUDIT STATUS CONSTANTS
// ============================================================================

export const AUDIT_STATUS = {
  SUCCESS: 'SUCCESS',
  DENIED: 'DENIED',
  FAILED: 'FAILED',
} as const;

export type AuditStatus = typeof AUDIT_STATUS[keyof typeof AUDIT_STATUS];

/**
 * Standardized Action Codes (ERP Rule 12.1 Taxonomy)
 */
export const AUDIT_ACTIONS = {
  // Sales
  SALE_CREATE: 'SALE_CREATE',
  SALE_UPDATE: 'SALE_UPDATE',
  SALE_CANCEL: 'SALE_CANCEL',
  SALE_PAYMENT: 'SALE_PAYMENT',
  SALE_INVOICE_GENERATE: 'SALE_INVOICE_GENERATE',
  POS_CHECKOUT: 'POS_CHECKOUT',

  // Quotation
  QUOTATION_CREATE: 'QUOTATION_CREATE',
  QUOTATION_CONFIRM: 'QUOTATION_CONFIRM',
  QUOTATION_CANCEL: 'QUOTATION_CANCEL',

  // Invoice
  INVOICE_POST: 'INVOICE_POST',
  INVOICE_CANCEL: 'INVOICE_CANCEL',

  // Payment
  PAYMENT_RECORD: 'PAYMENT_RECORD',
  PAYMENT_VOID: 'PAYMENT_VOID',

  // Voucher
  RECEIPT_VOUCHER_CREATE: 'RECEIPT_VOUCHER_CREATE',
  PAYMENT_VOUCHER_CREATE: 'PAYMENT_VOUCHER_CREATE',

  // Inventory
  STOCK_ADJUST: 'STOCK_ADJUST',
  STOCK_TRANSFER: 'STOCK_TRANSFER',
  STOCK_TRANSFER_CREATE: 'STOCK_TRANSFER_CREATE',
  STOCK_TRANSFER_COMPLETE: 'STOCK_TRANSFER_COMPLETE',
  STOCK_BULK_PROCESS: 'STOCK_BULK_PROCESS',
  PRODUCT_UPDATE: 'PRODUCT_UPDATE',

  // Logistics / Delivery
  SHIPMENT_CREATE: 'SHIPMENT_CREATE',
  SHIPMENT_UPDATE: 'SHIPMENT_UPDATE',
  SHIPMENT_STATUS: 'SHIPMENT_STATUS',
  ROUTE_PROCESS: 'ROUTE_PROCESS',
  DELIVERY_AVAILABLE: 'DELIVERY_AVAILABLE',
  DELIVERY_CANCELLED: 'DELIVERY_CANCELLED',

  // Finance / Accounting
  JOURNAL_CREATE: 'JOURNAL_CREATE',
  JOURNAL_POST: 'JOURNAL_POST',
  JOURNAL_VOID: 'JOURNAL_VOID',
  BANK_RECONCILE: 'BANK_RECONCILE',

  // Tax
  TAX_POST: 'TAX_POST',
  TAX_VOID: 'TAX_VOID',
  WHT_CERTIFICATE_ISSUE: 'WHT_CERTIFICATE_ISSUE',
  WHT_CERTIFICATE_VOID: 'WHT_CERTIFICATE_VOID',
  WHT_CODE_UPSERT: 'WHT_CODE_UPSERT',
  WHT_CODE_TOGGLE: 'WHT_CODE_TOGGLE',
  WHT_CODE_DELETE: 'WHT_CODE_DELETE',

  // Procurement
  ORDER_REQUEST_CREATE: 'ORDER_REQUEST_CREATE',
  ORDER_REQUEST_SUBMIT: 'ORDER_REQUEST_SUBMIT',
  PURCHASE_CONVERT_FROM_OR: 'PURCHASE_CONVERT_FROM_OR',
  PURCHASE_QUICK_ASSIGN: 'PURCHASE_QUICK_ASSIGN',

  // Shop & Settings
  SHOP_UPDATE: 'SHOP_UPDATE',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  USER_PROFILE_UPDATE: 'USER_PROFILE_UPDATE',

  // Security & IAM
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  IAM_REVOKE_SESSIONS: 'IAM_REVOKE_SESSIONS',
  IAM_SHOP_GENESIS: 'IAM_SHOP_GENESIS',
  IAM_PASSWORD_CHANGE: 'IAM_PASSWORD_CHANGE',
  CROSS_TENANT_ACCESS: 'CROSS_TENANT_ACCESS',
  SETTINGS_ROLES: 'SETTINGS_ROLES',
  TEAM_ROLE_UPDATE: 'TEAM_ROLE_UPDATE',
  ROLE_CREATE: 'ROLE_CREATE',
  ROLE_UPDATE: 'ROLE_UPDATE',
  ROLE_DELETE: 'ROLE_DELETE',
} as const;

// ============================================================================
// AUDIT LOG PARAMS — ERP Rule 12.1
// ============================================================================

export interface AuditLogParams {
  /** Action code e.g. "SALE_CREATE", "SETTINGS_ROLES", "PERMISSION_DENIED" */
  action: string;
  /** SUCCESS (default) or DENIED or FAILED */
  status?: AuditStatus;
  /** Entity type e.g. "Sale", "Purchase", "User", "Role" */
  targetType?: string;
  /** ID of the entity being acted on */
  targetId?: string;
  /** State of the entity BEFORE this action */
  beforeSnapshot?: Record<string, unknown> | null;
  /** State of the entity AFTER this action */
  afterSnapshot?: Record<string, unknown> | null;
  /** Optional list of changed field names */
  changedFields?: string[];
  /** Reason for the action (especially for cancel / deny / fail) */
  reason?: string;
  /** Human-readable note */
  note?: string;

  // --- LEGACY ALIASES (Rule 12.1 Transition) ---
  /** Alias for targetType */
  category?: string;
  /** Alias for targetId */
  resourceId?: string;
  /** Alias for note */
  details?: string;
}

export interface RunWithAuditConfig<T> {
  action: string;
  targetType?: string;
  targetId?: string;
  /** Optional list of fields to include in snapshots (Flat + Allowlist Policy) */
  allowlist?: string[];
  /** Optional function to fetch entity state before mutation */
  beforeSnapshot?: () => Promise<any> | any;
  /** Optional function to resolve targetId from result (e.g. for Create) */
  resolveTargetId?: (result: T) => string | undefined;
  /** Optional function to prepare after snapshot from result */
  afterSnapshot?: (result: T) => Promise<any> | any;
  /** Optional reason/note */
  note?: string;

  // --- LEGACY ALIASES (Rule 12.1 Transition) ---
  /** Alias for targetType */
  category?: string;
  /** Alias for targetId */
  resourceId?: string;
  /** Alias for note */
  details?: string;

  /** Legacy alias for compatibility during transition */
  getBefore?: () => Promise<any> | any;
  getAfter?: (result: T) => Promise<any> | any;
}

/**
 * Type alias for Audit Policy configuration (ERP Rule 12.1)
 */
export type AuditPolicy<T = any> = RunWithAuditConfig<T>;

// ============================================================================
// QUERY OPTIONS
// ============================================================================

export interface AuditQueryOptions {
  page?: number;
  limit?: number;
  action?: string;
  status?: AuditStatus;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// SENSITIVE FIELDS — NEVER LOG THESE
// ============================================================================

const SENSITIVE_FIELDS = new Set([
  'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
  'secret', 'privateKey', 'cookie', 'sessionToken', 'credential',
  'rawCookie', 'jwtSecret'
]);

/**
 * Helper: pickAuditFields - Implement Flat + Allowlist Policy
 */
function pickAuditFields(obj: any, allowlist?: string[]): Record<string, unknown> | null {
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
function sanitizeSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeSnapshot(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ============================================================================
// INTERNAL METRICS (In-memory, Best-effort for Serverless)
// ============================================================================

const internalMetrics = {
  auditWriteFailures: 0,
  permissionDeniedCount: 0,
  rateLimitExceededCount: 0,
  lastIncidentAt: null as Date | null,
};

// ============================================================================
// AUDIT SERVICE
// ============================================================================

export const AuditService = {
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
          changedFields: changedFields ?? AuditService.calculateChangedFields(beforeSnapshot, afterSnapshot),
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

    return AuditService.log(
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

      AuditService.log(ctx, {
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
      AuditService.log(ctx, {
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
    return AuditService.log(ctx, {
      action: params.action,
      status: AUDIT_STATUS.DENIED,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: `Missing permission: ${params.permission}`,
      note: params.note,
    });
  },

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get paginated activity log for this shop.
   */
  async getActivityLog(shopId: string, options: AuditQueryOptions = {}) {
    const {
      page = 1,
      limit = 50,
      action,
      status,
      targetType,
      targetId,
      actorUserId,
      startDate,
      endDate,
    } = options;

    const where: any = { shopId };
    if (action) where.action = action;
    if (status) where.status = status;
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;
    if (actorUserId) where.actorUserId = actorUserId;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get logs for a specific entity (e.g. a Sale or Purchase document).
   */
  async getLogsForEntity(targetType: string, targetId: string, shopId: string) {
    return db.auditLog.findMany({
      where: { shopId, targetType, targetId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get recent DENIED log entries for security review.
   */
  async getDeniedLog(shopId: string, options: AuditQueryOptions = {}) {
    return AuditService.getActivityLog(shopId, {
      ...options,
      status: AUDIT_STATUS.DENIED,
    });
  },

  /**
   * Get metrics and recent high-sensitivity events for the Security Dashboard
   */
  async getSecurityDashboardMetrics(shopId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [
      deniedToday,
      rateLimitToday,
      topSensitiveActors,
      recentManualStocks,
      recentSettingsChanges,
      recentAnomalies
    ] = await Promise.all([
      // 1. Denied events today
      db.auditLog.count({
        where: { shopId, status: AUDIT_STATUS.DENIED, createdAt: { gte: today } }
      }),
      // 2. Rate-limit hits today
      db.auditLog.count({
        where: { shopId, action: 'RATE_LIMIT_EXCEEDED', createdAt: { gte: today } }
      }),
      // 3. Top actors by sensitive actions (last 30 days)
      db.auditLog.groupBy({
        by: ['actorUserId'],
        where: {
          shopId,
          action: { in: ['ROLE_UPDATE', 'USER_INVITE', 'USER_REMOVE', 'IAM_REVOKE_ALL_SESSIONS', 'SETTINGS_SHOP_UPDATE'] },
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 5
      }),
      // 4. Recent manual stock adjustments
      db.auditLog.findMany({
        where: { shopId, action: 'STOCK_MANUAL_ADJUST' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, createdAt: true, actorUserId: true, targetId: true, note: true }
      }),
      // 5. Recent settings changes
      db.auditLog.findMany({
        where: { shopId, action: 'SETTINGS_SHOP_UPDATE' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, createdAt: true, actorUserId: true, changedFields: true }
      }),
      // 6. Revoke / session anomalies
      db.auditLog.findMany({
        where: { shopId, action: 'IAM_REVOKE_ALL_SESSIONS' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, createdAt: true, actorUserId: true, reason: true }
      })
    ]);

    return {
      metrics: {
        deniedToday,
        rateLimitToday,
        auditWriteFailures: internalMetrics.auditWriteFailures,
      },
      topSensitiveActors,
      recentManualStocks,
      recentSettingsChanges,
      recentAnomalies,
      governanceHealth: AuditService.getGovernanceHealth(),
    };
  },

  /**
   * Get overall governance health status (In-memory metrics)
   */
  getGovernanceHealth() {
    return {
      auditWriteFailures: internalMetrics.auditWriteFailures,
      permissionDeniedCount: internalMetrics.permissionDeniedCount,
      rateLimitExceededCount: internalMetrics.rateLimitExceededCount,
      lastIncidentAt: internalMetrics.lastIncidentAt,
      status: internalMetrics.auditWriteFailures > 10 ? 'CRITICAL' : (internalMetrics.auditWriteFailures > 0 ? 'WARNING' : 'HEALTHY'),
    };
  },

  /**
   * เปรียบเทียบข้อมูล 2 ชุดเพื่อหาว่าฟิลด์ไหนเปลี่ยนบ้าง (Phase 12.1 Auto-Diff)
   */
  calculateChangedFields(before?: any, after?: any): string[] {
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
  },
};
