'use server';

import { requireShop } from '@/lib/auth-guard';
import { NotificationService } from '@/services';

/**
 * Get notifications for current user/shop
 */
export async function getNotifications(limit = 20) {
  const ctx = await requireShop();
  return NotificationService.getNotifications(ctx.shopId, ctx.userId, limit);
}

/**
 * Get unread notification count (lightweight — for polling fallback)
 */
export async function getUnreadCount() {
  const ctx = await requireShop();
  return NotificationService.getUnreadCount(ctx.shopId, ctx.userId);
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(id: string) {
  const ctx = await requireShop();
  await NotificationService.markRead(id, ctx.shopId);
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
  const ctx = await requireShop();
  await NotificationService.markAllRead(ctx.shopId, ctx.userId);
}
