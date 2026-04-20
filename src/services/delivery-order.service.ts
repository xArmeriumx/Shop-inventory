import { db } from '@/lib/db';
import { SequenceService } from './sequence.service';
import {
    DocumentType,
    DeliveryStatus,
    ServiceError,
    type RequestContext,
    type CreateDeliveryOrderInput,
    type GetDeliveryOrdersParams
} from '@/types/domain';
import { Prisma } from '@prisma/client';

/**
 * DeliveryOrderService — ระบบใบส่งสินค้าและโลจิสติกส์ (Delivery & Logistics Management)
 */
export const DeliveryOrderService = {
    /**
     * List — รายการใบส่งของ
     */
    async list(ctx: RequestContext, params: GetDeliveryOrdersParams) {
        const { page = 1, limit = 10, search, status, saleId } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.DeliveryOrderWhereInput = {
            shopId: ctx.shopId,
            status,
            saleId,
            OR: search ? [
                { deliveryNo: { contains: search, mode: 'insensitive' } }
            ] : undefined,
        };

        const [data, total] = await Promise.all([
            db.deliveryOrder.findMany({
                where,
                include: { sale: { include: { customer: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            db.deliveryOrder.count({ where }),
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },

    /**
     * GetById — รายละเอียดใบส่งของรายใบ
     */
    async getById(ctx: RequestContext, id: string) {
        const delivery = await db.deliveryOrder.findUnique({
            where: { id },
            include: {
                sale: { include: { customer: true, items: true } },
                items: { include: { product: true } },
                user: { select: { name: true } },
            },
        });

        if (!delivery || delivery.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบใบส่งของ');
        }

        return delivery;
    },

    /**
     * Create — สร้างใบส่งของจากรายการขาย (SO)
     */
    async create(ctx: RequestContext, input: CreateDeliveryOrderInput) {
        return await db.$transaction(async (tx) => {
            // 1. Validate Sale exists and belongs to shop
            const sale = await tx.sale.findUnique({
                where: { id: input.saleId },
                include: { items: true }
            });

            if (!sale || sale.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบรายการขาย');
            }

            // 2. Generate Number
            const deliveryNo = await SequenceService.generate(ctx, DocumentType.DELIVERY_ORDER, tx);

            // 3. Create Delivery Order
            return await tx.deliveryOrder.create({
                data: {
                    shopId: ctx.shopId,
                    userId: ctx.userId,
                    deliveryNo,
                    saleId: input.saleId,
                    status: DeliveryStatus.WAITING,
                    scheduledDate: input.scheduledDate,
                    notes: input.notes,
                    items: {
                        create: input.items.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            pickedQty: 0,
                        })),
                    },
                },
                include: { items: true },
            });
        });
    },

    /**
     * Validate — ยืนยันการส่งของ (ตัดสต็อกจริง)
     */
    async validate(ctx: RequestContext, id: string) {
        return await db.$transaction(async (tx) => {
            const delivery = await tx.deliveryOrder.findUnique({
                where: { id },
                include: { items: true, sale: true },
            });

            if (!delivery || delivery.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบใบส่งของ');
            }

            if (delivery.status !== DeliveryStatus.WAITING && delivery.status !== DeliveryStatus.PROCESSING) {
                throw new ServiceError('ใบส่งของนี้ได้รับการดำเนินการไปแล้ว');
            }

            // 1. Update Delivery Status
            await tx.deliveryOrder.update({
                where: { id },
                data: {
                    status: DeliveryStatus.DELIVERED,
                    deliveredAt: new Date(),
                },
            });

            // 2. Sync Status กลับไปยัง Sale
            await tx.sale.update({
                where: { id: delivery.saleId },
                data: {
                    deliveryStatus: 'DELIVERED',
                    bookingStatus: 'DEDUCTED' // ตัดสต็อกจริงแล้ว
                },
            });

            // TODO: บันทึก Stock Movmement จริงผ่าน StockService

            return true;
        });
    },
};
