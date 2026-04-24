import { Suspense } from 'react';
import { getPurchaseTaxes } from '@/actions/tax/tax.actions';
import { PurchaseTaxList } from '@/components/tax/purchase-tax-list';
import Loading from '@/app/(dashboard)/loading';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import Link from 'next/link';

interface PurchaseTaxPageProps {
    searchParams: {
        page?: string;
        search?: string;
        status?: string;
        claimStatus?: string;
    };
}

async function TaxListWrapper({ searchParams }: PurchaseTaxPageProps) {
    const res = await getPurchaseTaxes({
        page: Number(searchParams.page) || 1,
        search: searchParams.search,
        status: searchParams.status,
        claimStatus: searchParams.claimStatus,
    });

    if (!res.success) {
        return (
            <div className="p-8 text-center text-destructive">
                <p>เกิดข้อผิดพลาด: {res.message}</p>
            </div>
        );
    }

    return <PurchaseTaxList data={(res.data as any).data} />;
}

export default function PurchaseTaxPage({ searchParams }: PurchaseTaxPageProps) {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">ภาษีซื้อ (Purchase Tax)</h1>
                    <p className="text-muted-foreground mt-1">
                        จัดการใบกำกับภาษีจากคู่ค้า และบันทึกรายงานภาษีซื้อ
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2" asChild>
                        <Link href="/tax/reports">
                            <FileText className="h-4 w-4" />
                            ดูรายงานภาษี (P.P.30)
                        </Link>
                    </Button>
                    <Button className="gap-2" disabled>
                        <Plus className="h-4 w-4" />
                        สร้างแบบแมนนวล (เร็วๆ นี้)
                    </Button>
                </div>
            </div>

            <Suspense fallback={<Loading />}>
                <TaxListWrapper searchParams={searchParams} />
            </Suspense>
        </div>
    );
}
