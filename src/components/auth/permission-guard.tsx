'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@prisma/client';
import type { ReactNode } from 'react';
import { getPermission } from '@/constants/permissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ComponentType } from 'react';

interface PermissionGuardProps {
  permission?: Permission;
  permissions?: Permission[];
  mode?: 'hide' | 'readonly' | 'message';
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  permission,
  permissions,
  mode = 'hide',
  fallback,
  children,
}: PermissionGuardProps) {
  const { hasPermission } = usePermissions();

  const requiredPermissions = permissions || (permission ? [permission] : []);
  const isAuthorized = requiredPermissions.length === 0 || requiredPermissions.some(p => hasPermission(p));

  if (isAuthorized) {
    return <>{children}</>;
  }

  // Denied logic
  if (fallback) {
    return <>{fallback}</>;
  }

  const meta = permission ? getPermission(permission) : null;
  const denyMessage = `คุณไม่มีสิทธิ์ใช้งานส่วนนี้ (ต้องการสิทธิ์: ${meta?.label || permission || 'ระบุสิทธิ์'})`;

  if (mode === 'message') {
    return (
      <div className="p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center space-y-4 bg-muted/30">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="text-2xl">🔒</span>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-lg">{meta?.label || 'จำกัดการเข้าถึง'}</p>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            {denyMessage}
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'readonly') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="opacity-70 grayscale pointer-events-none select-none relative">
              <div className="absolute inset-0 z-10" />
              {children}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{denyMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // mode === 'hide'
  return null;
}

/**
 * Higher-Order Component version of PermissionGuard
 */
export function withPermission<P extends object>(
  Component: ComponentType<P>,
  permission: Permission,
  mode: 'hide' | 'readonly' | 'message' = 'hide'
) {
  return function WithPermissionWrapper(props: P) {
    return (
      <PermissionGuard permission={permission} mode={mode}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
