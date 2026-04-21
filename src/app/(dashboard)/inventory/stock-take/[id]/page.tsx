import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { StockTakeService } from '@/services/stock-take.service';
import { requireShop } from '@/lib/auth-guard';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { StockTakeCountingForm } from '@/components/inventory/stock-take-counting-form';
import { serialize } from '@/lib/utils';

async function StockTakeDetail({ id }: { id: string }) {
    const ctx = await requireShop();
    const session = await StockTakeService.getSessionDetails(id, ctx);

    if (!session) notFound();

    return <StockTakeCountingForm session={serialize(session)} />;
}

export default async function StockTakeDetailPage({ params }: { params: { id: string } }) {
    return (
        <div className="space-y-6 max-w-7xl mx-auto py-8 px-4">
            <BackPageHeader
                backHref="/inventory/stock-take"
                title={`รายการตรวจนับ #${params.id.slice(-6).toUpperCase()}`}
            />

            <Suspense fallback={<div>กำลังโหลดรายละเอียด...</div>}>
                <StockTakeDetail id={params.id} />
            </Suspense>
        </div>
    );
}
