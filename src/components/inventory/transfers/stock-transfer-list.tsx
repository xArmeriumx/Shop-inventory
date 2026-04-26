'use client';

import { TableView, Column } from '@/components/ui/table-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, CheckCircle2, ArrowRightLeft, Clock, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { SectionHeader } from '@/components/ui/section-header';
import { completeStockTransferAction } from '@/actions/inventory/stock-transfer.actions';
import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { runActionWithToast } from '@/lib/mutation-utils';

interface StockTransferListProps {
    transfers: any[];
}

const TRANSFER_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: { label: 'ฉบับร่าง', variant: 'secondary' },
    IN_TRANSIT: { label: 'ระหว่างโอน', variant: 'outline', className: 'text-amber-600 border-amber-200 bg-amber-50' },
    COMPLETED: { label: 'สำเร็จ', variant: 'default', className: 'bg-green-600' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

export function StockTransferList({ transfers }: StockTransferListProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleComplete = (id: string) => {
        if (!confirm('ยืนยันการโอนสินค้าใช่หรือไม่? ยอดสต็อกจะถูกหักจากต้นทางและเพิ่มเข้าปลายทางทันที')) return;

        startTransition(async () => {
            await runActionWithToast(completeStockTransferAction(id), {
                successMessage: 'ยืนยันการโอนสินค้าเรียบร้อยแล้ว',
                onSuccess: () => router.refresh()
            });
        });
    };

    const columns: Column<any>[] = [
        {
            header: 'เลขที่ใบโอน',
            accessor: (row) => (
                <div className="flex flex-col">
                    <span className="font-mono font-bold text-primary">{row.transferNo}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(row.createdAt)}</span>
                </div>
            ),
        },
        {
            header: 'จากคลัง',
            accessor: (row) => (
                <Badge variant="outline" className="bg-slate-50">
                    {row.fromWarehouse?.name}
                </Badge>
            ),
        },
        {
            header: '',
            accessor: () => <ArrowRightLeft className="h-4 w-4 text-muted-foreground mx-auto" />,
        },
        {
            header: 'ไปคลัง',
            accessor: (row) => (
                <Badge variant="outline" className="bg-slate-50 border-blue-200 text-blue-700">
                    {row.toWarehouse?.name}
                </Badge>
            ),
        },
        {
            header: 'ผู้ทำรายการ',
            accessor: (row) => <span className="text-sm">{row.member?.user?.name || 'ระบบ'}</span>,
        },
        {
            header: 'สถานะ',
            accessor: (row) => <StatusBadge status={row.status} config={TRANSFER_STATUS_CONFIG} />,
        },
        {
            header: '',
            accessor: (row) => (
                <div className="flex justify-end gap-2">
                    {row.status === 'DRAFT' && (
                        <Button
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 h-8"
                            onClick={() => handleComplete(row.id)}
                            loading={isPending}
                        >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> ยืนยันการโอน
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <SectionHeader
                    title="การโอนสินค้า (Stock Transfers)"
                    description="ติดตามและจัดการการเคลื่อนย้ายสินค้าระหว่างคลังสินค้า"
                />
                <Button asChild>
                    <Link href="/inventory/transfers/new">+ สร้างใบโอนสินค้า</Link>
                </Button>
            </div>

            <div className="bg-card rounded-xl border shadow-sm overflow-hidden text-center">
                {transfers.length > 0 ? (
                    <TableView
                        items={transfers}
                        columns={columns}
                        keyExtractor={(item) => item.id}
                    />
                ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                        <ArrowRightLeft className="h-12 w-12 mb-4 opacity-20" />
                        <p>ยังไม่มีรายการโอนสินค้า</p>
                        <Button variant="link" asChild className="mt-2">
                            <Link href="/inventory/transfers/new">คลิกที่นี่เพื่อเริ่มการโอนสินค้าครั้งแรก</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
