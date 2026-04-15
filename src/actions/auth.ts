'use server';

import { getSessionContext } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
export type { PermissionData } from '@/services';
import { IamService, type PermissionData } from '@/services';

export type PermissionVersionData = {
  version: number;
} | null;

export async function getPermissionVersion(): Promise<PermissionVersionData> {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  return IamService.getPermissionVersion(ctx.userId);
}

export async function getMyPermissions(): Promise<PermissionData | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  return IamService.getMyPermissions(ctx.userId);
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
