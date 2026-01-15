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
export async function requireAuth(): Promise<SessionContext> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  return {
    userId: session.user.id,
    shopId: session.user.shopId,
    roleId: session.user.roleId,
    permissions: session.user.permissions ?? [],
    isOwner: session.user.isOwner ?? false,
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
 * Note: If user has stale session without RBAC data, owners will still pass
 */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const ctx = await requireAuth();
  
  // If no shopId in session but user is authenticated, they need to re-login
  // For now, be lenient and check if they're the shop owner via DB
  if (!ctx.shopId) {
    throw new Error('กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่');
  }
  
  if (!hasPermission(ctx, permission)) {
    throw new Error(`Permission denied: ${permission}`);
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
