import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { getInvoices } from '@/actions/invoices';
import { TableView, Column } from '@/components/ui/table-view';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { Button } from '@/components/ui/button';
import { Eye, FilePlus } from 'lucide-react';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCurrency } from '@/lib/utils';

export const metadata: Metadata = {
    title: 'ใบแจ้งหนี้ | ERP System',
};

const INVOICE_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: { label: 'ฉบับร่าง', variant: 'secondary' },
    POSTED: { label: 'บันทึกแล้ว', variant: 'outline', className: 'border-blue-500 text-blue-600' },
    PAID: { label: 'ชำระแล้ว', variant: 'default', className: 'bg-green-600' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

interface InvoicesPageProps {
    searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
    await requirePermission('SALE_VIEW');
    const params = await searchParams;

    const result = await getInvoices({
        page: params.page ? Number(params.page) : 1,
        search: params.search,
        status: params.status,
    });

    const columns: Column<any>[] = [
        {
            header: 'เลขที่ใบแจ้งหนี้',
            accessor: (row) => (
                <span className="font-mono font-semibold text-primary">{row.invoiceNo}</span>
            ),
        },
        {
            header: 'ลูกค้า',
            accessor: (row) => row.customer?.name ?? '-',
        },
        {
            header: 'วันที่ออก',
            accessor: (row) => <ClientDate date={row.date} />,
        },
        {
            header: 'ยอดรวม',
            accessor: (row) => (
                <span className="font-semibold">
                    {formatCurrency(Number(row.totalAmount))}
                </span>
            ),
        },
        {
            header: 'ยอดค้างชำระ',
            accessor: (row) => (
                <span className={Number(row.residualAmount) > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                    {Number(row.residualAmount) > 0 ? formatCurrency(Number(row.residualAmount)) : '-'}
                </span>
            ),
        },
        {
            header: 'สถานะ',
            accessor: (row) => <StatusBadge status={row.status} config={INVOICE_STATUS_CONFIG} />,
        },
        {
            header: '',
            accessor: (row) => (
                <Button asChild variant="ghost" size="sm">
                    <Link href={`/invoices/${row.id}`}>
                        <Eye className="h-4 w-4 mr-1" /> ดู
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <SectionHeader
                title="ใบแจ้งหนี้"
                description="จัดการใบแจ้งหนี้และติดตามการรับชำระเงิน"
            />
            <TableView
                items={result.data}
                columns={columns}
                keyExtractor={(item) => item.id}
            />
        </div>
    );
}

