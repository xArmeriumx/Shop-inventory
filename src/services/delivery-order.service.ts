import { db } from '@/lib/db';
import { SequenceService } from './sequence.service';
import { StockService } from './stock.service';
import {
    DocumentType,
    DeliveryStatus,
    ServiceError,
    type RequestContext,
    type CreateDeliveryOrderInput,
    type GetDeliveryOrdersParams
} from '@/types/domain';

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
                include: { sale: { include: { customer: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            (db as any).deliveryOrder.count({ where }),
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
        const delivery = await (db as any).deliveryOrder.findUnique({
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
            const sale = await tx.sale.findUnique({
                where: { id: input.saleId },
                include: { items: true }
            });

            if (!sale || sale.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบรายการขาย');
            }

            const deliveryNo = await SequenceService.generate(ctx, DocumentType.DELIVERY_ORDER, tx);

            return await (tx as any).deliveryOrder.create({
                data: {
                    shopId: ctx.shopId,
                    deliveryNo,
                    saleId: input.saleId,
                    userId: ctx.userId,
                    memberId: ctx.memberId,
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
     * Validate — ยืนยันการส่งของ (ตัดสต็อกจริง + sync SO status)
     *
     * Flow:
     *   1. Guard: ต้องอยู่ในสถานะ WAITING หรือ PROCESSING
     *   2. ตัดสต็อกจริงผ่าน StockService.recordMovements
     *   3. อัปเดตสถานะ DeliveryOrder → DELIVERED
     *   4. Sync สถานะกลับ Sale: deliveryStatus → DELIVERED, bookingStatus → DEDUCTED
     */
    async validate(ctx: RequestContext, id: string) {
        return await db.$transaction(async (tx) => {
            const delivery = await (tx as any).deliveryOrder.findUnique({
                where: { id },
                include: { items: true, sale: true },
            });

            if (!delivery || delivery.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบใบส่งของ');
            }

            if (
                delivery.status !== DeliveryStatus.WAITING &&
                delivery.status !== DeliveryStatus.PROCESSING
            ) {
                throw new ServiceError('ใบส่งของนี้ได้รับการดำเนินการไปแล้ว');
            }

            // ── 1. Deduct stock for each item ────────────────────────────────
            await StockService.recordMovements(
                ctx,
                delivery.items.map((item: any) => ({
                    productId: item.productId,
                    type: 'SALE' as const,
                    quantity: -item.quantity, // negative = outgoing
                    userId: ctx.userId,
                    shopId: ctx.shopId,
                    saleId: delivery.saleId,
                    deliveryOrderId: delivery.id, // ★ NEW: Pass DO ID as source
                    note: `ส่งของจากใบส่งสินค้า: ${delivery.deliveryNo}`,
                    requireStock: false,
                })),
                tx
            );

            // ── 2. Update Delivery status ─────────────────────────────────────
            await (tx as any).deliveryOrder.update({
                where: { id },
                data: {
                    status: DeliveryStatus.DELIVERED,
                    deliveredAt: new Date(),
                },
            });

            // ── 3. Sync status back to Sale ───────────────────────────────────
            await tx.sale.update({
                where: { id: delivery.saleId },
                data: {
                    deliveryStatus: 'DELIVERED',
                    bookingStatus: 'DEDUCTED',
                },
            });

            return true;
        });
    },
};
