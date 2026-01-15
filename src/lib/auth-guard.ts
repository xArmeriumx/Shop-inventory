import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Permission } from '@prisma/client';

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
 * Get current user session, redirect to login if not authenticated
 */
import { db } from '@/lib/db';

/**
 * Get current user session, redirect to login if not authenticated
 * Enhanced for Real-time RBAC: Fetches fresh permissions from DB
 */
export async function requireAuth(): Promise<SessionContext> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Real-time Permission Check: Fetch fresh data from DB
  // This ensures that role changes (e.g., promoted/demoted) are reflected INSTANTLY
  // without requiring the user to sign out/sign in.
  const membership = await db.shopMember.findFirst({
    where: { userId: session.user.id },
    include: {
      role: { select: { permissions: true } }
    }
  });

  return {
    userId: session.user.id,
    shopId: membership?.shopId ?? session.user.shopId,
    roleId: membership?.roleId ?? session.user.roleId,
    permissions: membership?.role?.permissions ?? session.user.permissions ?? [],
    isOwner: membership?.isOwner ?? session.user.isOwner ?? false,
  };
}

/**
 * Get current user ID, throw if not authenticated
 * @deprecated Use requireAuth() for RBAC context
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return session.user.id;
}

/**
 * Require a specific permission, throw if not authorized
 */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const ctx = await requireAuth();
  
  if (!ctx.shopId) {
    // If fully missing shopId (not even in DB), then redirect
    redirect('/onboarding');
  }
  
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
  const session = await auth();
  return !!session?.user?.id;
}
