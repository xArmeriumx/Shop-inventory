import { db } from '@/lib/db';
import { money } from '@/lib/money';
import { RequestContext } from '@/types/domain';

export const StatementVat = {
    async getVatReport(ctx: RequestContext, year: number, month: number) {
        const invoices = await (db as any).invoice.findMany({
            where: {
                shopId: ctx.shopId,
                status: 'POSTED',
                date: {
                    gte: new Date(year, month - 1, 1),
                    lt: new Date(year, month, 1)
                }
            }
        });

        const purchaseTaxDocs = await (db as any).purchaseTaxDocument.findMany({
            where: {
                shopId: ctx.shopId,
                status: 'POSTED',
                taxReportDate: {
                    gte: new Date(year, month - 1, 1),
                    lt: new Date(year, month, 1)
                }
            }
        });

        const outputVatTotal = invoices.reduce((sum: number, inv: any) => sum + Number(inv.vatAmount || 0), 0);
        const inputVatTotal = purchaseTaxDocs.reduce((sum: number, doc: any) => sum + Number(doc.totalVat || 0), 0);

        return {
            year,
            month,
            outputVat: {
                entries: invoices.map((inv: any) => ({
                    date: inv.date,
                    docNo: inv.invoiceNumber,
                    partnerName: inv.customerName,
                    baseAmount: inv.totalAmount,
                    vatAmount: inv.vatAmount
                })),
                total: outputVatTotal
            },
            inputVat: {
                entries: purchaseTaxDocs.map((doc: any) => ({
                    date: doc.taxInvoiceDate,
                    docNo: doc.taxInvoiceNumber,
                    partnerName: doc.supplierName,
                    baseAmount: doc.totalBase,
                    vatAmount: doc.totalVat
                })),
                total: inputVatTotal
            },
            netVat: money.subtract(outputVatTotal, inputVatTotal)
        };
    }
};
