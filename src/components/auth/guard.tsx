'use client';

/**
 * Guard Component - Simplified Permission Guard
 * 
 * This is a convenience re-export of PermissionGuard for simple single-permission checks.
 * For more complex permission logic (anyOf, allOf), use PermissionGuard directly.
 * 
 * Usage:
 * ```tsx
 * <Guard permission="PRODUCT_DELETE" fallback={<span>No Access</span>}>
 *   <Button>Delete</Button>
 * </Guard>
 * ```
 */

import { PermissionGuard, withPermission } from './permission-guard';
import type { Permission } from '@prisma/client';
import type { ReactNode } from 'react';

interface GuardProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Guard({ permission, children, fallback = null }: GuardProps) {
  return (
    <PermissionGuard permission={permission} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

// Re-export for convenience
export { PermissionGuard, withPermission };
