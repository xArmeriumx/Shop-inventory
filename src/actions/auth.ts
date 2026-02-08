'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
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
    return null; // User not ShopMember
  }

  return { version: membership.permissionVersion };
}

// Permission Login
export async function getMyPermissions(): Promise<PermissionData> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }

  //
  const membership = await db.shopMember.findFirst({
    where: { 
      userId: session.user.id 
    },
    select: {
      shopId: true, //ID ร้าน
      roleId: true, // ID Role
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

  //object to Client
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
    // Check if  email user already exists
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
    await logger.error('Registration error', error as Error, { path: 'registerUser', email: data.email });
    return { error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' };
  }
}
