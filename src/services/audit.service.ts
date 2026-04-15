import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { logger } from '@/lib/logger';

export interface AuditLogParams {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  note?: string;
}

/**
 * ERP Business Audit Service (Rule 12.1)
 * Handles high-level action logging with data snapshots (Level 2)
 */
export const AuditService = {
  /**
   * Log a business action with an optional data snapshot
   */
  async log(ctx: RequestContext, params: AuditLogParams) {
    const { action, entityType, entityId, metadata, note } = params;

    try {
      return await db.auditLog.create({
        data: {
          shopId: ctx.shopId,
          userId: ctx.userId,
          action,
          entityType,
          entityId,
          metadata: metadata || null,
          note,
        },
      });
    } catch (error) {
      // We don't want audit logging failures to crash the main transaction, 
      // but in an ERP, some might consider it critical. 
      // For this implementation, we log the failure and continue.
      logger.error('Failed to create audit log:', { error, action, entityId });
    }
  },

  /**
   * Get audit logs for a specific document
   */
  async getLogsForEntity(entityType: string, entityId: string, shopId: string) {
    return db.auditLog.findMany({
      where: {
        shopId,
        entityType,
        entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
};
