import { ServiceError, type RequestContext } from '@/types/domain';
import type { Permission } from '@prisma/client';
import { AuditService, AUDIT_STATUS } from './audit.service';

/**
 * Service Layer Authorization Guard
 * 
 * Part of Defense in Depth strategy. Even if Route/Action level guards are bypassed,
 * the Service Layer will independently verify the identity and permissions.
 * 
 * Rule 12.1: All DENIED events are logged as best-effort audit trail.
 */
export const Security = {
  /**
   * Ensure user has a specific permission.
   * Logs PERMISSION_DENIED audit event before throwing — best-effort (never crashes flow).
   */
  requirePermission: (ctx: RequestContext, permission: Permission) => {
    // 1. Owner bypass
    if (ctx.isOwner) return;

    // 2. Permission check
    if (!ctx.permissions.includes(permission)) {
      console.warn(`[SECURITY] Unauthorized: User ${ctx.userId} (Shop ${ctx.shopId}) → ${permission} DENIED`);

      // Best-effort audit log — do NOT await, do NOT let failure block the throw
      AuditService.logDenied(ctx, {
        action: 'PERMISSION_DENIED',
        permission,
        note: `User attempted action requiring ${permission}`,
      }).catch(() => {
        // Silently ignore audit failure — security throw must always happen
      });

      throw new ServiceError(`คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้ (${permission})`);
    }
  },

  /**
   * Ensure user has at least one of the specified permissions.
   */
  requireAnyPermission: (ctx: RequestContext, permissions: Permission[]) => {
    if (ctx.isOwner) return;

    const hasAny = permissions.some(p => ctx.permissions.includes(p));
    if (!hasAny) {
      const permList = permissions.join(', ');
      console.warn(`[SECURITY] Unauthorized: User ${ctx.userId} → any of [${permList}] DENIED`);

      AuditService.logDenied(ctx, {
        action: 'PERMISSION_DENIED',
        permission: permList,
        note: `User attempted action requiring any of: ${permList}`,
      }).catch(() => {});

      throw new ServiceError('คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้');
    }
  },

  /**
   * Ensure the resource belongs to the user's shop.
   * Critical for multi-tenant isolation.
   */
  requireTenant: (ctx: RequestContext, resourceShopId: string | undefined | null) => {
    if (!resourceShopId) return; // Allow if resource has no shop (global)

    if (ctx.shopId !== resourceShopId) {
      console.error(`[SECURITY] Cross-tenant attempt: User ${ctx.userId} (Shop ${ctx.shopId}) → Shop ${resourceShopId}`);

      AuditService.logDenied(ctx, {
        action: 'CROSS_TENANT_ACCESS',
        permission: 'TENANT_ISOLATION',
        note: `Attempted to access resource from shop ${resourceShopId}`,
      }).catch(() => {});

      throw new ServiceError('บันทึกข้อมูลไม่สำเร็จ: ตรวจพบการพยายามเข้าถึงข้อมูลข้ามสาขา');
    }
  },
};
