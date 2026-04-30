import { db } from '@/lib/db';
import { Security } from '@/services/core/iam/security.service';
import { Permission } from '@prisma/client';
import { RequestContext } from '@/types/domain';

export const PaymentQuery = {
    async getPaymentHistory(target: { invoiceId?: string; saleId?: string }, ctx: RequestContext) {
        Security.requireAny(ctx, [Permission.INVOICE_VIEW, Permission.FINANCE_VIEW_LEDGER]);
        const where = {
            shopId: ctx.shopId,
            ...(target.invoiceId ? { invoiceId: target.invoiceId } : { saleId: target.saleId }),
        };

        return await (db as any).payment.findMany({
            where,
            orderBy: { paymentDate: 'desc' },
            include: {
                member: true,
            },
        });
    }
};
