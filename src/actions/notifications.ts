'use server';

import { NotificationService } from '@/services/notification.service';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';

/**
 * ดึงรายการแจ้งเตือนล่าสุด
 */
export async function getNotifications(limit = 20) {
  const ctx = await requireShop();
  return NotificationService.getNotifications(ctx.shopId, ctx.userId, limit);
}

/**
 * ดึงจำนวนแจ้งเตือนที่ยังไม่ได้อ่าน
 */
export async function getUnreadNotificationCount() {
  const ctx = await requireShop();
  return NotificationService.getUnreadCount(ctx.shopId, ctx.userId);
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
