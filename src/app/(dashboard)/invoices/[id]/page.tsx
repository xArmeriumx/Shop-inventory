import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { InvoiceService } from '@/services/sales/invoice.service';
import { SettingsService } from '@/services/core/system/settings.service';
import { notFound } from 'next/navigation';
import { InvoiceDetailView } from '@/components/sales/invoices/invoice-detail-view';
import { getPaymentHistoryAction } from '@/actions/accounting/payments.actions';
import { getInvoicePostingPreviewAction, getJournalEntryBySourceAction } from '@/actions/accounting/journal.actions';

export const metadata: Metadata = { title: 'รายละเอียดใบแจ้งหนี้ | ERP System' };

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
    const ctx = await requirePermission('SALE_VIEW' as any);

    const [invoice, shop] = await Promise.all([
        InvoiceService.getById(ctx, params.id).catch(() => null),
        SettingsService.getShop(ctx),
    ]);

    if (!invoice) {
        return notFound();
    }

    const [paymentsRes, previewRes] = await Promise.all([
        getPaymentHistoryAction({ invoiceId: params.id }),
        getInvoicePostingPreviewAction(params.id),
    ]);

    const payments = paymentsRes.success ? paymentsRes.data : [];
    const postingPreview = previewRes.success ? previewRes.data : null;

    let journalEntry = null;
    if (invoice.status === 'POSTED' || invoice.status === 'PAID') {
        const journalRes = await getJournalEntryBySourceAction('SALE_INVOICE', params.id);
        if (journalRes.success) journalEntry = journalRes.data;
    }

    return (
        <InvoiceDetailView
            invoice={invoice}
            shop={shop}
            payments={payments}
            postingPreview={postingPreview}
            journalEntry={journalEntry}
        />
    );
}
