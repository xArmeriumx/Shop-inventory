'use client';

import React from 'react';
import type { Permission } from '@prisma/client';
import { PermissionGuard } from './permission-guard';

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
