'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Package, ShoppingCart, RotateCcw, CreditCard, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '@/actions/notifications';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { usePermissions } from '@/hooks/use-permissions';

// =============================================================================
// TYPES
// =============================================================================

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

// =============================================================================
// HELPERS
// =============================================================================

function getNotificationIcon(type: string) {
  switch (type) {
    case 'LOW_STOCK':      return <Package className="h-4 w-4 text-orange-500" />;
    case 'NEW_SALE':       return <ShoppingCart className="h-4 w-4 text-green-500" />;
    case 'RETURN_CREATED': return <RotateCcw className="h-4 w-4 text-red-500" />;
    case 'PAYMENT_PENDING':return <CreditCard className="h-4 w-4 text-yellow-500" />;
    default:               return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

function getSeverityDot(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-500';
    case 'WARNING':  return 'bg-orange-400';
    default:         return 'bg-blue-400';
  }
}

function timeAgo(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  
  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// =============================================================================
// COMPONENT
// =============================================================================

export function NotificationBell() {
  const router = useRouter();
  const { status: authStatus } = usePermissions();
  const [isPending, startTransition] = useTransition();

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const [data, count] = await Promise.all([
        getNotifications(15),
        getUnreadCount(),
      ]);
      
      // Level 2: State Normalization
      setNotifications(Array.isArray(data) ? data : []);
      setUnreadCount(typeof count === 'number' ? count : 0);

      if (!Array.isArray(data)) {
        console.warn('[NotificationBell] Received malformed notification data:', data);
      }
    } catch (error) {
      // Level 1 already returns []/0, but we catch here for safety
      console.error('[NotificationBell] Failed to load notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Supabase Realtime subscription
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>['channel']> | null = null;

    try {
      const supabase = getSupabaseBrowser();
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'Notification',
          },
          () => {
            // Refetch when new notification is inserted
            loadNotifications();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'Notification',
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    } catch {
      // Fallback: poll every 30 seconds if Realtime fails
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }

    return () => {
      if (channel) {
        const supabase = getSupabaseBrowser();
        supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications]);

  // Mark single as read and navigate
  const handleClick = (notification: Notification) => {
    if (!notification.isRead) {
      startTransition(async () => {
        await markNotificationRead(notification.id);
        await loadNotifications();
      });
    }
    if (notification.link) {
      setIsOpen(false);
      router.push(notification.link);
    }
  };

  // Mark all as read
  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsRead();
      await loadNotifications();
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">การแจ้งเตือน</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">การแจ้งเตือน</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
              disabled={isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              อ่านทั้งหมด
            </Button>
          )}
        </div>

        {/* Notification List */}
        <div className="max-h-80 overflow-y-auto">
          {(() => {
            // Level 3: Render Guards
            const safeNotifications = Array.isArray(notifications) ? notifications : [];
            const isUnauthenticated = authStatus === 'unauthenticated';
            
            if (isUnauthenticated) {
              return (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">กรุณาเข้าสู่ระบบ</p>
                </div>
              );
            }

            if (safeNotifications.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">ไม่มีการแจ้งเตือน</p>
                </div>
              );
            }

            return safeNotifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleClick(notification)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b last:border-0',
                  !notification.isRead && 'bg-primary/5'
                )}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {!notification.isRead && (
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', getSeverityDot(notification.severity))} />
                    )}
                    <p className={cn(
                      'text-sm truncate',
                      !notification.isRead ? 'font-medium' : 'text-muted-foreground'
                    )}>
                      {notification.title}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {timeAgo(notification.createdAt)}
                  </p>
                </div>

                {/* Read indicator */}
                {notification.isRead && (
                  <Check className="h-3 w-3 text-muted-foreground/40 shrink-0 mt-1" />
                )}
              </button>
            ));
          })()}
        </div>
      </PopoverContent>
    </Popover>
  );
}
