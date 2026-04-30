import { Prisma } from '@prisma/client';
import { RequestContext } from '@/types/domain';
import { PostingService } from '@/services/accounting/posting-engine.service';
import { TaxSettingsService } from '@/services/tax/tax-settings.service';
import { JournalService } from '@/services/accounting/journal.service';
import { buildLockData } from '@/lib/lock-helpers';

export const InvoiceAccountingCoordinator = {
  async lockSaleForBilling(tx: Prisma.TransactionClient, saleId: string, invoiceNo: string) {
    await tx.sale.update({
      where: { id: saleId },
      data: {
        billingStatus: 'BILLED',
        ...buildLockData('BILLED', `เอกสารถูกล็อกเนื่องจากมีการออกใบแจ้งหนี้เลขที่ ${invoiceNo} แล้ว`),
      },
    });
  },

  async unlockSaleFromBilling(tx: Prisma.TransactionClient, saleId: string) {
    await tx.sale.update({
      where: { id: saleId },
      data: {
        billingStatus: 'UNBILLED',
        ...buildLockData('NONE', null),
      },
    });
  },

  async postInvoiceAndTax(ctx: RequestContext, invoice: any, tx: Prisma.TransactionClient) {
    const now = new Date();
    const invoiceDate = invoice.date ? new Date(invoice.date) : now;

    // 1. Post to Accounting Ledger
    await PostingService.postInvoice(ctx, invoice, tx);

    // 2. Create SalesTaxEntry for tax report
    if (invoice.taxAmount > 0 || invoice.taxableBaseAmount > 0) {
      await TaxSettingsService.postSalesTaxEntry({
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        docDate: invoiceDate,
        partnerId: invoice.customerId || undefined,
        partnerName: invoice.customerNameSnapshot,
        taxCode: invoice.taxCodeSnapshot || undefined,
        taxRate: Number(invoice.taxRateSnapshot),
        taxableBaseAmount: Number(invoice.taxableBaseAmount),
        taxAmount: Number(invoice.taxAmount),
        postedBy: ctx.memberId || 'system',
      }, ctx, tx);
    }
  },

  async voidInvoiceAndTax(ctx: RequestContext, invoiceId: string, invoiceTaxPostingStatus: string, tx: Prisma.TransactionClient) {
    if (invoiceTaxPostingStatus === 'POSTED') {
      await TaxSettingsService.voidTaxEntries('INVOICE', invoiceId, ctx, tx);
    }

    const journal = await (tx as any).journalEntry.findFirst({
      where: {
        shopId: ctx.shopId,
        sourceType: 'SALE_INVOICE',
        sourceId: invoiceId,
        postingPurpose: 'INVOICE_POST',
        status: 'POSTED'
      }
    });

    if (journal) {
      await JournalService.reverseEntry(ctx, journal.id, tx);
    }
  }
};
