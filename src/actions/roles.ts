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

// ==================== Read Operations ====================

// ดึงข้อมูล Role ทั้งหมดของร้านปัจจุบัน
export async function getRoles() {
  const ctx = await requireAuth(); // เช็คว่า Login หรือยัง
  
  if (!ctx.shopId) return [];

  // Query Database: เลือก Role ทั้งหมดที่ shopId ตรงกัน
  // include _count: นัดจำนวนสมาชิกที่ใช้ Role นี้ด้วย (เอาไปแสดงใน UI)
  const roles = await db.role.findMany({
    where: { shopId: ctx.shopId },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: [
      { isSystem: 'desc' }, // เอา Role ระบบขึ้นก่อน
      { name: 'asc' },      // แล้วเรียงตามชื่อ
    ],
  });

  return roles;
}

// ดึงข้อมูล Role เดียวตาม ID (รวมรายชื่อสมาชิก)
export async function getRole(id: string) {
  const ctx = await requireAuth();

  // Query Database: ค้นหา Role ที่ id ตรงกันและ shopId ตรงกัน
  // include members -> user: ดึงข้อมูลสมาชิกและชื่อ user ที่ใช้ Role นี้ออกมาด้วย
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

// สร้าง Role ใหม่
export async function createRole(input: RoleInput): Promise<ActionResponse<{ id: string }>> {
  const ctx = await requirePermission('TEAM_EDIT'); // ต้องมีสิทธิ์แก้ทีม

  if (!ctx.shopId) return { success: false, message: 'ไม่พบข้อมูลร้านค้า' };

  // เช็คชื่อซ้ำก่อนสร้าง
  const existing = await db.role.findFirst({
    where: { shopId: ctx.shopId, name: input.name },
  });

  if (existing) {
    return { success: false, message: 'ชื่อ Role นี้ถูกใช้แล้ว' };
  }

  try {
    // ถ้าตั้งเป็น Default Role ให้เคลียร์ค่า Default ของเดิมทิ้งก่อน (มีได้แค่ 1 อัน)
    if (input.isDefault) {
      await db.role.updateMany({
        where: { shopId: ctx.shopId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // สร้าง Role ลง Database
    const role = await db.role.create({
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissions, // array ของ Permission enum
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

// แก้ไข Role เดิม
export async function updateRole(id: string, input: RoleInput): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  // ตรวจสอบว่า Role มีอยู่จริงหรือไม่ และเป็นของร้านเราไหม
  const existing = await db.role.findFirst({
    where: { id, shopId: ctx.shopId },
  });

  if (!existing) return { success: false, message: 'ไม่พบข้อมูล Role' };
  
  // ห้ามแก้ไข Role ระบบ (Owner/Admin เริ่มต้น)
  if (existing.isSystem) {
    return { success: false, message: 'ไม่สามารถแก้ไข Role ระบบได้' };
  }

  // เช็คชื่อซ้ำ (ห้ามซ้ำกับคนอื่น แต่ชื่อเดิมตัวเองไม่เป็นไร)
  const duplicate = await db.role.findFirst({
    where: { shopId: ctx.shopId, name: input.name, NOT: { id } },
  });

  if (duplicate) return { success: false, message: 'ชื่อ Role นี้ถูกใช้แล้ว' };

  try {
    // ถ้าตั้งเป็น Default ให้เคลียร์ตัวเก่าออก
    if (input.isDefault) {
      await db.role.updateMany({
        where: { shopId: ctx.shopId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    // อัปเดตข้อมูลลง Database
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

// ลบ Role
export async function deleteRole(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  // ดึงข้อมูล Role พร้อมนับจำนวนสมาชิกที่ใช้อยู่
  const role = await db.role.findFirst({
    where: { id, shopId: ctx.shopId },
    include: { _count: { select: { members: true } } },
  });

  if (!role) return { success: false, message: 'ไม่พบข้อมูล Role' };

  // ห้ามลบ Role ระบบ
  if (role.isSystem) {
    return { success: false, message: 'ไม่สามารถลบ Role ระบบได้' };
  }

  // ห้ามลบถ้ามีคนใช้อยู่ (ต้องย้ายคนออกก่อน)
  if (role._count.members > 0) {
    return { 
      success: false, 
      message: `ไม่สามารถลบได้ เนื่องจากมีสมาชิก ${role._count.members} คนใช้ Role นี้อยู่` 
    };
  }

  try {
    // ลบ Role ถาวร
    await db.role.delete({ where: { id } });
    
    revalidatePath('/settings/roles');
    return { success: true, message: 'ลบ Role สำเร็จ' };
  } catch (error) {
    console.error('Delete role error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ Role' };
  }
}