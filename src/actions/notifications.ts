'use server';

import { db } from '@/lib/db';
import { getTrustedShopId } from '@/lib/auth-guard';
import { NotificationService } from '@/services/core/notification.service';
import { QueryMetrics } from '@/lib/performance';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';

/**
 * ดึงรายการแจ้งเตือนล่าสุด
 */
export interface NotificationSummary {
  unreadCount: number;
  recentNotifications: any[];
  serverTime: string;
}

export async function getNotificationSummary(limit = 15): Promise<NotificationSummary> {
  const shopId = await getTrustedShopId();

  // Using Promise.all for parallel database execution under the same request context
  const [unreadCount, recentNotifications] = await QueryMetrics.measure('db:notificationSummary', () =>
    Promise.all([
      db.notification.count({
        where: { shopId, isRead: false }
      }),
      db.notification.findMany({
        where: { shopId },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          message: true,
          link: true,
          isRead: true,
          createdAt: true
        }
      })
    ])
  );

  return {
    unreadCount,
    recentNotifications,
    serverTime: new Date().toISOString()
  };
}

export async function getNotifications(limit = 20) {
  const shopId = await getTrustedShopId();
  return db.notification.findMany({
    where: { shopId },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      severity: true,
      title: true,
      message: true,
      link: true,
      isRead: true,
      createdAt: true
    }
  });
}

export async function getUnreadNotificationCount() {
  const shopId = await getTrustedShopId();
  return db.notification.count({
    where: { shopId, isRead: false }
  });
}

/**
 * ทำเครื่องหมายอ่านแล้ว
 */
export async function markNotificationAsRead(id: string) {
  const ctx = await requireShop();
  await NotificationService.markRead(id, ctx.shopId);
  revalidatePath('/');
}

/**
 * ทำเครื่องหมายอ่านแล้วทั้งหมด
 */
export async function markAllNotificationsAsRead() {
  const ctx = await requireShop();
  await NotificationService.markAllRead(ctx.shopId, ctx.userId);
  revalidatePath('/');
}

/**
 * สั่ง Refresh สุขภาพระบบ (Operational Health Check)
 * มักเรียกจากหน้า Dashboard เพื่ออัปเดตสรุปงานค้าง
 */
export async function refreshOperationalAlerts() {
  const ctx = await requireShop();
  // เฉพาะ Admin/Owner หรือคนที่มีสิทธิ์ดูสรุปภาพรวม (เราใช้ SHIPMENT_VIEW/PURCHASE_VIEW เป็นเกณฑ์เบื้องต้น)
  await NotificationService.checkOperationalHealth(ctx.shopId);
  revalidatePath('/');
}
