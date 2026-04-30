import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { DB_TIMEOUTS } from '@/lib/constants';
import { Security } from '@/services/core/iam/security.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { DocumentType, ServiceError, RequestContext, MutationResult } from '@/types/domain';
import { Permission } from '@prisma/client';
import { TaxResolutionService } from '@/services/tax/tax-resolution.service';
import { TaxCalculationService } from '@/services/tax/tax-calculation.service';
import { INVOICE_TAGS, SALES_TAGS } from '@/config/cache-tags';

import { InvoiceRepository } from './repository';
import { InvoiceSnapshotBuilder } from './snapshot.builder';
import { InvoiceAccountingCoordinator } from './coordinator';

export const InvoiceCreateUseCase = {
  async createFromSale(ctx: RequestContext, saleId: string, tx?: Prisma.TransactionClient): Promise<MutationResult<any>> {
    Security.require(ctx, 'INVOICE_CREATE' as Permission);

    if (!ctx.memberId) {
      throw new ServiceError('ไม่สามารถสร้างใบแจ้งหนี้ได้เนื่องจากไม่พบรหัสสมาชิก (memberId)');
    }

    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Validate Sale State & Existing Invoice
      const sale = await InvoiceRepository.findSaleForInvoice(tx, saleId, ctx.shopId);

      // 2. Generate Document Number
      const invoiceNo = await SequenceService.generate(ctx, DocumentType.SALE_INVOICE, tx);

      // 3. Resolve Tax per Line — TaxResolutionService
      const billDiscount = Number(sale.discountAmount || 0);
      const linesToProcess = sale.items;

      const taxResolutions = await Promise.all(
        linesToProcess.map((item: any) =>
          TaxResolutionService.resolve({
            shopId: ctx.shopId,
            direction: 'OUTPUT',
            productId: item.productId,
            customerId: sale.customerId ?? undefined,
          }, tx)
        )
      );

      // 4. Calculate each line — TaxCalculationService
      const lineRawCalcs = linesToProcess.map((item: any, i: number) => {
        const resolution = taxResolutions[i];
        const qty = Number(item.quantity);
        const unitPrice = Number(item.salePrice);
        const lineDiscount = Number(item.discountAmount || 0) * qty;

        return {
          item,
          resolution,
          calc: TaxCalculationService.calculateLine({
            qty,
            unitPrice,
            lineDiscount,
            taxRate: resolution.rate,
            calculationMode: resolution.calculationMode as any,
            taxKind: resolution.kind as any,
          }),
        };
      });

      // Bill-level discount allocation
      const billDiscountAllocations = TaxCalculationService.allocateBillDiscount(
        lineRawCalcs.map(({ calc }) => ({ lineSubtotal: calc.lineSubtotal })),
        billDiscount
      );

      // Re-calculate with bill discount allocated
      const lineCalcs = lineRawCalcs.map(({ item, resolution, calc }, i) => {
        const withBill = TaxCalculationService.calculateLine({
          qty: Number(item.quantity),
          unitPrice: Number(item.salePrice),
          lineDiscount: Number(item.discountAmount || 0) * Number(item.quantity),
          billDiscountAllocation: billDiscountAllocations[i],
          taxRate: resolution.rate,
          calculationMode: resolution.calculationMode as any,
          taxKind: resolution.kind as any,
        });
        return { item, resolution, calc: withBill };
      });

      const header = TaxCalculationService.aggregateHeader(
        lineCalcs.map(({ calc }) => calc)
      );

      // 5. Detect primary tax code for header snapshot
      const primaryResolution = taxResolutions.find(r => r.resolvedFrom !== 'NONE') ?? taxResolutions[0];

      // 6. Build Snapshots (pure transformation via Builder)
      const snapshots = await InvoiceSnapshotBuilder.build(tx, ctx.shopId, sale);

      // 7. Build InvoiceLine data
      const invoiceLinesData = lineCalcs.map(({ item, resolution, calc }, i) => ({
        productId: item.productId,
        skuSnapshot: item.product?.sku || null,
        productNameSnapshot: item.product?.name || 'สินค้าลบแล้ว',
        descriptionSnapshot: item.description || null,
        uomSnapshot: null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.salePrice),
        lineSubtotalAmount: calc.lineSubtotal,
        discountAmount: calc.discountAmount,
        taxableBaseAmount: calc.taxableBase,
        taxCodeSnapshot: resolution.code,
        taxRateSnapshot: resolution.rate,
        taxAmount: calc.taxAmount,
        lineNetAmount: calc.lineNet,
        subtotal: calc.lineNet, // Legacy alias
        sortOrder: i,
      }));

      // 8. Create Invoice + Lines
      const invoice = await InvoiceRepository.createWithLines(tx, {
        shopId: ctx.shopId,
        invoiceNo,
        saleId: sale.id,
        customerId: sale.customerId ?? undefined,
        memberId: ctx.memberId as string,
        status: 'DRAFT',
        date: new Date(),

        ...snapshots,

        // TAX Snapshots
        taxCodeSnapshot: primaryResolution?.code || null,
        taxRateSnapshot: primaryResolution?.rate ?? 0,
        taxCalculationModeSnapshot: primaryResolution?.calculationMode || 'EXCLUSIVE',

        currencyCode: 'THB',

        // Financials (from Tax Engine)
        subtotalAmount: header.subtotalAmount,
        discountAmount: header.discountAmount,
        taxableBaseAmount: header.taxableBaseAmount,
        taxAmount: header.taxAmount,
        netAmount: header.netAmount,
        totalAmount: header.netAmount, // Legacy alias
        residualAmount: header.netAmount,
        paymentStatus: 'UNPAID',

        // Tax Posting
        taxPostingStatus: 'DRAFT',

        items: {
          create: invoiceLinesData,
        },
      });

      // 9. Lock Sale via Coordinator
      await InvoiceAccountingCoordinator.lockSaleForBilling(tx, saleId, invoiceNo);

      return invoice;
    };

    const result = tx ? await execute(tx) : await db.$transaction(async (tx) => await execute(tx), { timeout: DB_TIMEOUTS.EXTENDED });

    return {
      data: result,
      affectedTags: [INVOICE_TAGS.LIST, INVOICE_TAGS.STATS, SALES_TAGS.DETAIL(saleId), SALES_TAGS.LIST]
    };
  }
};
