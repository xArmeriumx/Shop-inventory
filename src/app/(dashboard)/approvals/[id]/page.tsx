import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { ApprovalService } from '@/services/core/workflow/approval.service';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { notFound } from 'next/navigation';
import { ApprovalDecisionCenter } from '@/components/shared/approvals/approval-decision-center';
import { RelationshipPanel, type DocumentNode } from '@/components/shared/document-relations/relationship-panel';
import { StatusConfig } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'รายละเอียดการอนุมัติ | ERP System' };

const APPROVAL_STATUS_CONFIG: Record<string, StatusConfig> = {
    PENDING: { label: 'รออนุมัติ', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
    APPROVED: { label: 'อนุมัติแล้ว', variant: 'default', className: 'bg-green-600' },
    REJECTED: { label: 'ปฏิเสธ', variant: 'destructive' },
    CANCELLED: { label: 'ยกเลิก', variant: 'secondary' },
};

function getDocumentLink(documentType: string, documentId: string) {
    const map: Record<string, string> = {
        SALE: `/sales/${documentId}`,
        PURCHASE: `/purchases/${documentId}`,
        ORDER_REQUEST: `/order-requests/${documentId}`,
    };
    return map[documentType] ?? '#';
}

function getDocumentLabel(documentType: string) {
    const map: Record<string, string> = {
        SALE: 'ใบขาย',
        PURCHASE: 'ใบสั่งซื้อ',
        ORDER_REQUEST: 'คำขอซื้อ',
    };
    return map[documentType] ?? documentType;
}

export default async function ApprovalDetailPage({ params }: { params: { id: string } }) {
    const ctx = await requirePermission('APPROVAL_VIEW' as any);

    // Get approval instance
    const result = await ApprovalService.list(ctx, { page: 1, limit: 100 });
    const instance = result.data.find((a: any) => a.id === params.id);

    if (!instance) return notFound();

    // --- IMPACT ANALYSIS (Provisional Rule 6 Impact Engine) ---
    // In a real ERP, this would call a dedicated service to calculate delta
    const impact = {
        message: `การอนุมัติเอกสาร ${instance.documentType} นี้จะส่งผลต่อสถานะของเอกสารและคลังสินค้าที่เกี่ยวข้อง`,
        details: [
            { label: 'สถานะเอกสาร', value: 'จะเปลี่ยนเป็น APPROVED', variant: 'default' },
            { label: 'Stock Reservation', value: 'จะทำการตัดสต็อก (หากเป็น Sale)', variant: 'outline' },
        ]
    };

    // --- RELATIONSHIP CHAIN (Provisional Rule 7 Linkage) ---
    // Mapping the source and downstream documents
    const nodes: DocumentNode[] = [
        { id: 'QT-2024-001', type: 'QUOTE', label: 'ใบเสนอราคา #001', status: 'CONVERTED', date: new Date() },
        { id: instance.documentId, type: instance.documentType, label: `${instance.documentType} #${instance.documentId.slice(-4)}`, status: instance.status, date: instance.createdAt, isCurrent: true },
        { id: 'INV-2024-999', type: 'INVOICE', label: 'รอดำเนินการ...', status: 'DRAFT', date: new Date() },
    ];

    return (
        <div className="p-6 space-y-6">
            <BackPageHeader
                backHref="/approvals"
                title="Decision Center"
                description={`จัดการการอนุมัติ: ${instance.documentType} - # ${instance.documentId}`}
            />

            <RelationshipPanel nodes={nodes} />

            <ApprovalDecisionCenter
                instance={instance as any}
                impact={impact}
            />
        </div>
    );
}
