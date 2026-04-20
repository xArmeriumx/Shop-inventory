import { db } from '@/lib/db';
import {
    ApprovalStatus,
    ServiceError,
    type RequestContext,
    type SubmitApprovalInput,
    type ApprovalActionInput
} from '@/types/domain';
import { Prisma } from '@prisma/client';

/**
 * ApprovalService — ระบบอนุมัติเอกสารกลาง (Document Approval System)
 * รองรับการอนุมัติหลายระดับ (Multi-level) และบันทึกประวัติการตัดสินใจ
 */
export const ApprovalService = {
    /**
     * Submit — ส่งเอกสารขออนุมัติ
     */
    async submit(ctx: RequestContext, input: SubmitApprovalInput, tx?: Prisma.TransactionClient) {
        const client = tx || db;

        // 1. ตรวจสอบว่ามี Approval Instance อยู่แล้วหรือไม่ (ห้ามส่งซ้ำถ้ายังไม่อนนุมัติ/reject)
        const existing = await client.approvalInstance.findFirst({
            where: {
                shopId: ctx.shopId,
                documentType: input.documentType,
                documentId: input.documentId,
                status: ApprovalStatus.PENDING,
            },
        });

        if (existing) {
            throw new ServiceError('เอกสารนี้อยู่ระหว่างการขออนุมัติแล้ว');
        }

        // 2. สร้าง Approval Instance และ Steps ในคราวเดียว
        return await client.approvalInstance.create({
            data: {
                shopId: ctx.shopId,
                documentType: input.documentType,
                documentId: input.documentId,
                status: ApprovalStatus.PENDING,
                currentLevel: 1,
                steps: {
                    create: input.approverUserIds.map((userId, index) => ({
                        level: index + 1,
                        approverUserId: userId,
                        status: ApprovalStatus.PENDING,
                    })),
                },
                // Link to specific models based on type for relational integrity
                saleId: input.documentType === 'SALE' ? input.documentId : undefined,
                purchaseId: input.documentType === 'PURCHASE' ? input.documentId : undefined,
                orderRequestId: input.documentType === 'ORDER_REQUEST' ? input.documentId : undefined,
            },
            include: {
                steps: true,
            },
        });
    },

    /**
     * Action — อนุมัติหรือปฏิเสธเอกสาร
     */
    async action(ctx: RequestContext, input: ApprovalActionInput) {
        return await db.$transaction(async (tx) => {
            // 1. ดึงข้อมูล Approval และ Step ปัจจุบัน
            const instance = input.approvalInstanceId
                ? await tx.approvalInstance.findUnique({
                    where: { id: input.approvalInstanceId },
                    include: { steps: { orderBy: { level: 'asc' } } },
                })
                : await tx.approvalInstance.findFirst({
                    where: {
                        shopId: ctx.shopId,
                        documentType: input.documentType,
                        documentId: input.documentId,
                        status: ApprovalStatus.PENDING
                    },
                    include: { steps: { orderBy: { level: 'asc' } } },
                });

            if (!instance || instance.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบข้อมูลการอนุมัติ');
            }

            if (instance.status !== ApprovalStatus.PENDING) {
                throw new ServiceError('การอนุมัตินี้สิ้นสุดไปแล้ว');
            }

            const currentStep = instance.steps.find(s => s.level === instance.currentLevel);
            if (!currentStep || currentStep.approverUserId !== ctx.userId) {
                throw new ServiceError('คุณไม่มีสิทธิ์ในการดำเนินการขั้นตอนนี้');
            }

            // 2. อัปเดต Step
            await tx.approvalStep.update({
                where: { id: currentStep.id },
                data: {
                    status: input.action === 'APPROVE' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
                    actionAt: new Date(),
                    reason: input.reason,
                },
            });

            // 3. ปรับปรุง Instance Status
            if (input.action === 'REJECT') {
                // ถ้า Reject คือจบเลย
                await tx.approvalInstance.update({
                    where: { id: instance.id },
                    data: { status: ApprovalStatus.REJECTED },
                });

                // TODO: Sync status กลับไปยัง document ต้นทางถ้าจำเป็น
                return ApprovalStatus.REJECTED;
            } else {
                // ถ้า Approve ตรวจสอบว่ามีระดับถัดไปไหม
                const nextStep = instance.steps.find(s => s.level === instance.currentLevel + 1);

                if (nextStep) {
                    await tx.approvalInstance.update({
                        where: { id: instance.id },
                        data: { currentLevel: instance.currentLevel + 1 },
                    });
                    return ApprovalStatus.PENDING; // ยังเหลือขั้นถัดไป
                } else {
                    // อนุมัติครบทุกขั้นแล้ว
                    await tx.approvalInstance.update({
                        where: { id: instance.id },
                        data: { status: ApprovalStatus.APPROVED },
                    });

                    // TODO: Trigger business logic เมื่ออนุมัติครบ (เช่น PO เปลี่ยน status เป็น ORDERED)
                    return ApprovalStatus.APPROVED;
                }
            }
        });
    },

    /**
     * GetStatus — ตรวจสอบสถานะปัจจุบัน
     */
    async getStatus(ctx: RequestContext, documentType: string, documentId: string) {
        return await db.approvalInstance.findFirst({
            where: {
                shopId: ctx.shopId,
                documentType,
                documentId,
            },
            include: {
                steps: {
                    orderBy: { level: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    },
    /**
     * List — สำหรับกล่องข้อความขออนุมัติ (Approval Inbox)
     */
    async list(ctx: RequestContext, params: { page?: number; limit?: number; status?: string }) {
        const { page = 1, limit = 10, status = ApprovalStatus.PENDING } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.ApprovalInstanceWhereInput = {
            shopId: ctx.shopId,
            status: status as ApprovalStatus,
            steps: {
                some: {
                    approverUserId: ctx.userId,
                    status: ApprovalStatus.PENDING,
                }
            }
        };

        const [data, total] = await Promise.all([
            db.approvalInstance.findMany({
                where,
                include: {
                    steps: { orderBy: { level: 'asc' } },
                    sale: true,
                    purchase: true,
                    orderRequest: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            db.approvalInstance.count({ where }),
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
};
