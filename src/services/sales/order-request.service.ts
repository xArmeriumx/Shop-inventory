import { db } from '@/lib/db';
import { SequenceService } from '@/services/core/system/sequence.service';
import {
    DocumentType,
    OrderRequestStatus,
    ServiceError,
    type RequestContext,
    type CreateOrderRequestInput,
    type GetOrderRequestsParams
} from '@/types/domain';
import { Prisma } from '@prisma/client';

/**
 * OrderRequestService — ระบบคำขอซื้อภายใน (Internal Purchase Request Management)
 */
export const OrderRequestService = {
    /**
     * List — คัดกรองและแบ่งหน้า
     */
    async list(ctx: RequestContext, params: GetOrderRequestsParams) {
        const { page = 1, limit = 10, search, status, requesterId } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.OrderRequestWhereInput = {
            shopId: ctx.shopId,
            status,
            requesterId,
            OR: search ? [
                { requestNo: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
            ] : undefined,
        };

        const [data, total] = await Promise.all([
            db.orderRequest.findMany({
                where,
                include: { requester: { include: { user: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            db.orderRequest.count({ where }),
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
     * GetById — ดึงข้อมูลรายใบ
     */
    async getById(ctx: RequestContext, id: string) {
        const request = await db.orderRequest.findUnique({
            where: { id },
            include: {
                requester: { include: { user: true } },
                items: {
                    include: { product: true },
                    orderBy: { sortOrder: 'asc' }
                }
            },
        });

        if (!request || request.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบข้อมูลคำขอซื้อ');
        }

        return request;
    },

    /**
     * Create — สร้างคำขอซื้อใหม่
     */
    async create(ctx: RequestContext, input: CreateOrderRequestInput) {
        return await db.$transaction(async (tx) => {
            // 1. Generate Sequence Number
            const requestNo = await SequenceService.generate(ctx, DocumentType.ORDER_REQUEST, tx);

            // 2. Create Order Request
            return await tx.orderRequest.create({
                data: {
                    shopId: ctx.shopId,
                    requestNo,
                    requesterId: input.requesterId || ctx.memberId || '',
                    date: new Date(),
                    notes: input.notes,
                    items: {
                        create: input.items.map((item, index) => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            uom: item.uom,
                            sortOrder: index,
                        })),
                    },
                },
                include: { items: true },
            });
        });
    },

    /**
     * Submit — ส่งขออนุมัติ
     */
    async submit(ctx: RequestContext, id: string) {
        const request = await db.orderRequest.findUnique({
            where: { id },
        });

        if (!request || request.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบข้อมูลคำขอซื้อ');
        }

        if (request.status !== OrderRequestStatus.DRAFT) {
            throw new ServiceError('คำขอซื้อนี้อยู่ในช่วงดำเนินการแล้ว');
        }

        return await db.orderRequest.update({
            where: { id },
            data: { status: OrderRequestStatus.SUBMITTED },
        });
    },

    /**
     * Sync Status — อัปเดตสถานะตามเอกสาร PR/PO ที่เกี่ยวข้อง
     */
    async syncStatus(ctx: RequestContext, id: string, status: OrderRequestStatus) {
        return await db.orderRequest.update({
            where: { id },
            data: { status },
        });
    },
};
