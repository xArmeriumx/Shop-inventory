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
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';

import { ORDER_REQUEST_TAGS } from '@/config/cache-tags';
import { IOrderRequestService } from '@/types/service-contracts';
import { MutationResult, PaginatedResult } from '@/types/domain';
import { paginatedQuery } from '@/lib/pagination';

/**
 * OrderRequestService — ระบบคำขอซื้อภายใน (Internal Purchase Request Management)
 */
export const OrderRequestService: IOrderRequestService = {
    /** List — คัดกรองและแบ่งหน้า */
    async list(ctx: RequestContext, params: GetOrderRequestsParams): Promise<PaginatedResult<any>> {
        const { page = 1, limit = 10, search, status, requesterId } = params;

        const where: Prisma.OrderRequestWhereInput = {
            shopId: ctx.shopId,
            status,
            requesterId,
            OR: search ? [
                { requestNo: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
            ] : undefined,
        };

        return paginatedQuery(db.orderRequest as any, {
            where,
            include: { requester: { include: { user: true } } },
            orderBy: { createdAt: 'desc' },
            page,
            limit,
        });
    },

    /** GetById — ดึงข้อมูลรายใบ */
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

    /** Create — สร้างคำขอซื้อใหม่ */
    async create(ctx: RequestContext, input: CreateOrderRequestInput): Promise<MutationResult<any>> {
        return await AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.ORDER_REQUEST_CREATE,
            targetType: 'OrderRequest',
            note: `สร้างคำขอซื้อใหม่ ${input.items?.length || 0} รายการ`,
        }, async () => {
            const result = await db.$transaction(async (tx) => {
                const requestNo = await SequenceService.generate(ctx, DocumentType.ORDER_REQUEST, tx);

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

            return {
                data: result,
                affectedTags: [ORDER_REQUEST_TAGS.LIST]
            };
        });
    },

    /** Submit — ส่งขออนุมัติ */
    async submit(ctx: RequestContext, id: string): Promise<MutationResult<any>> {
        return await AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.ORDER_REQUEST_SUBMIT,
            targetType: 'OrderRequest',
            targetId: id,
            note: `ส่งคำขอซื้อเพื่อขออนุมัติ`,
        }, async () => {
            const result = await db.$transaction(async (tx) => {
                const request = await tx.orderRequest.findUnique({
                    where: { id },
                    include: { approvals: { where: { status: 'PENDING' } } }
                });

                if (!request || request.shopId !== ctx.shopId) {
                    throw new ServiceError('ไม่พบข้อมูลคำขอซื้อ');
                }

                const hasPendingApproval = request.approvals.length > 0;
                if (request.status !== OrderRequestStatus.DRAFT && hasPendingApproval) {
                    throw new ServiceError('คำขอซื้อนี้อยู่ระหว่างการขออนุมัติแล้ว');
                }

                const owners = await tx.shopMember.findMany({
                    where: { shopId: ctx.shopId, isOwner: true },
                    select: { userId: true }
                });

                if (owners.length === 0) {
                    throw new ServiceError('ไม่พบข้อมูลผู้อนุมัติ (เจ้าของร้าน) กรุณาตั้งค่าทีมงาน');
                }

                const { ApprovalService } = await import('@/services/core/workflow/approval.service');
                await ApprovalService.submit(ctx, {
                    documentId: id,
                    documentType: 'ORDER_REQUEST',
                    approverUserIds: owners.map(o => o.userId),
                }, tx as any);

                return await tx.orderRequest.update({
                    where: { id },
                    data: { status: OrderRequestStatus.SUBMITTED },
                });
            });

            return {
                data: result,
                affectedTags: [ORDER_REQUEST_TAGS.LIST, ORDER_REQUEST_TAGS.DETAIL(id)]
            };
        });
    },

    /** Sync Status — อัปเดตสถานะตามเอกสาร PR/PO ที่เกี่ยวข้อง */
    async syncStatus(ctx: RequestContext, id: string, status: OrderRequestStatus, tx?: Prisma.TransactionClient): Promise<MutationResult<any>> {
        const client = tx || db;
        const result = await (client as any).orderRequest.update({
            where: { id },
            data: { status },
        });

        return {
            data: result,
            affectedTags: [ORDER_REQUEST_TAGS.LIST, ORDER_REQUEST_TAGS.DETAIL(id)]
        };
    },
};
