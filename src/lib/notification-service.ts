import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// =============================================================================
// NOTIFICATION SERVICE
// Central service for creating and managing in-app notifications
// =============================================================================

export type NotificationType = 
  | 'LOW_STOCK' 
  | 'NEW_SALE' 
  | 'PAYMENT_PENDING' 
  | 'RETURN_CREATED';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

interface CreateNotificationParams {
  shopId: string;
  userId?: string | null;       // null = broadcast to all shop members
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  groupKey?: string | null;     // For deduplication
  expiresAt?: Date;
}

export class NotificationService {
  /**
   * Create a notification with optional deduplication.
   * If groupKey is provided, uses upsert to prevent duplicates.
   * Non-blocking: errors are caught and logged silently.
   */
  static async create(params: CreateNotificationParams): Promise<void> {
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
        // Dedup: upsert by groupKey — update existing instead of creating duplicate
        await db.notification.upsert({
          where: {
            shopId_groupKey: { shopId, groupKey },
          },
          create: {
            shopId,
            userId,
            type,
            severity,
            title,
            message,
            link,
            metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            groupKey,
            expiresAt,
            isRead: false,
          },
          update: {
            // Refresh the notification
            title,
            message,
            severity,
            link,
            metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            isRead: false,
            readAt: null,
            createdAt: new Date(),
          },
        });
      } else {
        await db.notification.create({
          data: {
            shopId,
            userId,
            type,
            severity,
            title,
            message,
            link,
            metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            groupKey,
            expiresAt,
          },
        });
      }
    } catch (error) {
      // Non-blocking: never let notification failures affect business logic
      console.error('[NotificationService] Failed to create notification:', error);
    }
  }

  /**
   * Remove a deduplication group (e.g., when stock is restored above minStock)
   */
  static async removeByGroupKey(shopId: string, groupKey: string): Promise<void> {
    try {
      await db.notification.deleteMany({
        where: { shopId, groupKey },
      });
    } catch (error) {
      console.error('[NotificationService] Failed to remove notification:', error);
    }
  }

  /**
   * Get notifications for a shop/user with pagination
   */
  static async getNotifications(shopId: string, userId: string, limit = 20) {
    return db.notification.findMany({
      where: {
        shopId,
        OR: [
          { userId: null },     // Broadcast messages
          { userId },           // Direct messages
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get unread count (lightweight for polling fallback)
   */
  static async getUnreadCount(shopId: string, userId: string): Promise<number> {
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
  }

  /**
   * Mark a single notification as read
   */
  static async markRead(id: string, shopId: string): Promise<void> {
    await db.notification.update({
      where: { id, shopId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read for a shop/user
   */
  static async markAllRead(shopId: string, userId: string): Promise<void> {
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
  }

  /**
   * Cleanup old notifications (older than 30 days)
   */
  static async cleanup(shopId: string): Promise<number> {
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
}
