import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export type NotificationType =
  | 'LOW_STOCK'
  | 'NEW_SALE'
  | 'PAYMENT_PENDING'
  | 'RETURN_CREATED'
  | 'STALE_DOCS'
  | 'GOVERNANCE_INCIDENT'
  | 'SHIPMENT_GAP'
  | 'PR_PENDING';

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
  async create(params: CreateNotificationParams, tx?: Prisma.TransactionClient): Promise<void> {
    try {
      const client = tx || db;
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
        await client.notification.upsert({
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
        await client.notification.create({
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

  async removeByGroupKey(shopId: string, groupKey: string, tx?: Prisma.TransactionClient): Promise<void> {
    try {
      const client = tx || db;
      await client.notification.deleteMany({
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
  },

  /**
   * ตรวจสอบสุขภาพการทำงาน (Operational Health) และสร้างสรุปการแจ้งเตือน
   */
  async checkOperationalHealth(shopId: string): Promise<void> {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 3);

    const [staleSales, stalePurchases, incompleteShipments, pendingPrs, lowStockCount] = await Promise.all([
      // 1. Stuck Sales (> 3 days)
      db.sale.count({
        where: { shopId, status: { in: ['DRAFT', 'CONFIRMED'] }, createdAt: { lt: limitDate } }
      }),
      // 2. Stuck Purchases (> 3 days)
      db.purchase.count({
        where: { shopId, status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'] }, createdAt: { lt: limitDate } }
      }),
      // 3. Shipment พิกัดไม่ครบ
      db.shipment.count({
        where: {
          shopId,
          status: { notIn: ['CANCELLED', 'DELIVERED'] },
          OR: [{ latitude: null }, { longitude: null }]
        }
      }),
      // 4. PR รอออก PO
      db.purchase.count({
        where: { shopId, docType: 'REQUEST', status: 'DRAFT', supplierId: null }
      }),
      // 5. สินค้าสต็อกต่ำ
      db.product.count({
        where: { shopId, isLowStock: true, isActive: true, deletedAt: null }
      })
    ]);

    const totalStale = staleSales + stalePurchases;

    // --- Create/Update Summary Notifications ---

    // Stale Documents Summary
    if (totalStale > 0) {
      await this.create({
        shopId,
        type: 'STALE_DOCS',
        severity: 'WARNING',
        title: 'มีเอกสารค้างดำเนินการ',
        message: `พบรายการขาย/สั่งซื้อ ${totalStale} รายการ ที่ไม่มีความคืบหน้าเกิน 3 วัน`,
        link: '/system/ops?tab=stale',
        groupKey: `stale-docs:${shopId}`,
      });
    } else {
      await this.removeByGroupKey(shopId, `stale-docs:${shopId}`);
    }

    // Shipment Gaps Summary
    if (incompleteShipments > 0) {
      await this.create({
        shopId,
        type: 'SHIPMENT_GAP',
        severity: 'INFO',
        title: 'พิกัดจัดส่งไม่ครบ',
        message: `มี ${incompleteShipments} รายการจัดส่งที่คำนวณเส้นทางไม่ได้เนื่องจากขาดพิกัด`,
        link: '/system/ops?tab=logistics',
        groupKey: `shipment-gap:${shopId}`,
      });
    } else {
      await this.removeByGroupKey(shopId, `shipment-gap:${shopId}`);
    }

    // PR Pending Summary
    if (pendingPrs > 0) {
      await this.create({
        shopId,
        type: 'PR_PENDING',
        severity: 'INFO',
        title: 'ใบขอซื้อรอคนระบุผู้ขาย',
        message: `มี ${pendingPrs} ใบขอซื้อ (PR) ที่ยังไม่มีผู้ขาย ทำให้ยังไม่ออก PO`,
        link: '/system/ops?tab=procurement',
        groupKey: `pr-pending:${shopId}`,
      });
    } else {
      await this.removeByGroupKey(shopId, `pr-pending:${shopId}`);
    }

    // Low Stock Summary
    if (lowStockCount > 0) {
      await this.create({
        shopId,
        type: 'LOW_STOCK',
        severity: 'WARNING',
        title: 'สินค้าสต็อกต่ำ',
        message: `มีสินค้า ${lowStockCount} รายการ ที่จำนวนคงเหลือต่ำกว่าจุดสั่งซื้อ`,
        link: '/products/low-stock',
        groupKey: `low-stock-summary:${shopId}`,
      });
    } else {
      await this.removeByGroupKey(shopId, `low-stock-summary:${shopId}`);
    }
  }
};
