import { db } from '@/lib/db';
import { AuditQueryOptions } from './types';
import { AUDIT_STATUS } from './constants';
import { internalMetrics } from './metrics.store';
import { AuditLoggerEngine } from './logger.engine';

export const AuditQuery = {
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
    return AuditQuery.getActivityLog(shopId, {
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
      governanceHealth: AuditQuery.getGovernanceHealth(),
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
};
