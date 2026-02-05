import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Permission } from '@prisma/client';
import { db } from '@/lib/db';

/**
 * Session context with RBAC information
 */
export interface SessionContext {
  userId: string;
  shopId?: string;
  roleId?: string;
  permissions: Permission[];
  isOwner: boolean;
}

/**
 * Session context with guaranteed shopId (after requirePermission)
 * Use this type when you know the user has a shop membership
 */
export interface ShopSessionContext extends SessionContext {
  shopId: string;
}

/**
 * Cached session context fetcher - memoized per request
 * This prevents duplicate DB queries when requireAuth() is called multiple times
 * in the same request (e.g., in layout + page + components)
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }

  // Optimized query: Use select instead of include to avoid unnecessary JOINs
  // shopId is directly on ShopMember, no need to fetch shop.id
  const membership = await db.shopMember.findFirst({
    where: { userId: session.user.id },
    select: {
      shopId: true,
      roleId: true,
      isOwner: true,
      role: { 
        select: { 
          permissions: true 
        } 
      }
    }
  });

  if (!membership) {
    // User exists but has no shop membership
    return {
      userId: session.user.id,
      shopId: undefined,
      roleId: undefined,
      permissions: [],
      isOwner: false,
    };
  }

  return {
    userId: session.user.id,
    shopId: membership.shopId,
    roleId: membership.roleId ?? undefined,
    permissions: membership.role?.permissions ?? [],
    isOwner: membership.isOwner,
  };
});

/**
 * Get current user session, redirect to login if not authenticated
 * Enhanced for Real-time RBAC with request-level caching
 */
export async function requireAuth(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  
  if (!ctx) {
    redirect('/login');
  }

  return ctx;
}

/**
 * Get current user ID, throw if not authenticated
 * @deprecated Use requireAuth() for RBAC context
 */
export async function getCurrentUserId(): Promise<string> {
  const ctx = await getSessionContext();

  if (!ctx) {
    throw new Error('Unauthorized');
  }

  return ctx.userId;
}

/**
 * Require user to have a shop membership (no specific permission needed)
 * Use for features that should be available to all shop members
 * Returns ShopSessionContext with guaranteed shopId
 */
export async function requireShop(): Promise<ShopSessionContext> {
  const ctx = await requireAuth();
  
  if (!ctx.shopId) {
    redirect('/onboarding');
  }
  
  return ctx as ShopSessionContext;
}

/**
 * Require a specific permission, throw if not authorized
 * Returns ShopSessionContext with guaranteed shopId
 */
export async function requirePermission(permission: Permission): Promise<ShopSessionContext> {
  const ctx = await requireShop(); // Reuse requireShop for DRY
  
  if (!hasPermission(ctx, permission)) {
    redirect('/dashboard');
  }
  
  return ctx;
}

/**
 * Check if session context has a specific permission
 */
export function hasPermission(ctx: SessionContext, permission: Permission): boolean {
  // Owner has all permissions
  if (ctx.isOwner) return true;
  
  return ctx.permissions.includes(permission);
}

/**
 * Check if session has any of the specified permissions
 */
export function hasAnyPermission(ctx: SessionContext, permissions: Permission[]): boolean {
  if (ctx.isOwner) return true;
  return permissions.some(p => ctx.permissions.includes(p));
}

/**
 * Check if session has all of the specified permissions
 */
export function hasAllPermissions(ctx: SessionContext, permissions: Permission[]): boolean {
  if (ctx.isOwner) return true;
  return permissions.every(p => ctx.permissions.includes(p));
}

/**
 * Check if user is authenticated without redirecting
 */
export async function isAuthenticated(): Promise<boolean> {
  const ctx = await getSessionContext();
  return ctx !== null;
}
