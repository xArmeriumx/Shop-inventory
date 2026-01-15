'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Permission } from '@prisma/client';

export type PermissionData = {
  shopId: string;
  roleId?: string;
  permissions: Permission[];
  isOwner: boolean;
  version: number;  // Permission version for smart polling
} | null;

export type PermissionVersionData = {
  version: number;
} | null;

/**
 * Lightweight version check - VERY fast, no JOINs
 * Client uses this to check if permissions changed before fetching full data
 * 
 * Flow:
 * 1. Client calls getPermissionVersion() every 30s
 * 2. If version changed → call getMyPermissions() for full data
 * 3. If version same → skip full fetch (save bandwidth + DB load)
 */
export async function getPermissionVersion(): Promise<PermissionVersionData> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }

  const membership = await db.shopMember.findFirst({
    where: { userId: session.user.id },
    select: { permissionVersion: true },
  });

  if (!membership) {
    return null;
  }

  return { version: membership.permissionVersion };
}

/**
 * Fetch the current user's fresh permissions directly from the database.
 * This is used by the client-side `usePermissions` hook to keep UI in sync
 * without requiring a session refresh.
 * 
 * Optimized: Uses select instead of include to minimize JOIN overhead
 * Now includes version for client-side caching
 */
export async function getMyPermissions(): Promise<PermissionData> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }

  // Optimized query: select only needed fields, no unnecessary JOINs
  const membership = await db.shopMember.findFirst({
    where: { 
      userId: session.user.id 
    },
    select: {
      shopId: true,
      roleId: true,
      isOwner: true,
      permissionVersion: true,
      role: {
        select: {
          permissions: true,
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    shopId: membership.shopId,
    roleId: membership.roleId ?? undefined,
    permissions: membership.role?.permissions ?? [],
    isOwner: membership.isOwner,
    version: membership.permissionVersion,
  };
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
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return { error: 'อีเมลนี้ถูกใช้งานแล้ว' };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create the user
    await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' };
  }
}
