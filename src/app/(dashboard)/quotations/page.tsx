import { Metadata } from 'next';
import { getQuotations } from '@/actions/sales/quotations.actions';
import { TableView, Column } from '@/components/ui/table-view';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { QuotationStatus } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Plus, Eye } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'ใบเสนอราคา | ERP System',
};

const QUOTATION_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: { label: 'ฉบับร่าง', variant: 'secondary' },
    SENT: { label: 'ส่งแล้ว', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
    CONFIRMED: { label: 'ยืนยันแล้ว', variant: 'default', className: 'bg-green-500' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

interface PageProps {
    searchParams: {
        page?: string;
        search?: string;
        status?: string;
    };
}

export default async function QuotationsPage({ searchParams }: PageProps) {
    const result = await getQuotations({
        page: Number(searchParams.page) || 1,
        search: searchParams.search,
        status: searchParams.status as QuotationStatus,
    });

    if (!result.success) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg border border-dashed">
                <h3 className="text-lg font-semibold">ไม่สามารถดึงข้อมูลใบเสนอราคาได้</h3>
                <p className="text-muted-foreground">{result.message}</p>
            </div>
        );
    }

    const columns: Column<any>[] = [
        {
            header: 'เลขที่ใบเสนอราคา',
            accessor: (item) => (
                <span className="font-medium text-blue-600">{item.quotationNo}</span>
            ),
        },
        {
            header: 'ลูกค้า',
            accessor: (item) => item.customer?.name || '-',
        },
        {
            header: 'วันที่',
            accessor: (item) => <ClientDate date={item.date} />,
        },
        {
            header: 'ยอดรวม',
            accessor: (item) => (
                <span className="font-semibold">
                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(item.totalAmount))}
                </span>
            ),
            align: 'right',
        },
        {
            header: 'สถานะ',
            accessor: (item) => (
                <StatusBadge status={item.status} config={QUOTATION_STATUS_CONFIG} />
            ),
            align: 'center',
        },
        {
            header: 'จัดการ',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    <Link href={`/quotations/${item.id}`}>
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
                title="ใบเสนอราคา (Quotations)"
                description="จัดการใบเสนอราคาและติดตามสถานะ"
                items={result.data?.data || []}
                columns={columns}
                keyExtractor={(item) => item.id}
                actionButton={
                    <Link href="/quotations/new">
                        <Button className="bg-primary hover:bg-primary/90 text-white font-bold">
                            <Plus className="mr-2 h-4 w-4" /> ออกใบเสนอราคา
                        </Button>
                    </Link>
                }
            />
        </div>
    );
}
