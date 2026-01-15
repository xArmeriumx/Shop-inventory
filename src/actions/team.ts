'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import type { ActionResponse } from '@/types/action-response';

// ==================== Types ====================

interface TeamMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  role: {
    id: string;
    name: string;
  };
  isOwner: boolean;
  joinedAt: Date;
}

interface InviteMemberInput {
  email: string;
  roleId: string;
}

// ==================== Read Operations ====================

/**
 * Get all team members for the current shop
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const ctx = await requirePermission('TEAM_VIEW');

  if (!ctx.shopId) {
    return [];
  }

  const members = await db.shopMember.findMany({
    where: { shopId: ctx.shopId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      role: { select: { id: true, name: true } },
    },
    orderBy: [
      { isOwner: 'desc' },
      { joinedAt: 'asc' },
    ],
  });

  return members;
}

/**
 * Get current user's shop info for team display
 */
export async function getShopTeamInfo() {
  const ctx = await requireAuth();

  if (!ctx.shopId) {
    return null;
  }

  const shop = await db.shop.findUnique({
    where: { id: ctx.shopId },
    select: {
      id: true,
      name: true,
      _count: { select: { members: true, roles: true } },
    },
  });

  return shop;
}

// ==================== Write Operations ====================

/**
 * Update a team member's role
 */
export async function updateMemberRole(memberId: string, roleId: string): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  if (!ctx.shopId) {
    return { success: false, message: 'ไม่พบข้อมูลร้านค้า' };
  }

  const member = await db.shopMember.findFirst({
    where: { id: memberId, shopId: ctx.shopId },
  });

  if (!member) {
    return { success: false, message: 'ไม่พบข้อมูลสมาชิก' };
  }

  if (member.isOwner) {
    return { success: false, message: 'ไม่สามารถเปลี่ยน Role ของเจ้าของร้านได้' };
  }

  // Verify role belongs to shop
  const role = await db.role.findFirst({
    where: { id: roleId, shopId: ctx.shopId },
  });

  if (!role) {
    return { success: false, message: 'ไม่พบข้อมูล Role' };
  }

  try {
    await db.shopMember.update({
      where: { id: memberId },
      data: { roleId },
    });

    revalidatePath('/settings/team');
    return { success: true, message: 'อัปเดต Role สมาชิกสำเร็จ' };
  } catch (error) {
    console.error('Update member role error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดต Role' };
  }
}

/**
 * Remove a team member from the shop
 */
export async function removeMember(memberId: string): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_REMOVE');

  if (!ctx.shopId) {
    return { success: false, message: 'ไม่พบข้อมูลร้านค้า' };
  }

  const member = await db.shopMember.findFirst({
    where: { id: memberId, shopId: ctx.shopId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!member) {
    return { success: false, message: 'ไม่พบข้อมูลสมาชิก' };
  }

  if (member.isOwner) {
    return { success: false, message: 'ไม่สามารถลบเจ้าของร้านได้' };
  }

  // Cannot remove yourself
  if (member.userId === ctx.userId) {
    return { success: false, message: 'ไม่สามารถลบตัวเองได้' };
  }

  try {
    await db.shopMember.delete({ where: { id: memberId } });

    revalidatePath('/settings/team');
    return { 
      success: true, 
      message: `ลบ ${member.user.name || member.user.email} ออกจากทีมสำเร็จ` 
    };
  } catch (error) {
    console.error('Remove member error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบสมาชิก' };
  }
}

/**
 * Invite a new member to the shop (placeholder for email invite)
 * For MVP, this creates the member directly if user exists
 */
export async function inviteMember(input: InviteMemberInput): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_INVITE');

  if (!ctx.shopId) {
    return { success: false, message: 'ไม่พบข้อมูลร้านค้า' };
  }

  // Find user by email
  const user = await db.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    return { 
      success: false, 
      message: 'ไม่พบผู้ใช้งาน กรุณาให้ผู้ใช้ลงทะเบียนก่อน' 
    };
  }

  // Check if already a member
  const existingMember = await db.shopMember.findFirst({
    where: { userId: user.id, shopId: ctx.shopId },
  });

  if (existingMember) {
    return { success: false, message: 'ผู้ใช้นี้เป็นสมาชิกของร้านอยู่แล้ว' };
  }

  // Verify role belongs to shop
  const role = await db.role.findFirst({
    where: { id: input.roleId, shopId: ctx.shopId },
  });

  if (!role) {
    return { success: false, message: 'ไม่พบข้อมูล Role' };
  }

  try {
    await db.shopMember.create({
      data: {
        userId: user.id,
        shopId: ctx.shopId,
        roleId: input.roleId,
        isOwner: false,
      },
    });

    revalidatePath('/settings/team');
    return { success: true, message: `เพิ่ม ${user.name || user.email} เข้าทีมสำเร็จ` };
  } catch (error) {
    console.error('Invite member error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มสมาชิก' };
  }
}
