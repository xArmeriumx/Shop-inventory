import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { logger } from '@/lib/logger';

// ============================================================================
// AUDIT STATUS CONSTANTS
// ============================================================================

export const AUDIT_STATUS = {
  SUCCESS: 'SUCCESS',
  DENIED: 'DENIED',
} as const;

export type AuditStatus = typeof AUDIT_STATUS[keyof typeof AUDIT_STATUS];

// ============================================================================
// AUDIT LOG PARAMS — ERP Rule 12.1
// ============================================================================

export interface AuditLogParams {
  /** Action code e.g. "SALE_CREATE", "TEAM_INVITE", "PERMISSION_DENIED" */
  action: string;
  /** SUCCESS (default) or DENIED */
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
  /** Reason for the action (especially for cancel / deny) */
  reason?: string;
  /** Human-readable note */
  note?: string;
}

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
// AUDIT SERVICE
// ============================================================================

/**
 * ERP Business Audit Service (Rule 12.1)
 * 
 * Logs who did what, to which entity, from which shop, before and after.
 * Best effort — audit log failure NEVER crashes the main flow.
 */
export const AuditService = {
  /**
   * Log a business action with before/after snapshots.
   * Must NEVER throw — always best-effort.
   */
  async log(ctx: RequestContext, params: AuditLogParams): Promise<void> {
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
    } = params;

    try {
      await db.auditLog.create({
        data: {
          shopId: ctx.shopId,
          actorUserId: ctx.userId,
          action,
          status,
          targetType: targetType ?? null,
          targetId: targetId ?? null,
          beforeSnapshot: sanitizeSnapshot(beforeSnapshot) as any,
          afterSnapshot: sanitizeSnapshot(afterSnapshot) as any,
          changedFields: changedFields ?? [],
          reason: reason ?? null,
          note: note ?? null,
        },
      });
    } catch (error) {
      // Best-effort: log failure to system logger but never propagate
      logger.error('[AuditService] Failed to write audit log', { error, action, targetId });
    }
  },

  /**
   * Log a PERMISSION_DENIED event (best-effort, never throws).
   */
  async logDenied(ctx: RequestContext, params: {
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
      },
      topSensitiveActors,
      recentManualStocks,
      recentSettingsChanges,
      recentAnomalies
    };
  },
};
