'use client';

import React, { useEffect, useState, useTransition, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, Check, ExternalLink, Info, AlertTriangle, ShieldAlert, Package, ShoppingCart, RotateCcw, CreditCard } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getNotifications,
  getUnreadNotificationCount,
  getNotificationSummary,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '@/actions/notifications';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { toast } from 'sonner';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { data: session } = useSession();

  // Backoff and Visibility State
  const [pollInterval, setPollInterval] = useState(60000); // Start with 60s
  const lastCountRef = useRef<number>(-1);
  const consecutiveSameRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    // 1. Auth Awareness: Don't poll if not authenticated
    if (!session?.user) return;

    // 2. Visibility Awareness: Don't poll if tab is hidden
    if (typeof document !== 'undefined' && document.hidden) return;

    try {
      const summary = await getNotificationSummary(15);

      setNotifications(summary.recentNotifications);
      setUnreadCount(summary.unreadCount);

      // 3. Simple Backoff: If no changes for 3 cycles, slow down polling
      if (summary.unreadCount === lastCountRef.current) {
        consecutiveSameRef.current += 1;
        if (consecutiveSameRef.current >= 3 && pollInterval < 300000) {
          setPollInterval(prev => Math.min(prev * 1.5, 300000)); // Max 5 mins
          consecutiveSameRef.current = 0;
        }
      } else {
        // Reset interval on change
        setPollInterval(60000);
        consecutiveSameRef.current = 0;
      }

      lastCountRef.current = summary.unreadCount;
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  }, [session, pollInterval]);

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, pollInterval);
    return () => clearInterval(interval);
  }, [fetchNotifications, pollInterval]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      await fetchNotifications();
    } catch (error) {
      toast.error('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  const handleMarkAllRead = async () => {
    startTransition(async () => {
      try {
        await markAllNotificationsAsRead();
        await fetchNotifications();
        toast.success('อ่านรายการทั้งหมดแล้ว');
      } catch (error) {
        toast.error('เกิดข้อผิดพลาด');
      }
    });
  };

  const getIcon = (type: string, severity: string) => {
    switch (type) {
      case 'LOW_STOCK': return <Package className="h-4 w-4 text-orange-500" />;
      case 'NEW_SALE': return <ShoppingCart className="h-4 w-4 text-green-500" />;
      case 'RETURN_CREATED': return <RotateCcw className="h-4 w-4 text-red-500" />;
      case 'PAYMENT_PENDING': return <CreditCard className="h-4 w-4 text-yellow-500" />;
      case 'GOVERNANCE_INCIDENT': return <ShieldAlert className="h-4 w-4 text-red-600" />;
      case 'STALE_DOCS': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'SHIPMENT_GAP': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10">
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-pulse")} />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-[10px] text-white border-0"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0 shadow-2xl border-muted-foreground/20">
        <DropdownMenuLabel className="p-4 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">รายการแจ้งเตือน</span>
            {unreadCount > 0 && <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-0">{unreadCount} ใหม่</Badge>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 text-primary hover:text-primary/80 hover:bg-primary/5"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || isPending}
          >
            อ่านทั้งหมดแล้ว
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[450px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center gap-3 text-muted-foreground">
              <Bell className="h-10 w-10 opacity-20" />
              <p>ยังไม่มีรายการแจ้งเตือน</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "p-4 border-b last:border-0 transition-colors hover:bg-muted/50 relative group",
                  !notif.isRead && "bg-primary/5"
                )}
              >
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0">
                    {getIcon(notif.type, notif.severity)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm font-semibold leading-none", !notif.isRead ? "text-primary" : "text-muted-foreground")}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: th })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pr-6 mt-1">
                      {notif.message}
                    </p>
                    {notif.link && (
                      <Link
                        href={notif.link}
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline mt-2"
                      >
                        จัดการปัญหา <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {!notif.isRead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-4 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleMarkRead(notif.id, e)}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2 bg-muted/10 text-center">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" asChild>
            <Link href="/system/notifications">ดูรายการแจ้งเตือนทั้งหมด</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
