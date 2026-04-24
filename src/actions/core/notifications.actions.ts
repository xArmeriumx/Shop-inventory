'use server';

import { requireShop, requirePermission } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { NotificationService } from '@/services';

/**
 * Get notification summary for current user
 */
export async function getNotificationSummary(limit = 15) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      const [recentNotifications, unreadCount] = await Promise.all([
        NotificationService.getNotifications(ctx.shopId, ctx.userId, limit),
        NotificationService.getUnreadCount(ctx.shopId, ctx.userId)
      ]);
      return { recentNotifications, unreadCount };
    }, 'core:getNotificationSummary');
  }, { context: { action: 'getNotificationSummary', limit } });
}

/**
 * Get full notifications list
 */
export async function getNotifications(limit = 20) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      return NotificationService.getNotifications(ctx.shopId, ctx.userId, limit);
    }, 'core:getNotifications');
  }, { context: { action: 'getNotifications', limit } });
}

/**
 * Get count of unread notifications
 */
export async function getUnreadNotificationCount() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      return NotificationService.getUnreadCount(ctx.shopId, ctx.userId);
    }, 'core:getUnreadNotificationCount');
  }, { context: { action: 'getUnreadNotificationCount' } });
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(id: string) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      await NotificationService.markRead(id, ctx.shopId);
      revalidatePath('/');
      return true;
    }, 'core:markNotificationAsRead');
  }, { context: { action: 'markNotificationAsRead', id } });
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsAsRead() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      await NotificationService.markAllRead(ctx.shopId, ctx.userId);
      revalidatePath('/');
      return true;
    }, 'core:markAllNotificationsAsRead');
  }, { context: { action: 'markAllNotificationsAsRead' } });
}

/**
 * Trigger operational health check and generate alerts
 */
export async function refreshOperationalAlerts() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      // We assume specific permissions for health checks or rely on shop membership
      await NotificationService.checkOperationalHealth(ctx.shopId);
      revalidatePath('/');
      return true;
    }, 'core:refreshOperationalAlerts');
  }, { context: { action: 'refreshOperationalAlerts' } });
}
