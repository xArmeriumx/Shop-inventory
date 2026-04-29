import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Permission } from '@prisma/client';
import { db } from '@/lib/db';
import { rateLimiters, checkRateLimit, type RateLimitPolicy } from '@/lib/rate-limit';

/**
 * Session context with RBAC information
 * This is the server-side context used for authorization
 */
export interface SessionContext {
  userId: string;
  userName?: string;
  userEmail?: string;
  shopId?: string;
  memberId?: string; // Add this
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
 * Target: 1 Request = 1 Authentication Resolution.
 */
// Server-side permission cache (In-memory, non-sensitive, keyed by userId_shopId_version)
const permissionCache = new Map<string, { permissions: Permission[], isOwner: boolean, memberId: string }>();

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const userId = session.user.id;
  const shopId = session.user.shopId;
  const sessionVersion = session.user.sessionVersion || 1;

  // 1. FAST PATH: Check Permission Cache if we have shopId
  if (shopId) {
    // Check DB for current sessionVersion AND permissionVersion
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        sessionVersion: true,
        memberships: {
          where: { shopId },
          take: 1,
          select: { permissionVersion: true }
        }
      }
    });

    if (user && user.sessionVersion <= sessionVersion) {
      const member = user.memberships[0];
      if (member) {
        const dbPermissionVersion = member.permissionVersion;
        const cacheKey = `${userId}:${shopId}:${dbPermissionVersion}`;
        const cached = permissionCache.get(cacheKey);

        if (cached) {
          return {
            userId,
            userName: session.user.name || "Unknown User",
            userEmail: session.user.email,
            shopId,
            memberId: cached.memberId,
            permissions: cached.permissions,
            isOwner: cached.isOwner,
            sessionVersion: user.sessionVersion,
          };
        }
      }
    }
  }

  /**
   * SLOW PATH: First time or Version Mismatch
   * Fetch full RBAC and update cache.
   */
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      sessionVersion: true,
      name: true,
      email: true,
      memberships: {
        where: shopId ? { shopId } : undefined,
        take: 1,
        select: {
          id: true,
          shopId: true,
          roleId: true,
          isOwner: true,
          permissionVersion: true,
          departmentCode: true,
          role: { select: { permissions: true } }
        }
      }
    }
  });

  if (!user || user.sessionVersion > sessionVersion) {
    return null;
  }

  const membership = user.memberships[0];
  if (!membership) {
    return {
      userId,
      userName: user.name || "Unknown",
      shopId: undefined,
      permissions: [],
      isOwner: false,
    };
  }

  // Update Cache for future requests in this process
  const permissions = (membership.role?.permissions as Permission[]) ?? [];
  const cacheKey = `${userId}:${membership.shopId}:${membership.permissionVersion}`;
  permissionCache.set(cacheKey, {
    permissions,
    isOwner: membership.isOwner,
    memberId: membership.id
  });

  return {
    userId,
    userName: user.name || "Unknown",
    userEmail: user.email,
    shopId: membership.shopId,
    memberId: membership.id,
    roleId: membership.roleId ?? undefined,
    permissions,
    isOwner: membership.isOwner,
    employeeDepartment: membership.departmentCode ?? undefined,
    sessionVersion: user.sessionVersion,
  };
});

/**
 * Get current user session, redirect to login if not authenticated.
 * Supports selective Engine-Level Rate Limiting.
 */
export async function requireAuth(options?: { rateLimitPolicy?: RateLimitPolicy; actionName?: string }): Promise<SessionContext> {
  const ctx = await getSessionContext();

  if (!ctx) {
    redirect('/login');
  }

  if (options?.rateLimitPolicy && options.rateLimitPolicy !== 'none') {
    const limiter = rateLimiters[options.rateLimitPolicy];
    const identifier = ctx.shopId ? `shop:${ctx.shopId}:${options.rateLimitPolicy}` : `user:${ctx.userId}:${options.rateLimitPolicy}`;
    const rlResult = await checkRateLimit(limiter, identifier, ctx, options.actionName || options.rateLimitPolicy);

    if (!rlResult.success) {
      throw new Error(`Rate limit exceeded for action: ${options.actionName || options.rateLimitPolicy}. Please try again later.`);
    }
  }

  return ctx;
}

/**
 * Require user to have a shop membership
 */
export async function requireShop(options?: { rateLimitPolicy?: RateLimitPolicy; actionName?: string }): Promise<ShopSessionContext> {
  const ctx = await requireAuth(options);

  if (!ctx.shopId) {
    redirect('/onboarding');
  }

  return ctx as ShopSessionContext;
}

/**
 * Require a specific permission, throw if not authorized.
 * For sensitive permissions, also validates session freshness.
 */
export async function requirePermission(permission: Permission, options?: { rateLimitPolicy?: RateLimitPolicy; actionName?: string }): Promise<ShopSessionContext> {
  const ctx = await requireShop(options);

  // 1. RBAC Check
  if (!hasPermission(ctx, permission)) {
    redirect('/dashboard');
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
