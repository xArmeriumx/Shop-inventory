import { SettingsSidebar } from '@/components/layout/settings-sidebar';
import { SectionHeader } from '@/components/ui/section-header';
import { Separator } from '@/components/ui/separator';

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">ตั้งค่า (Settings)</h1>
                <p className="text-muted-foreground">
                    จัดการข้อมูลส่วนตัว ร้านค้า ทีมงาน และค่ากำหนดต่างๆ ของระบบ
                </p>
            </div>

            <Separator className="my-6" />

            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="-mx-4 lg:w-1/4">
                    <div className="px-4 lg:sticky lg:top-8">
                        <SettingsSidebar />
                    </div>
                </aside>
                <div className="flex-1 lg:max-w-4xl">
                    {children}
                </div>
            </div>
        </div>
    );
}
