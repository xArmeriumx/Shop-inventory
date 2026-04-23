'use client';

import { useState, useTransition } from 'react';
import {
    Info,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    BellOff,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '@/components/ui/client-date';
import { markNotificationAsRead } from '@/actions/notifications';
import Link from 'next/link';

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

interface NotificationListProps {
    initialNotifications: any[];
}

export function NotificationList({ initialNotifications }: NotificationListProps) {
    const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
    const [isPending, startTransition] = useTransition();

    const handleMarkAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        await markNotificationAsRead(id);
    };

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border border-dashed text-center">
                <div className="bg-muted p-4 rounded-full mb-4">
                    <BellOff className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">ไม่มีการแจ้งเตือน</h3>
                <p className="text-muted-foreground max-w-xs mx-auto mt-1">
                    ยินดีด้วย! ระบบของคุณปกติดีและไม่มีงานค้างที่ต้องดำเนินการในขณะนี้
                </p>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <p className="text-sm text-muted-foreground">
                    แสดงการแจ้งเตือนและประวัติการทำงาน {notifications.length} รายการ
                    {unreadCount > 0 && (
                        <span className="ml-2 font-bold text-red-500">
                            (ยังไม่ได้อ่าน {unreadCount})
                        </span>
                    )}
                </p>
            </div>

            <div className="grid gap-3">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={cn(
                            "relative group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200",
                            notification.isRead
                                ? "bg-background border-border"
                                : "bg-primary/5 border-primary/20 shadow-sm"
                        )}
                    >
                        {/* Severity Indicator */}
                        <div className={cn(
                            "mt-1 p-2 rounded-lg shrink-0",
                            notification.severity === 'CRITICAL' ? "bg-red-100 text-red-600" :
                                notification.severity === 'WARNING' ? "bg-amber-100 text-amber-600" :
                                    "bg-blue-100 text-blue-600"
                        )}>
                            {notification.severity === 'CRITICAL' ? <AlertCircle className="w-5 h-5" /> :
                                notification.severity === 'WARNING' ? <AlertTriangle className="w-5 h-5" /> :
                                    <Info className="w-5 h-5" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-8">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className={cn(
                                    "font-bold text-sm",
                                    !notification.isRead && "text-primary"
                                )}>
                                    {notification.title}
                                </h4>
                                {!notification.isRead && (
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                {notification.message}
                            </p>

                            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <ClientDate date={notification.createdAt} />
                                </div>
                                <Badge variant="outline" className="text-[9px] uppercase tracking-wider h-4">
                                    {notification.type.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            {notification.link && (
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                    <Link href={notification.link}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            )}
                            {!notification.isRead && (
                                <Button
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                                    title="ทำเครื่องหมายว่าอ่านแล้ว"
                                >
                                    <Check className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
