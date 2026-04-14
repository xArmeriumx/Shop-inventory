import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export type NotificationType = 
  | 'LOW_STOCK' 
  | 'NEW_SALE' 
  | 'PAYMENT_PENDING' 
  | 'RETURN_CREATED';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface CreateNotificationParams {
  shopId: string;
  userId?: string | null;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  groupKey?: string | null;
  expiresAt?: Date;
}

export const NotificationService = {
  async create(params: CreateNotificationParams): Promise<void> {
    try {
      const {
        shopId,
        userId = null,
        type,
        severity = 'INFO',
        title,
        message,
        link,
        metadata,
        groupKey,
        expiresAt,
      } = params;

      if (groupKey) {
        await db.notification.upsert({
          where: { shopId_groupKey: { shopId, groupKey } },
          create: {
            shopId, userId, type, severity, title, message, link,
            metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            groupKey, expiresAt, isRead: false,
          },
          update: {
            title, message, severity, link,
            metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            isRead: false, readAt: null, createdAt: new Date(),
          },
        });
      } else {
        await db.notification.create({
          data: {
            shopId, userId, type, severity, title, message, link,
            metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            groupKey, expiresAt,
          },
        });
      }
    } catch (error) {
      console.error('[NotificationService] Failed to create notification:', error);
    }
  },

  async removeByGroupKey(shopId: string, groupKey: string): Promise<void> {
    try {
      await db.notification.deleteMany({
        where: { shopId, groupKey },
      });
    } catch (error) {
      console.error('[NotificationService] Failed to remove notification:', error);
    }
  },

  async getNotifications(shopId: string, userId: string, limit = 20) {
    return db.notification.findMany({
      where: {
        shopId,
        OR: [
          { userId: null },
          { userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async getUnreadCount(shopId: string, userId: string): Promise<number> {
    return db.notification.count({
      where: {
        shopId,
        isRead: false,
        OR: [
          { userId: null },
          { userId },
        ],
      },
    });
  },

  async markRead(id: string, shopId: string): Promise<void> {
    await db.notification.update({
      where: { id, shopId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async markAllRead(shopId: string, userId: string): Promise<void> {
    await db.notification.updateMany({
      where: {
        shopId,
        isRead: false,
        OR: [
          { userId: null },
          { userId },
        ],
      },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async cleanup(shopId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.notification.deleteMany({
      where: {
        shopId,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    return result.count;
  }
};
