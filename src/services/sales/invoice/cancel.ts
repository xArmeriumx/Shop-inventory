import { db } from '@/lib/db';
import { Permission } from '@prisma/client';
import { Security } from '@/services/core/iam/security.service';
import { WorkflowService } from '@/services/core/workflow/workflow.service';
import { ServiceError, RequestContext, MutationResult } from '@/types/domain';
import { INVOICE_TAGS, ACCOUNTING_TAGS } from '@/config/cache-tags';
import { InvoiceAccountingCoordinator } from './coordinator';

export const InvoiceCancelUseCase = {
  async cancel(ctx: RequestContext, id: string): Promise<MutationResult<any>> {
    Security.require(ctx, 'INVOICE_CANCEL' as Permission);
    const invoice = await (db as any).invoice.findUnique({ where: { id } });
    if (!invoice || invoice.shopId !== ctx.shopId) throw new ServiceError('ไม่พบใบแจ้งหนี้');

    WorkflowService.canInvoiceAction(invoice as any, 'CANCEL');

    const result = await (db as any).$transaction(async (tx: any) => {
      // Coordinate accounting & tax voiding
      await InvoiceAccountingCoordinator.voidInvoiceAndTax(ctx, id, invoice.taxPostingStatus, tx);

      // Unlock the linked Sale
      if (invoice.saleId) {
        await InvoiceAccountingCoordinator.unlockSaleFromBilling(tx, invoice.saleId);
      }

      return (tx as any).invoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          taxPostingStatus: invoice.taxPostingStatus === 'POSTED' ? 'VOIDED' : invoice.taxPostingStatus,
        },
      });
    });

    return {
      data: result,
      affectedTags: [INVOICE_TAGS.LIST, INVOICE_TAGS.DETAIL(id), INVOICE_TAGS.STATS, ACCOUNTING_TAGS.JOURNAL]
    };
  }
};
