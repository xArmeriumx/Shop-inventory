import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { InvoiceService } from '@/services/invoice.service';
import { SettingsService } from '@/services/settings.service';
import { notFound } from 'next/navigation';
import { InvoiceDetailView } from '@/components/invoices/invoice-detail-view';
import { getPaymentHistoryAction } from '@/actions/payments';

export const metadata: Metadata = { title: 'รายละเอียดใบแจ้งหนี้ | ERP System' };

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
    const ctx = await requirePermission('SALE_VIEW' as any); // Use SALE_VIEW for invoices too

    const [invoice, shop] = await Promise.all([
        InvoiceService.getById(ctx, params.id).catch(() => null),
        SettingsService.getShop(ctx),
    ]);

    if (!invoice) {
        return notFound();
    }

    const paymentsRes = await getPaymentHistoryAction({ invoiceId: params.id });
    const payments = paymentsRes.success ? paymentsRes.data : [];

    return (
        <InvoiceDetailView
            invoice={invoice}
            shop={shop}
            payments={payments}
        />
    );
}
