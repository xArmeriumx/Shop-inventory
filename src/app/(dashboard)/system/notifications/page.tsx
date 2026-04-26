import { getNotifications, markAllNotificationsAsRead } from '@/actions/core/notifications.actions';
import { NotificationList } from '@/components/core/notifications/notification-list';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Bell, Settings, Info, Filter } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { Separator } from '@/components/ui/separator';

export const dynamic = 'force-dynamic';
export const metadata = {
    title: 'การแจ้งเตือน (Notifications) | Shop Inventory ERP',
    description: 'ศูนย์รวมการแจ้งเตือนและสถานะการทำงานของระบบ',
};

export default async function NotificationsPage() {
    const result = await getNotifications(50);
    const notifications = result.success ? result.data : [];

    async function handleMarkAllRead() {
        'use server';
        await markAllNotificationsAsRead();
        revalidatePath('/system/notifications');
    }

    return (
        <div className="container mx-auto max-w-6xl py-6 md:py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Bell className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">System Center</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">การแจ้งเตือน</h1>
                    <p className="text-muted-foreground text-sm font-medium">
                        ติดตามความเคลื่อนไหวและสถานะความเรียบร้อยของทุกแผนกในร้านค้าของคุณ
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <form action={handleMarkAllRead}>
                        <Button 
                            variant="outline" 
                            className="bg-background/50 backdrop-blur-sm border-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all font-bold px-5"
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            อ่านแล้วทั้งหมด
                        </Button>
                    </form>
                    <Button variant="ghost" size="icon" className="rounded-xl border h-10 w-10">
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Separator className="bg-border/50" />

            <div className="grid gap-8 lg:grid-cols-12 px-2">
                {/* Main Notification Feed */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Filter className="w-3 h-3" />
                            รายการล่าสุด
                        </h2>
                    </div>
                    
                    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                        <div className="p-1 md:p-2">
                            <NotificationList initialNotifications={notifications as any} />
                        </div>
                    </div>
                </div>

                {/* Sidebar Context */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl border-2 border-dashed p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border w-fit">
                                <Info className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold">เกี่ยวกับศูนย์แจ้งเตือน</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    ระบบจะแจ้งเตือนเมื่อพบเหตุการณ์สำคัญ เช่น สต็อกสินค้าต่ำ, การอนุมัติเอกสารค้างชำระ, หรือเหตุการณ์ด้านความปลอดภัย
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-dashed">
                            <h4 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">ระดับความสำคัญ</h4>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-medium p-2 rounded-lg bg-background/50 border">
                                    <span className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                                        เร่งด่วน (Critical)
                                    </span>
                                    <span className="text-muted-foreground">ต้องจัดการทันที</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-medium p-2 rounded-lg bg-background/50 border">
                                    <span className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        เฝ้าระวัง (Warning)
                                    </span>
                                    <span className="text-muted-foreground">ควรตรวจสอบ</span>
                                </div>
                            </div>
                        </div>

                        <Button variant="ghost" className="w-full text-xs font-bold text-muted-foreground hover:text-primary transition-colors py-6">
                            ดูประวัติ Audit Trail ทั้งหมด
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
