import { Metadata } from 'next';
import { getOrderRequests } from '@/actions/sales/order-requests.actions';
import { TableView, Column } from '@/components/ui/table-view';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { OrderRequestStatus } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Plus, Eye } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'คำขอซื้อภายใน | ERP System',
};

const ORDER_REQUEST_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: { label: 'ฉบับร่าง', variant: 'secondary' },
    SUBMITTED: { label: 'ส่งขออนุมัติ', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
    APPROVED: { label: 'อนุมัติแล้ว', variant: 'default', className: 'bg-green-500' },
    IN_PROGRESS: { label: 'กำลังดำเนินการ', variant: 'outline', className: 'border-blue-500 text-blue-600' },
    DONE: { label: 'เสร็จสิ้น', variant: 'default', className: 'bg-green-600' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

interface PageProps {
    searchParams: {
        page?: string;
        search?: string;
        status?: string;
    };
}

export default async function OrderRequestsPage({ searchParams }: PageProps) {
    const result = await getOrderRequests({
        page: Number(searchParams.page) || 1,
        search: searchParams.search,
        status: searchParams.status as OrderRequestStatus,
    });

    const columns: Column<any>[] = [
        {
            header: 'เลขที่คำขอ',
            accessor: (item) => (
                <span className="font-medium text-purple-600">{item.requestNo}</span>
            ),
        },
        {
            header: 'ผู้ขอซื้อ',
            accessor: (item) => item.requester?.user?.name || '-',
        },
        {
            header: 'วันที่',
            accessor: (item) => <ClientDate date={item.date} />,
        },
        {
            header: 'สถานะ',
            accessor: (item) => (
                <StatusBadge status={item.status} config={ORDER_REQUEST_STATUS_CONFIG} />
            ),
            align: 'center',
        },
        {
            header: 'จัดการ',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    <Link href={`/order-requests/${item.id}`}>
                        <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            ),
            align: 'center',
        },
    ];

    return (
        <div className="space-y-4 p-6">
            <TableView
                title="คำขอซื้อ (Order Requests)"
                description="จัดการคำขอซื้อภายใน (Internal PR) เพื่อสร้างใบสั่งซื้อ (PO)"
                items={result.data}
                columns={columns}
                keyExtractor={(item) => item.id}
                actionButton={
                    <Link href="/order-requests/new">
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                            <Plus className="mr-2 h-4 w-4" /> สร้างคำขอซื้อ
                        </Button>
                    </Link>
                }
            />
        </div>
    );
}
