import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Permission } from '@prisma/client';
import { db } from '@/lib/db';

/**
 * Session context with RBAC information
 * This is the server-side context used for authorization
 */
export interface SessionContext {
  userId: string;
  shopId?: string;
  roleId?: string;
  permissions: Permission[];
  isOwner: boolean;
  employeeDepartment?: string;
  sessionVersion?: number;
}

/**
 * Session context with guaranteed shopId
 */
export interface ShopSessionContext extends SessionContext {
  shopId: string;
}

/**
 * Cached session context fetcher - memoized per request.
 * 
 * Source of Truth: 
 * - Identity/Metadata: Auth.js Session (JWT)
 * - Permissions/Roles: Database (ShopMember)
 * - Revocation: Database (User.sessionVersion)
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }

  // Identity from Session (JWT)
  const userId = session.user.id;
  const sessionVersion = (session.user as any).sessionVersion;

  // Permissions from Database (Source of Truth)
  // This satisfies Rule 2.2: Single Source of Truth
  const membership = await db.shopMember.findFirst({
    where: { userId },
    select: {
      shopId: true,
      roleId: true,
      isOwner: true,
      departmentCode: true,
      role: { 
        select: { 
          permissions: true 
        } 
      }
    }
  });

  if (!membership) {
    return {
      userId,
      shopId: undefined,
      roleId: undefined,
      permissions: [],
      isOwner: false,
      sessionVersion,
    };
  }

  return {
    userId,
    shopId: membership.shopId,
    roleId: membership.roleId ?? undefined,
    permissions: (membership.role?.permissions as Permission[]) ?? [],
    isOwner: membership.isOwner,
    employeeDepartment: membership.departmentCode ?? undefined,
    sessionVersion,
  };
});

/**
 * Check if the session is still valid (not revoked)
 * Only call this for sensitive operations to minimize DB load
 */
export async function validateSessionFreshness(ctx: SessionContext): Promise<boolean> {
  if (!ctx.userId || ctx.sessionVersion === undefined) return false;

  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { sessionVersion: true }
  });

  // If version in DB is higher than version in JWT, session is stale/revoked
  return user?.sessionVersion === ctx.sessionVersion;
}

/**
 * Get current user session, redirect to login if not authenticated
 */
export async function requireAuth(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  
  if (!ctx) {
    redirect('/login');
  }

  return ctx;
}

/**
 * Require user to have a shop membership
 */
export async function requireShop(): Promise<ShopSessionContext> {
  const ctx = await requireAuth();
  
  if (!ctx.shopId) {
    redirect('/onboarding');
  }
  
  return ctx as ShopSessionContext;
}

/**
 * List of sensitive permissions that require session freshness check
 */
const SENSITIVE_PERMISSIONS: Permission[] = [
  'TEAM_REMOVE', 'TEAM_EDIT', 'TEAM_INVITE',
  'PURCHASE_CANCEL', 'SALE_CANCEL',
  'SETTINGS_SHOP', 'SETTINGS_LOOKUPS',
  'PRODUCT_DELETE'
];

/**
 * Require a specific permission, throw if not authorized.
 * For sensitive permissions, also validates session freshness.
 */
export async function requirePermission(permission: Permission): Promise<ShopSessionContext> {
  const ctx = await requireShop();
  
  // 1. RBAC Check
  if (!hasPermission(ctx, permission)) {
    redirect('/dashboard');
  }

  // 2. Freshness Check for sensitive operations (Revocation support)
  if (SENSITIVE_PERMISSIONS.includes(permission)) {
    const isFresh = await validateSessionFreshness(ctx);
    if (!isFresh) {
      // Session revoked (e.g. password change, "Logout all devices")
      redirect('/login?error=SessionExpired');
    }
  }
  
  return ctx;
}

/**
 * Check if session context has a specific permission
 */
export function hasPermission(ctx: SessionContext, permission: Permission): boolean {
  if (ctx.isOwner) return true;
  return ctx.permissions.includes(permission);
}

/**
 * Helper to get the trusted Shop ID for services
 */
export async function getTrustedShopId(): Promise<string> {
  const ctx = await requireShop();
  return ctx.shopId;
}
