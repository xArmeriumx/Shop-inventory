import { db } from '@/lib/db';
import { Prisma, Permission } from '@prisma/client';
import { DB_TIMEOUTS } from '@/lib/constants';
import { Security } from '@/services/core/iam/security.service';
import { WorkflowService } from '@/services/core/workflow/workflow.service';
import { ServiceError, RequestContext, MutationResult } from '@/types/domain';
import { INVOICE_TAGS, ACCOUNTING_TAGS } from '@/config/cache-tags';
import { InvoiceAccountingCoordinator } from './coordinator';

export const InvoicePostUseCase = {
  async post(ctx: RequestContext, id: string, tx?: Prisma.TransactionClient): Promise<MutationResult<any>> {
    Security.require(ctx, 'INVOICE_POST' as Permission);

    const execute = async (tx: Prisma.TransactionClient) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { items: true }
      });

      if (!invoice || invoice.shopId !== ctx.shopId) {
        throw new ServiceError('ไม่พบใบแจ้งหนี้');
      }

      WorkflowService.canInvoiceAction(invoice as any, 'POST');

      const now = new Date();
      const invoiceDate = invoice.date ? new Date(invoice.date) : now;

      // Coordinate accounting & tax posting
      await InvoiceAccountingCoordinator.postInvoiceAndTax(ctx, invoice, tx);

      // Update Invoice status
      return await tx.invoice.update({
        where: { id },
        data: {
          status: 'POSTED',
          taxPostingStatus: 'POSTED',
          taxReportMonth: invoiceDate.getMonth() + 1,
          taxReportYear: invoiceDate.getFullYear(),
          postedAt: now,
        },
      });
    };

    const result = tx ? await execute(tx) : await db.$transaction(async (tx) => await execute(tx), { timeout: DB_TIMEOUTS.EXTENDED });

    return {
      data: result,
      affectedTags: [INVOICE_TAGS.LIST, INVOICE_TAGS.DETAIL(id), INVOICE_TAGS.STATS, ACCOUNTING_TAGS.JOURNAL]
    };
  },

  async tryPost(ctx: RequestContext, id: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    try {
      await InvoicePostUseCase.post(ctx, id, tx);
      return true;
    } catch (error) {
      const e = error as Error;
      console.warn(`[InvoiceService.tryPost] Posting skipped for invoice ${id}:`, e?.message);
      return false;
    }
  },

  async bulkPost(ctx: RequestContext): Promise<MutationResult<{ success: number; failed: number; errors: string[] }>> {
    Security.require(ctx, 'INVOICE_POST' as Permission);

    const pendingInvoices = await db.invoice.findMany({
      where: {
        shopId: ctx.shopId,
        status: 'PAID',
        taxPostingStatus: 'DRAFT',
      },
      select: { id: true, invoiceNo: true },
      take: 100,
    });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const invoice of pendingInvoices) {
      try {
        await InvoicePostUseCase.post(ctx, invoice.id);
        success++;
      } catch (error) {
        const e = error as Error;
        failed++;
        errors.push(`${invoice.invoiceNo}: ${e.message}`);
      }
    }

    return {
      data: { success, failed, errors },
      affectedTags: [INVOICE_TAGS.LIST, INVOICE_TAGS.STATS, ACCOUNTING_TAGS.JOURNAL]
    };
  }
};
