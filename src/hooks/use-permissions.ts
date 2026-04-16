'use client';

import { useContext, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import type { Permission } from '@prisma/client';
import { usePermissionContext, useIsPermissionProviderMounted } from '@/contexts/permission-context';

// ============================================================================
// TYPES
// ============================================================================

export interface UsePermissionsReturn {
  // State
  permissions: Permission[];
  roles: string[];
  isOwner: boolean;
  shopId: string | undefined;
  roleId: string | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'error';

  // Permission check helpers
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;

  // Manual refresh trigger
  refreshPermissions: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * usePermissions - Access current user's RBAC permissions
 * 
 * This hook reads permission data from the PermissionContext.
 * All polling and state management is handled by the PermissionProvider
 * at the layout level, ensuring a single source of truth.
 * 
 * Features:
 * - Real-time permission updates (via Provider polling)
 * - Owner bypass (isOwner = true grants all permissions)
 * - Type-safe permission checking
 * - Memoized helpers to prevent unnecessary re-renders
 * 
 * Usage:
 * ```tsx
 * const { hasPermission, isOwner } = usePermissions();
 * 
 * if (hasPermission('PRODUCT_CREATE')) {
 *   // Show create button
 * }
 * ```
 * 
 * Note: This hook requires PermissionProvider to be mounted in a parent component.
 * The provider is typically added at the dashboard layout level.
 */
export function usePermissions(): UsePermissionsReturn {
  const isProviderMounted = useIsPermissionProviderMounted();

  // If provider is mounted, use context
  if (isProviderMounted) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return usePermissionContext();
  }

  // Fallback for when provider is not mounted (e.g., login page, error boundary)
  // This provides a safe default without throwing an error
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useFallbackPermissions();
}

// ============================================================================
// FALLBACK HOOK (for non-dashboard pages)
// ============================================================================

/**
 * Fallback implementation for when PermissionProvider is not available
 * Uses session data directly without polling
 */
function useFallbackPermissions(): UsePermissionsReturn {
  const { data: session, status } = useSession();

  const permissions = useMemo(
    () => Array.isArray(session?.user?.permissions) ? (session.user.permissions as Permission[]) : [],
    [session?.user?.permissions]
  );

  const isOwner = session?.user?.isOwner ?? false;
  const shopId = session?.user?.shopId as string | undefined;
  const roleId = session?.user?.roleId;

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (isOwner) return true;
      return permissions.includes(permission);
    },
    [permissions, isOwner]
  );

  const hasAnyPermission = useCallback(
    (perms: Permission[]): boolean => {
      if (isOwner) return true;
      return perms.some((p) => permissions.includes(p));
    },
    [permissions, isOwner]
  );

  const hasAllPermissions = useCallback(
    (perms: Permission[]): boolean => {
      if (isOwner) return true;
      return perms.every((p) => permissions.includes(p));
    },
    [permissions, isOwner]
  );

  // No-op refresh since there's no provider to trigger
  const refreshPermissions = useCallback(() => {
    console.warn('[usePermissions] refreshPermissions called without PermissionProvider');
  }, []);

  return {
    permissions,
    roles: roleId ? [roleId] : [],
    isOwner,
    shopId,
    roleId,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    status: status === 'loading' ? 'loading' : status === 'authenticated' ? 'authenticated' : 'unauthenticated',
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
  };
}
