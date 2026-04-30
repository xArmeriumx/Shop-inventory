import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
    ServiceError,
    type RequestContext,
    type GetQuotationsParams,
    PaginatedResult,
} from '@/types/domain';
import { paginatedQuery } from '@/lib/pagination';

export const QuotationQuery = {
    async list(ctx: RequestContext, params: GetQuotationsParams): Promise<PaginatedResult<any>> {
        const { page = 1, limit = 10, search, status, customerId } = params;

        const where: Prisma.QuotationWhereInput = {
            shopId: ctx.shopId,
            status,
            customerId,
            OR: search ? [
                { quotationNo: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
            ] : undefined,
        };

        return paginatedQuery(db.quotation as any, {
            where,
            include: { customer: true, salesperson: true },
            orderBy: { createdAt: 'desc' },
            page,
            limit,
        });
    },

    async getById(ctx: RequestContext, id: string) {
        const quotation = await db.quotation.findUnique({
            where: { id },
            include: {
                customer: true,
                salesperson: { include: { user: true } },
                items: {
                    include: { product: true },
                    orderBy: { sortOrder: 'asc' }
                },
                sales: {
                    include: { invoices: true },
                    orderBy: { createdAt: 'desc' }
                }
            },
        });

        if (!quotation || quotation.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบใบเสนอราคา');
        }

        return quotation;
    }
};
