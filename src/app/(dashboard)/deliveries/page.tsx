import { Metadata } from 'next';
import { DeliveryOrderService } from '@/services/inventory/delivery-order.service';
import { requirePermission } from '@/lib/auth-guard';
import { TableView, Column } from '@/components/ui/table-view';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { DeliveryStatus } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Eye, Truck } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'รายการใบส่งของ | ERP System',
};

const DELIVERY_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: { label: 'ฉบับร่าง', variant: 'secondary' },
    WAITING: { label: 'รอส่ง', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
    PROCESSING: { label: 'กำลังแพ็ค', variant: 'outline', className: 'border-blue-500 text-blue-600' },
    SHIPPED: { label: 'ส่งแล้ว', variant: 'outline', className: 'border-purple-500 text-purple-600' },
    DELIVERED: { label: 'ถึงมือลูกค้า', variant: 'default', className: 'bg-green-600' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

interface PageProps {
    searchParams: {
        page?: string;
        search?: string;
        status?: DeliveryStatus;
    };
}

export default async function DeliveryOrdersPage({ searchParams }: PageProps) {
    const ctx = await requirePermission('DELIVERY_VIEW');

    const result = await DeliveryOrderService.list(ctx, {
        page: Number(searchParams.page) || 1,
        search: searchParams.search,
        status: searchParams.status,
    });

    const columns: Column<any>[] = [
        {
            header: 'เลขที่ใบส่งของ',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold">{item.deliveryNo}</span>
                </div>
            ),
        },
        {
            header: 'เลขอ้างอิงการขาย',
            accessor: (item) => item.sale?.invoiceNumber || '-',
        },
        {
            header: 'ลูกค้า',
            accessor: (item) => item.sale?.customer?.name || '-',
        },
        {
            header: 'วันที่กำหนดส่ง',
            accessor: (item) => item.scheduledDate ? <ClientDate date={item.scheduledDate} /> : '-',
        },
        {
            header: 'สถานะ',
            accessor: (item) => (
                <StatusBadge status={item.status} config={DELIVERY_STATUS_CONFIG} />
            ),
            align: 'center',
        },
        {
            header: 'จัดการ',
            accessor: (item) => (
                <Link href={`/deliveries/${item.id}`}>
                    <Button variant="ghost" size="sm">
                        <Eye className="mr-2 h-4 w-4" /> ดูรายละเอียด
                    </Button>
                </Link>
            ),
            align: 'center',
        },
    ];

    return (
        <div className="p-6 space-y-4">
            <TableView
                title="รายการใบส่งสินค้า (Delivery Orders)"
                description="ติดตามสถานะการจัดส่งสินค้าให้ลูกค้า"
                items={result.data}
                columns={columns}
                keyExtractor={(item) => item.id}
            />
        </div>
    );
}
