'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Bell, Check, ExternalLink, Info, AlertTriangle, ShieldAlert, MoreHorizontal } from 'lucide-react';
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

  const fetchNotifications = async () => {
    try {
      const [list, count] = await Promise.all([
        getNotifications(10),
        getUnreadNotificationCount()
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Polling every 60 seconds as a simple heartbeat
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

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
    if (severity === 'CRITICAL') return <ShieldAlert className="h-4 w-4 text-red-600" />;
    if (severity === 'WARNING') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    return <Info className="h-4 w-4 text-blue-600" />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10">
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-pulse")} />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-[10px]"
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
            {unreadCount > 0 && <Badge variant="secondary">{unreadCount} ใหม่</Badge>}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-8 text-primary hover:text-primary/80" 
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
                  !notif.isRead && "bg-blue-50/30"
                )}
              >
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0">
                    {getIcon(notif.type, notif.severity)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm font-semibold leading-none", !notif.isRead && "text-primary")}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: th })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pr-6">
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
            <Link href="/system/notifications">ดูทั้งหมด</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
