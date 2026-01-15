'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import type { Permission } from '@prisma/client';
import type { ActionResponse } from '@/types/action-response';

// ==================== Types ====================

interface RoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault?: boolean;
}

interface RoleWithMembers {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isSystem: boolean;
  permissions: Permission[];
  _count: { members: number };
  createdAt: Date;
}

// ==================== Read Operations ====================

/**
 * Get all roles for the current user's shop
 */
export async function getRoles(): Promise<RoleWithMembers[]> {
  const ctx = await requireAuth();
  
  if (!ctx.shopId) {
    return [];
  }

  const roles = await db.role.findMany({
    where: { shopId: ctx.shopId },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: [
      { isSystem: 'desc' },
      { name: 'asc' },
    ],
  });

  return roles;
}

/**
 * Get a single role by ID
 */
export async function getRole(id: string) {
  const ctx = await requireAuth();

  if (!ctx.shopId) {
    throw new Error('ไม่พบข้อมูลร้านค้า');
  }

  const role = await db.role.findFirst({
    where: { id, shopId: ctx.shopId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  if (!role) {
    throw new Error('ไม่พบข้อมูล Role');
  }

  return role;
}

// ==================== Write Operations ====================

/**
 * Create a new role
 */
export async function createRole(input: RoleInput): Promise<ActionResponse<{ id: string }>> {
  const ctx = await requirePermission('TEAM_EDIT');

  if (!ctx.shopId) {
    return { success: false, message: 'ไม่พบข้อมูลร้านค้า' };
  }

  // Check duplicate name
  const existing = await db.role.findFirst({
    where: { shopId: ctx.shopId, name: input.name },
  });

  if (existing) {
    return { success: false, message: 'ชื่อ Role นี้ถูกใช้แล้ว' };
  }

  try {
    // If setting as default, unset other defaults first
    if (input.isDefault) {
      await db.role.updateMany({
        where: { shopId: ctx.shopId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const role = await db.role.create({
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        isDefault: input.isDefault ?? false,
        shopId: ctx.shopId,
      },
    });

    revalidatePath('/settings/roles');
    return { success: true, data: { id: role.id }, message: 'สร้าง Role สำเร็จ' };
  } catch (error) {
    console.error('Create role error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้าง Role' };
  }
}

/**
 * Update an existing role
 */
export async function updateRole(id: string, input: RoleInput): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  if (!ctx.shopId) {
    return { success: false, message: 'ไม่พบข้อมูลร้านค้า' };
  }

  const existing = await db.role.findFirst({
    where: { id, shopId: ctx.shopId },
  });

  if (!existing) {
    return { success: false, message: 'ไม่พบข้อมูล Role' };
  }

  if (existing.isSystem) {
    return { success: false, message: 'ไม่สามารถแก้ไข Role ระบบได้' };
  }

  // Check duplicate name (excluding self)
  const duplicate = await db.role.findFirst({
    where: { shopId: ctx.shopId, name: input.name, NOT: { id } },
  });

  if (duplicate) {
    return { success: false, message: 'ชื่อ Role นี้ถูกใช้แล้ว' };
  }

  try {
    // If setting as default, unset other defaults first
    if (input.isDefault) {
      await db.role.updateMany({
        where: { shopId: ctx.shopId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    await db.role.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        isDefault: input.isDefault ?? false,
      },
    });

    revalidatePath('/settings/roles');
    return { success: true, message: 'อัปเดต Role สำเร็จ' };
  } catch (error) {
    console.error('Update role error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดต Role' };
  }
}

/**
 * Delete a role
 */
export async function deleteRole(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  if (!ctx.shopId) {
    return { success: false, message: 'ไม่พบข้อมูลร้านค้า' };
  }

  const role = await db.role.findFirst({
    where: { id, shopId: ctx.shopId },
    include: { _count: { select: { members: true } } },
  });

  if (!role) {
    return { success: false, message: 'ไม่พบข้อมูล Role' };
  }

  if (role.isSystem) {
    return { success: false, message: 'ไม่สามารถลบ Role ระบบได้' };
  }

  if (role._count.members > 0) {
    return { 
      success: false, 
      message: `ไม่สามารถลบได้ เนื่องจากมีสมาชิก ${role._count.members} คนใช้ Role นี้อยู่` 
    };
  }

  try {
    await db.role.delete({ where: { id } });
    
    revalidatePath('/settings/roles');
    return { success: true, message: 'ลบ Role สำเร็จ' };
  } catch (error) {
    console.error('Delete role error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ Role' };
  }
}
