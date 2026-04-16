'use server';

import { requireShop } from '@/lib/auth-guard';
import { NotificationService } from '@/services';
import { logger } from '@/lib/logger';
import { isDynamicServerError } from '@/lib/next-utils';

/**
 * Get notifications for current user/shop
 * Contract: Returns an array even on failure
 */
export async function getNotifications(limit = 20) {
  try {
    const ctx = await requireShop();
    const data = await NotificationService.getNotifications(ctx.shopId, ctx.userId, limit);
    
    if (!Array.isArray(data)) {
      await logger.warn('getNotifications returned non-array data', { actualType: typeof data, userId: ctx.userId });
      return [];
    }
    
    return data;
  } catch (error) {
    // Fail silently for UI convenience, but log internally if it's a real error (not just unauthenticated redirect)
    if (!isDynamicServerError(error) && !(error instanceof Error && error.message.includes('NEXT_REDIRECT'))) {
      console.error('[Action: getNotifications] Failed:', error);
    }
    return [];
  }
}

/**
 * Get unread notification count
 * Contract: Returns a number even on failure
 */
export async function getUnreadCount() {
  try {
    const ctx = await requireShop();
    const count = await NotificationService.getUnreadCount(ctx.shopId, ctx.userId);
    
    if (typeof count !== 'number') {
      await logger.warn('getUnreadCount returned non-number data', { actualType: typeof count, userId: ctx.userId });
      return 0;
    }
    
    return count;
  } catch (error) {
    if (!isDynamicServerError(error) && !(error instanceof Error && error.message.includes('NEXT_REDIRECT'))) {
      console.error('[Action: getUnreadCount] Failed:', error);
    }
    return 0;
  }
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
