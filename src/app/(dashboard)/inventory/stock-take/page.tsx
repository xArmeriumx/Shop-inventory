import { Suspense } from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { requireShop } from '@/lib/auth-guard';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Badge } from '@/components/ui/badge';
import { Plus, ClipboardCheck, History } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { STOCK_TAKE_STATUS_CONFIG } from '@/constants/erp/inventory.constants';
import { serialize } from '@/lib/utils';

async function StockTakeList() {
    const { shopId } = await requireShop();

    // Fetch sessions
    const sessions = await (db as any).stockTakeSession.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        include: {
            creator: {
                include: { user: { select: { name: true } } }
            },
            _count: {
                select: { items: true }
            }
        }
    });

    if (sessions.length === 0) {
        return (
            <EmptyState
                icon={<ClipboardCheck className="w-12 h-12" />}
                title="ยังไม่มีรายการตรวจนับสต็อก"
                description="เริ่มต้นตรวจนับสต็อกเพื่อปรับสมดุลพัสดุในคลังของคุณให้ตรงกับความเป็นจริง"
                action={
                    <Button asChild>
                        <Link href="/products">เริ่มตรวจนับใหม่</Link>
                    </Button>
                }
            />
        );
    }

    return (
        <div className="grid gap-4">
            {sessions.map((session: any) => (
                <Link
                    key={session.id}
                    href={`/inventory/stock-take/${session.id}`}
                    className="group"
                >
                    <div className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-primary/50 transition-all hover:shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                                <History className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-lg">
                                        รายการตรวจนับ #{session.id.slice(-6).toUpperCase()}
                                    </span>
                                    <StatusBadge
                                        status={session.status}
                                        config={STOCK_TAKE_STATUS_CONFIG}
                                    />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    สร้างเมื่อ {format(session.createdAt, 'd MMM yyyy HH:mm', { locale: th })} โดย {session.creator?.user?.name ?? 'Unknown'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-medium text-lg">
                                {session._count.items} <span className="text-sm text-muted-foreground font-normal">รายการ</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {session.notes || 'ไม่มีหมายเหตุ'}
                            </p>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}

export default async function StockTakePage() {
    return (
        <div className="space-y-6 max-w-5xl mx-auto py-8 px-4">
            <SectionHeader
                title="รายการตรวจนับสต็อก"
                description="ประวัติการตรวจสอบสมดุลสต็อกและการกระทบยอด"
                action={
                    <Button asChild>
                        <Link href="/products" className="gap-2">
                            <Plus className="w-4 h-4" />
                            เริ่มตรวจนับใหม่
                        </Link>
                    </Button>
                }
            />

            <Suspense fallback={<div>กำลังโหลด...</div>}>
                <StockTakeList />
            </Suspense>
        </div>
    );
}
