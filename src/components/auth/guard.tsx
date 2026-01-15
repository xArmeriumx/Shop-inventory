'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@prisma/client';
import { ReactNode } from 'react';

interface GuardProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * A wrapper component that only renders its children if the user has the required permission.
 * 
 * Usage:
 * ```tsx
 * <Guard permission="PRODUCT_DELETE" fallback={<span>No Access</span>}>
 *   <Button>Delete</Button>
 * </Guard>
 * ```
 */
export function Guard({ permission, children, fallback = null }: GuardProps) {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
