import { getNotifications, markAllNotificationsAsRead } from '@/actions/core/notifications.actions';
import { SectionHeader } from '@/components/ui/section-header';
import { NotificationList } from '@/components/core/notifications/notification-list';
import { Button } from '@/components/ui/button';
import { CheckCircle2, RotateCw } from 'lucide-react';
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
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
            <SectionHeader
                title="ศูนย์แจ้งเตือน (Notification Center)"
                description="ติดตามความเคลื่อนไหว สุขภาพระบบ และงานค้างดำเนินต่างของธุรกิจ"
                action={
                    <div className="flex gap-2">
                        <form action={handleMarkAllRead}>
                            <Button variant="outline" size="sm" type="submit">
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                อ่านแล้วทั้งหมด
                            </Button>
                        </form>
                    </div>
                }
            />

            <div className="bg-background rounded-2xl border shadow-sm p-4 sm:p-6 min-h-[500px]">
                <NotificationList initialNotifications={notifications as any} />
            </div>
        </div>
    );
}
