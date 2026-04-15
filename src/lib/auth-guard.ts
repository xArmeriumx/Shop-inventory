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
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }

  // Identity from Session (JWT)
  const userId = session.user.id;
  const sessionVersion = (session.user as any).sessionVersion || 1;

  // Single Source of Truth: Fetch User and their latest Membership
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      sessionVersion: true,
      name: true,
      email: true,
      memberships: {
        take: 1, // Currently assuming 1 active shop per user
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
      }
    }
  });

  if (!user) {
    return null;
  }

  // GLOBAL REVOCATION CHECK
  if (user.sessionVersion > sessionVersion) {
    return null; // This will violently log the user out everywhere
  }

  const userName = user.name || user.email || "Unknown User";
  const userEmail = user.email;
  const membership = user.memberships[0];

  if (!membership) {
    return {
      userId,
      userName,
      userEmail,
      shopId: undefined,
      roleId: undefined,
      permissions: [],
      isOwner: false,
      sessionVersion: user.sessionVersion,
    };
  }

  return {
    userId,
    userName,
    userEmail,
    shopId: membership.shopId,
    roleId: membership.roleId ?? undefined,
    permissions: (membership.role?.permissions as Permission[]) ?? [],
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
