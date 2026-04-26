'use client';

import { useState, useTransition } from 'react';
import {
    Info,
    AlertTriangle,
    AlertCircle,
    ChevronRight,
    BellOff,
    Check,
    Clock,
    Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '@/components/ui/client-date';
import { markNotificationAsRead } from '@/actions/core/notifications.actions';
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
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 px-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="relative">
                    <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl" />
                    <div className="relative bg-background p-5 rounded-full border shadow-sm">
                        <BellOff className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                </div>
                <div className="space-y-2 max-w-[280px]">
                    <h3 className="text-xl font-bold tracking-tight">ไม่มีการแจ้งเตือน</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        ยินดีด้วย! ระบบของคุณปกติดีและไม่มีงานค้างที่ต้องดำเนินการในขณะนี้
                    </p>
                </div>
                <Button variant="outline" className="rounded-xl border-2 font-bold px-6">
                    ตรวจสอบประวัติเก่า
                </Button>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="divide-y divide-border/50">
            {unreadCount > 0 && (
                <div className="px-6 py-4 bg-muted/20 flex items-center justify-between border-b">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span className="text-xs font-bold uppercase tracking-widest text-primary">
                            ยังไม่ได้อ่าน {unreadCount} รายการ
                        </span>
                    </div>
                </div>
            )}

            <div className="flex flex-col">
                {notifications.map((notification, index) => {
                    const severityConfig = {
                        CRITICAL: {
                            icon: AlertCircle,
                            color: "text-rose-500",
                            bg: "bg-rose-500/10",
                            border: "border-rose-500/20",
                            glow: "group-hover:bg-rose-500/5"
                        },
                        WARNING: {
                            icon: AlertTriangle,
                            color: "text-amber-500",
                            bg: "bg-amber-500/10",
                            border: "border-amber-500/20",
                            glow: "group-hover:bg-amber-500/5"
                        },
                        INFO: {
                            icon: Info,
                            color: "text-indigo-500",
                            bg: "bg-indigo-500/10",
                            border: "border-indigo-500/20",
                            glow: "group-hover:bg-indigo-500/5"
                        }
                    }[notification.severity as 'CRITICAL' | 'WARNING' | 'INFO'] || {
                        icon: Info,
                        color: "text-slate-500",
                        bg: "bg-slate-500/10",
                        border: "border-slate-500/20",
                        glow: "group-hover:bg-slate-500/5"
                    };

                    const Icon = severityConfig.icon;

                    return (
                        <div
                            key={notification.id}
                            style={{ animationDelay: `${index * 50}ms` }}
                            className={cn(
                                "group relative flex flex-col md:flex-row gap-4 p-5 transition-all duration-300 animate-in fade-in slide-in-from-left-4",
                                !notification.isRead && "bg-primary/[0.02]",
                                severityConfig.glow
                            )}
                        >
                            {/* Unread dot - Mobile floating, Desktop fixed */}
                            {!notification.isRead && (
                                <div className="absolute top-6 left-2 md:left-4">
                                    <Circle className="h-2 w-2 fill-primary text-primary" />
                                </div>
                            )}

                            {/* Main Content Area */}
                            <div className="flex items-start gap-4 flex-1">
                                {/* Icon container */}
                                <div className={cn(
                                    "mt-0.5 p-3 rounded-2xl border shrink-0 transition-transform group-hover:scale-110",
                                    severityConfig.bg,
                                    severityConfig.border,
                                    severityConfig.color
                                )}>
                                    <Icon className="w-5 h-5" />
                                </div>

                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                        <h4 className={cn(
                                            "text-sm font-bold tracking-tight",
                                            !notification.isRead ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {notification.title}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                            <Clock className="w-3 h-3" />
                                            <ClientDate date={notification.createdAt} />
                                        </div>
                                    </div>
                                    
                                    <p className={cn(
                                        "text-xs leading-relaxed max-w-2xl",
                                        !notification.isRead ? "text-muted-foreground" : "text-muted-foreground/60"
                                    )}>
                                        {notification.message}
                                    </p>

                                    <div className="pt-1">
                                        <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0 h-5 bg-muted/50 text-muted-foreground border-none">
                                            {notification.type.replace('_', ' ').toUpperCase()}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Area */}
                            <div className="flex items-center gap-2 self-end md:self-center pl-14 md:pl-0">
                                {notification.link && (
                                    <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-2 px-4 font-bold text-xs gap-2 hover:bg-primary hover:text-primary-foreground transition-all">
                                        <Link href={notification.link}>
                                            ดูรายละเอียด
                                            <ChevronRight className="h-3 w-3" />
                                        </Link>
                                    </Button>
                                )}
                                {!notification.isRead && (
                                    <Button
                                        onClick={() => handleMarkAsRead(notification.id)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                        title="ทำเครื่องหมายว่าอ่านแล้ว"
                                    >
                                        <Check className="h-5 w-5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
