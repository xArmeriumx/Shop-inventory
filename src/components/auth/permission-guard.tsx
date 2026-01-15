'use client';

import { usePermissions } from '@/hooks/use-permissions';
import type { Permission } from '@prisma/client';
import type { ReactNode } from 'react';

interface PermissionGuardProps {
  /** Single permission required */
  permission?: Permission;
  /** Any of these permissions required (OR logic) */
  anyOf?: Permission[];
  /** All of these permissions required (AND logic) */
  allOf?: Permission[];
  /** Content to show if user has permission */
  children: ReactNode;
  /** Content to show if user lacks permission (default: null) */
  fallback?: ReactNode;
  /** If true, hide completely instead of showing fallback */
  hide?: boolean;
}

/**
 * Component to conditionally render content based on RBAC permissions
 * 
 * Usage:
 *   <PermissionGuard permission="PRODUCT_CREATE">
 *     <AddProductButton />
 *   </PermissionGuard>
 * 
 *   <PermissionGuard anyOf={['SALE_VIEW', 'SALE_CREATE']} fallback={<AccessDenied />}>
 *     <SalesTable />
 *   </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
  hide = false,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  // While loading session, show nothing or loading state
  if (isLoading) {
    return null;
  }

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyOf && anyOf.length > 0) {
    hasAccess = hasAnyPermission(anyOf);
  } else if (allOf && allOf.length > 0) {
    hasAccess = hasAllPermissions(allOf);
  } else {
    // No permission specified, allow access
    hasAccess = true;
  }

  if (!hasAccess) {
    return hide ? null : <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Higher-order component version for class components or complex cases
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  permission: Permission
) {
  return function PermissionWrapper(props: P) {
    return (
      <PermissionGuard permission={permission}>
        <WrappedComponent {...props} />
      </PermissionGuard>
    );
  };
}
