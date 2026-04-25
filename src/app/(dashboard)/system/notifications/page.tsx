import { getNotifications, markAllNotificationsAsRead } from '@/actions/core/notifications.actions';
import { NotificationList } from '@/components/core/notifications/notification-list';
import { Button } from '@/components/ui/button';
import { CheckCircle2, BellRing, Settings, ShieldAlert } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const metadata = {
    title: 'ศูนย์แจ้งเตือน (Notifications) | Shop Inventory ERP',
    description: 'จัดการคำสั่งการและสถานะการทำงานของระบบ',
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
        <div className="space-y-10 pb-12">
            {/* Command Center Style Header */}
            <div className="relative group overflow-hidden rounded-[3rem] border-2 border-primary/20 bg-primary/5 p-10 shadow-2xl shadow-primary/5">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-[2rem] bg-foreground text-background flex items-center justify-center shadow-2xl">
                            <BellRing className="h-10 w-10 animate-bounce" />
                        </div>
                        <div className="space-y-1 text-center md:text-left">
                            <h1 className="text-4xl font-black tracking-tighter">Notification Center</h1>
                            <p className="text-muted-foreground font-medium max-w-lg">
                                ติดตามความเคลื่อนไหว สุขภาพระบบ และงานค้างดำเนินต่างของธุรกิจในระดับวินาที
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <form action={handleMarkAllRead}>
                            <Button variant="default" className="rounded-2xl h-12 px-8 font-black bg-foreground text-background hover:bg-foreground/90 shadow-xl transition-transform active:scale-95">
                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                มาร์คอ่านแล้วทั้งหมด
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
                {/* Main Notification Stream */}
                <div className="lg:col-span-8">
                    <div className="bg-background rounded-[2.5rem] border-2 shadow-2xl overflow-hidden min-h-[600px] relative">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-500 to-primary" />
                         <div className="p-1 sm:p-4 lg:p-8">
                            <NotificationList initialNotifications={notifications as any} />
                         </div>
                    </div>
                </div>

                {/* Side Insights (Governance Context) */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-muted/30 rounded-[2rem] border-2 border-dashed p-8 space-y-6">
                        <div className="space-y-2">
                             <div className="flex items-center gap-2 text-primary">
                                <ShieldAlert className="h-5 w-5" />
                                <span className="text-sm font-black uppercase tracking-widest">System Rule 12</span>
                             </div>
                             <h3 className="text-xl font-black italic">Attention Required</h3>
                             <p className="text-sm text-balance text-muted-foreground font-medium leading-relaxed">
                                การแจ้งเตือนเหล่านี้สะท้อนถึงความสมบูรณ์ของระบบ การดำเนินการใดๆ จะถูกบันทึกใน Audit Trail เพื่อใช้ในกระบวนการตรวจสอบย้อนกลับ (Traceability)
                             </p>
                        </div>

                        <div className="pt-6 border-t font-black">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Notification Frequency</p>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">System Alerts</span>
                                    <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg">High</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Workflow Ops</span>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-lg">Medium</span>
                                </div>
                            </div>
                        </div>
                        
                        <Button variant="outline" className="w-full rounded-2xl border-2 h-12 font-black gap-2">
                            <Settings className="h-4 w-4" />
                            Alert Settings
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
