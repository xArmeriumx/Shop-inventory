import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { getInvoices, getInvoiceStats } from '@/actions/sales/invoices.actions';
import { TableView, Column } from '@/components/ui/table-view';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { Button } from '@/components/ui/button';
import { Eye, Receipt, AlertCircle, FileEdit } from 'lucide-react';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCurrency } from '@/lib/utils';
import { MetricGrid } from '@/components/ui/metric-card';
import { InvoiceFilters } from '@/components/sales/invoices/invoice-filters';
import { PaginationControl } from '@/components/ui/pagination-control';

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

    const [result, stats] = await Promise.all([
        getInvoices({
            page: params.page ? Number(params.page) : 1,
            search: params.search,
            status: params.status === 'all' ? undefined : params.status,
        }),
        getInvoiceStats(),
    ]);

    const metrics = [
        {
            label: 'รอดำเนินการ (Draft)',
            value: stats.draft.count.toString(),
            icon: <FileEdit className="h-4 w-4" />,
            iconClassName: 'text-gray-400',
            hint: 'รายการที่ยังไม่ได้รับรองการลงบัญชี',
        },
        {
            label: 'ยอดค้างชำระทั้งหมด',
            value: formatCurrency(stats.unpaid.amount),
            icon: <Receipt className="h-4 w-4" />,
            iconClassName: 'text-blue-500',
            hint: `จาก ${stats.unpaid.count} ใบแจ้งหนี้`,
        },
        {
            label: 'ยอดลูกหนี้ที่เกินกำหนด',
            value: formatCurrency(stats.overdue.amount),
            icon: <AlertCircle className="h-4 w-4" />,
            iconClassName: 'text-red-500',
            hint: `${stats.overdue.count} ใบที่เกินวันครบกำหนด`,
        },
    ];

    const columns: Column<any>[] = [
        {
            header: 'เลขที่ใบแจ้งหนี้',
            accessor: (row) => (
                <div className="flex flex-col">
                    <span className="font-mono font-semibold text-primary">{row.invoiceNo}</span>
                    <span className="text-[10px] text-muted-foreground">{row.isTaxInvoice ? 'ใบกำกับภาษี' : 'ใบแจ้งหนี้'}</span>
                </div>
            ),
        },
        {
            header: 'ลูกค้า',
            accessor: (row) => (
                <div className="flex flex-col max-w-[200px]">
                    <span className="font-medium truncate">{row.customerNameSnapshot ?? row.customer?.name}</span>
                    <span className="text-[10px] text-muted-foreground">{row.taxIdSnapshot || '-'}</span>
                </div>
            ),
        },
        {
            header: 'วันที่ออก',
            accessor: (row) => <ClientDate date={row.date} />,
        },
        {
            header: 'ยอดรวมสุทธิ',
            accessor: (row) => (
                <span className="font-bold text-primary">
                    {formatCurrency(Number(row.totalAmount))}
                </span>
            ),
        },
        {
            header: 'ยอดค้างชำระ',
            accessor: (row) => (
                <span className={Number(row.residualAmount) > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                    {Number(row.residualAmount) > 0 ? formatCurrency(Number(row.residualAmount)) : 'ชำระครบแล้ว'}
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
                <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/invoices/${row.id}`}>
                            <Eye className="h-4 w-4 mr-1" /> รายละเอียด
                        </Link>
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <SectionHeader
                title="ใบแจ้งหนี้ (Billing)"
                description="จัดการใบแจ้งหนี้ ติดตามยอดค้างชำระ และตรวจสอบสถานะทางภาษี"
            />

            <MetricGrid items={metrics} columns={3} />

            <InvoiceFilters search={params.search} status={params.status} />

            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <TableView
                    items={result.data}
                    columns={columns}
                    keyExtractor={(item) => item.id}
                />
            </div>

            <PaginationControl
                pagination={result.pagination as any}
            />
        </div>
    );
}

