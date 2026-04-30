import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { AuditService } from '@/services/core/system/audit.service';
import type { User } from '@prisma/client';

export const IamUserService = {
  async getProfile(userId: string) {
    const membership = await db.shopMember.findFirst({
      where: { userId },
      select: {
        departmentCode: true,
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!membership) return null;

    return {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      departmentCode: membership.departmentCode
    };
  },

  async registerUser(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
    }

    return db.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.passwordHash,
      },
    });
  },

  async updatePassword(ctx: RequestContext, input: { currentPassword: string; newPassword: string }): Promise<void> {
    const user = await db.user.findUnique({
      where: { id: ctx.userId },
    });

    if (!user || !user.password) throw new ServiceError('ไม่พบข้อมูลผู้ใช้งาน');

    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(input.currentPassword, user.password);
    if (!isValid) throw new ServiceError('รหัสผ่านปัจจุบันไม่ถูกต้อง');

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await AuditService.runWithAudit(
      ctx,
      {
        action: 'IAM_PASSWORD_CHANGE',
        targetType: 'User',
        targetId: ctx.userId,
        note: 'ผู้ใช้เปลี่ยนรหัสผ่านด้วยตนเอง',
      },
      async () => {
        await db.user.update({
          where: { id: ctx.userId },
          data: { 
            password: hashedPassword,
            sessionVersion: { increment: 1 }, // Logout other devices for security
          },
        });
      }
    );
  },

  async updateUserActivity(userId: string): Promise<void> {
    try {
      await db.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      console.error('[IamService] Failed to update user activity:', error);
    }
  },
};
