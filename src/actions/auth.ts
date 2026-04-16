'use server';

import { getSessionContext } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
export type { PermissionData } from '@/services';
import { IamService, type PermissionData } from '@/services';
import { isDynamicServerError } from '@/lib/next-utils';

export type PermissionVersionData = {
  version: number;
} | null;

export async function getPermissionVersion(): Promise<PermissionVersionData> {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  return IamService.getPermissionVersion(ctx.userId);
}

export interface AuthPermissionsResponse {
  isAuthenticated: boolean;
  permissions: string[];
  roles: string[];
  shopId?: string;
  isOwner: boolean;
  version: number;
}

export async function getMyPermissions(): Promise<AuthPermissionsResponse> {
  try {
    const ctx = await getSessionContext();
    
    // Level 1: Source Contract hardening - Never return null for UI reads
    if (!ctx) {
      return {
        isAuthenticated: false,
        permissions: [],
        roles: [],
        isOwner: false,
        version: 0
      };
    }

    const data = await IamService.getMyPermissions(ctx.userId);
    
    if (!data) {
      return {
        isAuthenticated: true,
        permissions: [],
        roles: [],
        isOwner: false,
        version: 0
      };
    }

    return {
      isAuthenticated: true,
      permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : [],
      roles: data.roleId ? [data.roleId] : [], // Note: roleId is currently a singular ID in this system
      shopId: data.shopId,
      isOwner: data.isOwner,
      version: data.version
    };
  } catch (error) {
    if (!isDynamicServerError(error)) {
      console.error('[Action: getMyPermissions] Failed:', error);
    }
    return {
      isAuthenticated: false,
      permissions: [],
      roles: [],
      isOwner: false,
      version: 0
    };
  }
}

export async function getMyProfile() {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  return IamService.getProfile(ctx.userId);
}

/**
 * Register a new user
 */
export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ error?: string; success?: boolean }> {
  const bcrypt = await import('bcryptjs');
  
  try {
    const hashedPassword = await bcrypt.hash(data.password, 12);
    
    await IamService.registerUser({
      name: data.name,
      email: data.email,
      passwordHash: hashedPassword,
    });

    return { success: true };
  } catch (error: unknown) {
    const typedError = error as Error;
    await logger.error('Registration error', typedError, { path: 'registerUser', email: data.email });
    return { error: typedError.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก' };
  }
}
