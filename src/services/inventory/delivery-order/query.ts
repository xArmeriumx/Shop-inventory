import { db } from '@/lib/db';
import { Security } from '@/services/core/iam/security.service';
import { ServiceError, type RequestContext, type GetDeliveryOrdersParams } from '@/types/domain';
import { Permission } from '@prisma/client';

const DO_LIST_SELECT = {
    id: true,
    deliveryNo: true,
    status: true,
    scheduledDate: true,
    saleId: true,
    createdAt: true,
    updatedAt: true,
    sale: {
        select: {
            invoiceNumber: true,
            billingStatus: true,
            customer: { select: { name: true } },
        },
    },
} as const;

export const DeliveryOrderQuery = {
    async list(ctx: RequestContext, params: GetDeliveryOrdersParams) {
        Security.requirePermission(ctx, 'DELIVERY_VIEW' as Permission);

        const { page = 1, limit = 10, search, status, saleId } = params;
        const skip = (page - 1) * limit;

        const where = {
            shopId: ctx.shopId,
            ...(status && { status }),
            ...(saleId && { saleId }),
            ...(search && {
                OR: [{ deliveryNo: { contains: search, mode: 'insensitive' as const } }],
            }),
        };

        const [data, total] = await Promise.all([
            (db as any).deliveryOrder.findMany({
                where,
                select: DO_LIST_SELECT,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            (db as any).deliveryOrder.count({ where }),
        ]);

        return {
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    },

    async getById(ctx: RequestContext, id: string) {
        Security.requirePermission(ctx, 'DELIVERY_VIEW' as Permission);

        const delivery = await (db as any).deliveryOrder.findUnique({
            where: { id },
            include: {
                sale: { include: { customer: true, items: true } },
                items: { include: { product: { select: { name: true, sku: true, stock: true } } } },
                user: { select: { name: true } },
            },
        });

        if (!delivery || delivery.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบใบส่งของ');
        }

        return delivery;
    }
};
