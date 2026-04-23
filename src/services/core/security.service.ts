import { ServiceError, type RequestContext } from '@/types/domain';
import type { Permission } from '@prisma/client';
import { AuditService } from './audit.service';
import { getPermission } from '@/constants/permissions';

/**
 * Service Layer Authorization Guard (8-Pillar Security Standard)
 */
export const Security = {
  /**
   * Ensure user has a specific permission. (Standard: MODULE_ACTION)
   */
  require: (ctx: RequestContext, permission: Permission) => {
    if (ctx.isOwner) return;

    if (!ctx.permissions.includes(permission)) {
      Security.handleDenied(ctx, permission);
    }
  },

  /**
   * Ensure user has at least one of the specified permissions.
   */
  requireAny: (ctx: RequestContext, permissions: Permission[]) => {
    if (ctx.isOwner) return;

    const hasAny = permissions.some(p => ctx.permissions.includes(p));
    if (!hasAny) {
      Security.handleDenied(ctx, permissions.join(' | '));
    }
  },

  /**
   * Ensure user has ALL of the specified permissions.
   */
  requireAll: (ctx: RequestContext, permissions: Permission[]) => {
    if (ctx.isOwner) return;

    const hasAll = permissions.every(p => ctx.permissions.includes(p));
    if (!hasAll) {
      const missing = permissions.filter(p => !ctx.permissions.includes(p));
      Security.handleDenied(ctx, permissions.join(' & '), `Missing: ${missing.join(', ')}`);
    }
  },

  /**
   * Special Guard: Pass if user is the resource owner OR has the specific permission.
   */
  requireOwnerOr: (ctx: RequestContext, ownerMemberId: string | undefined, permission: Permission) => {
    if (ctx.isOwner) return;
    if (ownerMemberId && ctx.memberId === ownerMemberId) return;

    Security.require(ctx, permission);
  },

  /**
   * Multi-tenant Isolation: Ensure resource belongs to the current shop.
   */
  assertSameShop: (ctx: RequestContext, resourceShopId: string | null | undefined) => {
    if (!resourceShopId) return;

    if (ctx.shopId !== resourceShopId) {
      console.error(`[SECURITY] Cross-tenant attempt: User ${ctx.userId} (Shop ${ctx.shopId}) → Shop ${resourceShopId}`);

      AuditService.logDenied(ctx, {
        action: 'CROSS_TENANT_ACCESS',
        permission: 'DATA_ISOLATION',
        note: `Attempted access to shop ${resourceShopId}`,
      }).catch(() => { });

      throw new ServiceError('สิทธิ์การเข้าถึงข้ามสาขาถูกปฏิเสธ: ตรวจพบความผิดปกติของข้อมูล');
    }
  },

  /**
   * Centralized Deny Handler with Registry Metadata (Pillar 1.7)
   */
  handleDenied: (ctx: RequestContext, permissionCode: string, extraNote?: string) => {
    const meta = getPermission(permissionCode);
    const label = meta?.label || permissionCode;
    const risk = meta?.risk || 'medium';

    console.warn(`[SECURITY][${risk.toUpperCase()}] Unauthorized: User ${ctx.userId} (Shop ${ctx.shopId}) → ${permissionCode} DENIED`);

    // Pillar 1.7: Auditable Security Actions
    AuditService.logDenied(ctx, {
      action: 'PERMISSION_DENIED',
      permission: permissionCode,
      note: `${extraNote ? extraNote + '. ' : ''}User attempted action requiring ${label}. Risk: ${risk}`,
    }).catch(() => { });

    throw new ServiceError(`คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้ (${label})`);
  },

  /**
   * Legacy wrapper for backward compatibility
   */
  requirePermission: (ctx: RequestContext, permission: Permission) => Security.require(ctx, permission),
  requireAnyPermission: (ctx: RequestContext, permissions: Permission[]) => Security.requireAny(ctx, permissions),
};
