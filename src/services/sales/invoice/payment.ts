import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { ServiceError, RequestContext, MutationResult } from '@/types/domain';
import { INVOICE_TAGS } from '@/config/cache-tags';

export const InvoicePaymentUseCase = {
  async markPaid(ctx: RequestContext, id: string, tx?: Prisma.TransactionClient): Promise<MutationResult<any>> {
    const client = tx || db;
    const invoice = await (client as any).invoice.findUnique({ where: { id } });
    if (!invoice || invoice.shopId !== ctx.shopId) throw new ServiceError('ไม่พบใบแจ้งหนี้');

    if (invoice.status === 'CANCELLED') throw new ServiceError('ไม่สามารถชำระ Invoice ที่ยกเลิกแล้วได้');
    if (invoice.status === 'PAID') throw new ServiceError('Invoice นี้ชำระแล้ว');

    const result = await (client as any).invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        residualAmount: 0,
        paidAmount: Number(invoice.netAmount),
        paymentStatus: 'PAID',
      },
    });

    return {
      data: result,
      affectedTags: [INVOICE_TAGS.LIST, INVOICE_TAGS.DETAIL(id), INVOICE_TAGS.STATS]
    };
  }
};
