'use server';

import { getSessionContext } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { QueryMetrics } from '@/lib/performance';
export type { PermissionData } from '@/services';
import { IamService, type PermissionData } from '@/services';
import { isDynamicServerError } from '@/lib/next-utils';

export type PermissionVersionData = {
  version: number;
} | null;

export async function getPermissionVersion(): Promise<PermissionVersionResponse> {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return { ok: false, kind: 'AUTH_FAILURE', message: 'Unauthenticated' };
    }

    const versionData = await QueryMetrics.measure('db:getPermissionVersion', () =>
      IamService.getPermissionVersion(ctx.userId)
    );
    return { ok: true, version: versionData?.version ?? 0 };
  } catch (error) {
    if (isDynamicServerError(error)) throw error;

    console.error('[Action: getPermissionVersion] Failed:', error);
    return { ok: false, kind: 'TRANSIENT_ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export type AuthErrorType = 'AUTH_FAILURE' | 'TRANSIENT_ERROR';

export interface AuthPermissionsData {
  isAuthenticated: boolean;
  permissions: string[];
  roles: string[];
  shopId?: string;
  isOwner: boolean;
  version: number;
}

export interface AuthPermissionsResponse {
  ok: boolean;
  data?: AuthPermissionsData;
  error?: {
    kind: AuthErrorType;
    message: string;
  };
}

export type PermissionVersionResponse = {
  ok: true;
  version: number;
} | {
  ok: false;
  kind: AuthErrorType;
  message: string;
} | null;

export async function getMyPermissions(): Promise<AuthPermissionsResponse> {
  try {
    const ctx = await getSessionContext();

    // Level 1: Source Contract hardening - Never return null for UI reads
    if (!ctx) {
      return {
        ok: false,
        error: { kind: 'AUTH_FAILURE', message: 'Session not found' }
      };
    }

    const data = await QueryMetrics.measure('db:getMyPermissions', () =>
      IamService.getMyPermissions(ctx.userId)
    );

    if (!data) {
      // If user exists but no data record (rare case), return empty permissions but still authenticated
      return {
        ok: true,
        data: {
          isAuthenticated: true,
          permissions: [],
          roles: [],
          isOwner: false,
          version: 0
        }
      };
    }

    return {
      ok: true,
      data: {
        isAuthenticated: true,
        permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : [],
        roles: data.roleId ? [data.roleId] : [],
        shopId: data.shopId,
        isOwner: data.isOwner,
        version: data.version
      }
    };
  } catch (error) {
    if (isDynamicServerError(error)) throw error;

    console.error('[Action: getMyPermissions] Failed:', error);
    return {
      ok: false,
      error: {
        kind: 'TRANSIENT_ERROR',
        message: error instanceof Error ? error.message : 'Internal Server Error'
      }
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
