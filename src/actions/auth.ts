'use server';

import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { IamService, PermissionData } from '@/services';

export type PermissionVersionData = {
  version: number;
} | null;

export async function getPermissionVersion(): Promise<PermissionVersionData> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return IamService.getPermissionVersion(session.user.id);
}

export async function getMyPermissions(): Promise<PermissionData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return IamService.getMyPermissions(session.user.id);
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
