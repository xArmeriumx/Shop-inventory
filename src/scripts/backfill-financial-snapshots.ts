import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';

/**
 * Backfill financial snapshots for legacy Sales and Invoices.
 * This ensures the new AR/AP dashboard works with existing data.
 */
async function backfillFinancialSnapshots() {
    console.log('🔄 Starting Financial Snapshot Backfill...');

    // 1. Backfill Sales
    const sales = await db.sale.findMany();

    console.log(`- Found ${sales.length} sales to process.`);

    for (const sale of sales) {
        const totalAmount = toNumber(sale.totalAmount);
        // For legacy, assume completed sales are paid, otherwise unpaid
        const isPaid = (sale as any).status === 'COMPLETED' || (sale as any).billingStatus === 'PAID';

        await db.sale.update({
            where: { id: sale.id },
            data: {
                paidAmount: isPaid ? totalAmount : ((sale as any).paidAmount || 0),
                residualAmount: isPaid ? 0 : ((sale as any).residualAmount || totalAmount),
                paymentStatus: isPaid ? 'PAID' : ((sale as any).paymentStatus || 'UNPAID'),
            } as any,
        });
    }

    // 2. Backfill Invoices
    const invoiceModel = (db as any).invoice;
    if (invoiceModel) {
        const invoices = await invoiceModel.findMany();

        console.log(`- Found ${invoices.length} invoices to process.`);

        for (const invoice of invoices) {
            const totalAmount = toNumber(invoice.totalAmount);
            const isPaid = invoice.status === 'PAID';

            await invoiceModel.update({
                where: { id: invoice.id },
                data: {
                    paidAmount: isPaid ? totalAmount : ((invoice as any).paidAmount || 0),
                    residualAmount: isPaid ? 0 : ((invoice as any).residualAmount || totalAmount),
                    paymentStatus: isPaid ? 'PAID' : ((invoice as any).paymentStatus || 'UNPAID'),
                },
            });
        }
    }

    console.log('✅ Backfill Completed.');
}

backfillFinancialSnapshots()
    .catch((e) => {
        console.error('❌ Backfill Failed:', e);
        process.exit(1);
    })
    .finally(() => process.exit(0));
