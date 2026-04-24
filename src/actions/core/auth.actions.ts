'use server';

import { getSessionContext } from '@/lib/auth-guard';
import { IamService } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import bcrypt from 'bcryptjs';

/**
 * Register a new user
 */
/**
 * Revoke all sessions for the current user
 */
export async function revokeAllUserSessions(): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await getSessionContext();
      if (!ctx) throw new Error('ไม่พบเซสชัน');

      await IamService.revokeSessions(ctx.userId, {
        ...ctx,
        shopId: ctx.shopId ?? '',
      });
      return null;
    }, 'iam:revokeAllUserSessions');
  }, { context: { action: 'revokeAllUserSessions' } });
}

export async function registerUser(input: any): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const { name, email, password } = input;
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await IamService.registerUser({
        name,
        email,
        passwordHash
      });
      return { id: user.id, email: user.email };
    }, 'iam:registerUser');
  }, { context: { action: 'registerUser', email: input.email } });
}

export async function getPermissionVersion(): Promise<ActionResponse<{ version: number }>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await getSessionContext();
      if (!ctx) return { version: 0 };
      const versionData = await IamService.getPermissionVersion(ctx.userId, ctx.shopId);
      return { version: versionData?.version ?? 0 };
    }, 'iam:getPermissionVersion');
  }, { context: { action: 'getPermissionVersion' } });
}

export async function getMyPermissions(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await getSessionContext();
      if (!ctx) return { isAuthenticated: false, permissions: [], roles: [], version: 0 };

      const data = await IamService.getMyPermissions(ctx.userId);
      if (!data) return { isAuthenticated: true, permissions: [], roles: [], isOwner: false, version: 0 };

      return {
        isAuthenticated: true,
        permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : [],
        roles: data.roleId ? [data.roleId] : [],
        shopId: data.shopId,
        isOwner: data.isOwner,
        version: data.version
      };
    }, 'iam:getMyPermissions');
  }, { context: { action: 'getMyPermissions' } });
}

export async function getMyProfile(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await getSessionContext();
      if (!ctx) return null;
      return IamService.getProfile(ctx.userId);
    }, 'iam:getMyProfile');
  }, { context: { action: 'getMyProfile' } });
}
