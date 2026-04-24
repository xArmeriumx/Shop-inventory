import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth-guard';
import { SetupProgressCard } from '@/components/onboarding/setup-progress-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import Link from 'next/link';

export default async function OnboardingHubPage() {
    const ctx = await requireAuth();

    // Only admins/owners see the hub
    const isAdmin = ctx.permissions.includes('REPORT_VIEW_SALES' as any) || ctx.isOwner;
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <h1 className="text-xl font-bold mb-2">เข้าถึงไม่ได้</h1>
                <p className="text-muted-foreground">ส่วนนี้สำหรับเจ้าของร้านและผู้ดูแลระบบเท่านั้น</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
                    <ArrowLeft className="h-4 w-4" />
                    กลับไปที่ Dashboard
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Onboarding Hub</h1>
                    <p className="text-muted-foreground">คู่มือการตั้งค่าร้านค้าให้พร้อมสำหรับการใช้งานจริง</p>
                </div>
            </div>

            {/* Checklist Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">รายการตั้งค่าทั้งหมด</h2>
                </div>
                <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-xl" />}>
                    <SetupProgressCard />
                </Suspense>
            </div>

            {/* Support Section */}
            <div className="rounded-2xl border bg-muted/30 p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="h-16 w-16 rounded-2xl bg-background flex items-center justify-center shrink-0 shadow-sm border">
                    <LifeBuoy className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-lg font-bold">ต้องการความช่วยเหลือ?</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        หากคุณมีข้อสงสัยเกี่ยวกับการตั้งค่า หรือต้องการย้ายข้อมูลจากระบบเดิม
                        ทีมงานของเราพร้อมให้คำปรึกษาฟรีทุกรูปแบบ
                    </p>
                </div>
                <Link
                    href="/help"
                    className="inline-flex items-center justify-center rounded-xl bg-foreground px-6 py-3 text-sm font-bold text-background hover:bg-foreground/90 transition-colors"
                >
                    ติดต่อฝ่ายสนับสนุน
                </Link>
            </div>
        </div>
    );
}
