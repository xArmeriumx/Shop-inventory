import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { getInvoices, getInvoiceStats } from '@/actions/sales/invoices.actions';
import { TableView, Column } from '@/components/ui/table-view';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { Button } from '@/components/ui/button';
import { Eye, Receipt, AlertCircle, FileEdit, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCurrency } from '@/lib/utils';
import { MetricGrid } from '@/components/ui/metric-card';
import { InvoiceFilters } from '@/components/sales/invoices/invoice-filters';
import { PaginationControl } from '@/components/ui/pagination-control';
import { BulkPostButton } from '@/components/sales/invoices/bulk-post-button';

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

    if (!result.success) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg border border-dashed">
                <AlertCircle className="w-10 h-10 text-destructive mb-4" />
                <h3 className="text-lg font-semibold">ไม่สามารถดึงข้อมูลใบแจ้งหนี้ได้</h3>
                <p className="text-muted-foreground">{result.message}</p>
            </div>
        );
    }

    const statsData = stats.success ? stats.data : {
        draft: { count: 0 },
        unpaid: { amount: 0, count: 0 },
        overdue: { amount: 0, count: 0 },
        pendingPost: { count: 0 },
    };

    const pendingPostCount = statsData.pendingPost?.count || 0;

    const metrics = [
        {
            label: 'รอดำเนินการ (Draft)',
            value: (statsData.draft?.count || 0).toString(),
            icon: <FileEdit className="h-4 w-4" />,
            iconClassName: 'text-gray-400',
            hint: 'รายการที่ยังไม่ได้รับรองการลงบัญชี',
        },
        {
            label: 'ยอดค้างชำระทั้งหมด',
            value: formatCurrency(statsData.unpaid?.amount || 0),
            icon: <Receipt className="h-4 w-4" />,
            iconClassName: 'text-blue-500',
            hint: `จาก ${statsData.unpaid?.count || 0} ใบแจ้งหนี้`,
        },
        {
            label: 'ยอดลูกหนี้ที่เกินกำหนด',
            value: formatCurrency(statsData.overdue?.amount || 0),
            icon: <AlertCircle className="h-4 w-4" />,
            iconClassName: 'text-red-500',
            hint: `${statsData.overdue?.count || 0} ใบที่เกินวันครบกำหนด`,
        },
        {
            label: 'รอลงบัญชี (POS)',
            value: pendingPostCount.toString(),
            icon: <BookOpen className="h-4 w-4" />,
            iconClassName: pendingPostCount > 0 ? 'text-amber-500' : 'text-gray-400',
            hint: pendingPostCount > 0 ? 'ขายแล้วแต่ยังไม่ได้ Post ลง Ledger' : 'ลงบัญชีครบแล้ว',
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
            accessor: (row) => (
                <div className="flex flex-col gap-1">
                    <StatusBadge status={row.status} config={INVOICE_STATUS_CONFIG} />
                    {/* Badge: PAID แต่ยังไม่ได้ Post ลงบัญชี */}
                    {row.status === 'PAID' && row.taxPostingStatus === 'DRAFT' && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                            <BookOpen className="h-2.5 w-2.5" />
                            รอลงบัญชี
                        </span>
                    )}
                </div>
            ),
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
            <div className="flex items-start justify-between">
                <SectionHeader
                    title="ใบแจ้งหนี้ (Billing)"
                    description="จัดการใบแจ้งหนี้ ติดตามยอดค้างชำระ และตรวจสอบสถานะทางภาษี"
                />
                {pendingPostCount > 0 && (
                    <BulkPostButton pendingCount={pendingPostCount} />
                )}
            </div>

            <MetricGrid items={metrics} columns={4} />

            <InvoiceFilters search={params.search} status={params.status} />

            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <TableView
                    items={result.data?.data || []}
                    columns={columns}
                    keyExtractor={(item) => item.id}
                />
            </div>

            <PaginationControl
                pagination={result.data?.pagination as any}
            />
        </div>
    );
}
