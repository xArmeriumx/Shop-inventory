import { Metadata } from 'next';
import { getApprovals } from '@/actions/core/approvals.actions';
import { TableView, Column } from '@/components/ui/table-view';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { ApprovalStatus } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'รายการรออนุมัติ | ERP System',
};

const APPROVAL_STATUS_CONFIG: Record<string, StatusConfig> = {
    PENDING: { label: 'รออนุมัติ', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
    APPROVED: { label: 'อนุมัติแล้ว', variant: 'default', className: 'bg-green-500' },
    REJECTED: { label: 'ปฏิเสธ', variant: 'destructive' },
};

interface PageProps {
    searchParams: {
        page?: string;
        status?: string;
    };
}

export default async function ApprovalsPage({ searchParams }: PageProps) {
    const result = await getApprovals({
        page: Number(searchParams.page) || 1,
        status: searchParams.status as ApprovalStatus || ApprovalStatus.PENDING,
    });

    const columns: Column<any>[] = [
        {
            header: 'ประเภทเอกสาร',
            accessor: (item) => (
                <span className="font-medium text-muted-foreground uppercase">{item.documentType}</span>
            ),
        },
        {
            header: 'เลขที่เอกสาร',
            accessor: (item) => (
                <span className="font-bold">{item.documentId}</span>
            ),
        },
        {
            header: 'ส่งโดย',
            accessor: (item) => item.requesterName || '-',
        },
        {
            header: 'วันที่ส่ง',
            accessor: (item) => <ClientDate date={item.createdAt} />,
        },
        {
            header: 'สถานะ',
            accessor: (item) => (
                <StatusBadge status={item.status} config={APPROVAL_STATUS_CONFIG} />
            ),
            align: 'center',
        },
        {
            header: 'จัดการ',
            accessor: (item) => (
                <div className="flex items-center gap-2">
                    {/* We'll link to the specific document page based on type */}
                    <Link href={getDocumentUrl(item.documentType, item.documentId)}>
                        <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" /> ดูเอกสาร
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
                title="รายการอนุมัติ (Approvals Inbox)"
                description="ตรวจสอบและอนุมัติเอกสารต่างๆ ในระบบ"
                items={result.data}
                columns={columns}
                keyExtractor={(item) => item.id}
            />
        </div>
    );
}

function getDocumentUrl(type: string, id: string): string {
    switch (type) {
        case 'ORDER_REQUEST': return `/order-requests/${id}`;
        case 'SALE': return `/sales/${id}`;
        case 'PURCHASE': return `/purchases/${id}`;
        default: return '#';
    }
}
