'use client';

import { useSession } from 'next-auth/react';
import type { Permission } from '@prisma/client';

/**
 * Hook to access current user's RBAC permissions
 * 
 * Usage:
 *   const { hasPermission, isOwner, permissions, shopId } = usePermissions();
 *   if (hasPermission('PRODUCT_CREATE')) { ... }
 */
export function usePermissions() {
  const { data: session, status } = useSession();
  
  const permissions = (session?.user?.permissions ?? []) as Permission[];
  const isOwner = session?.user?.isOwner ?? false;
  const shopId = session?.user?.shopId;
  const roleId = session?.user?.roleId;

  /**
   * Check if current user has a specific permission
   * Owners implicitly have all permissions
   */
  const hasPermission = (permission: Permission): boolean => {
    if (isOwner) return true;
    return permissions.includes(permission);
  };

  /**
   * Check if current user has any of the specified permissions
   */
  const hasAnyPermission = (perms: Permission[]): boolean => {
    if (isOwner) return true;
    return perms.some(p => permissions.includes(p));
  };

  /**
   * Check if current user has all of the specified permissions
   */
  const hasAllPermissions = (perms: Permission[]): boolean => {
    if (isOwner) return true;
    return perms.every(p => permissions.includes(p));
  };

  return {
    // State
    permissions,
    isOwner,
    shopId,
    roleId,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',

    // Helpers
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}

export type UsePermissionsReturn = ReturnType<typeof usePermissions>;
