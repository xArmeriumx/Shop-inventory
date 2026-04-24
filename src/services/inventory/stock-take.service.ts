import { db, runInTransaction } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { StockTakeStatus, Prisma } from '@prisma/client';
import { StockService } from '@/services/inventory/stock.service';
import { AuditService } from '@/services/core/system/audit.service';

export const StockTakeService = {
    /**
     * สร้าง Session การตรวจนับใหม่และ Snapshot สต็อกปัจจุบัน
     */
    async createSession(productIds: string[], notes: string | undefined, ctx: RequestContext) {
        return runInTransaction(undefined, async (prisma) => {
            // 1. ดึงข้อมูลสินค้าที่ต้องการตรวจนับ
            const products = await prisma.product.findMany({
                where: { id: { in: productIds }, shopId: ctx.shopId },
                select: { id: true, stock: true }
            });

            if (products.length === 0) throw new ServiceError('ไม่พบสินค้าที่เลือก');

            // 2. สร้าง Session
            const session = await (prisma as any).stockTakeSession.create({
                data: {
                    shopId: ctx.shopId,
                    createdByMemberId: ctx.memberId!,
                    notes,
                    status: 'DRAFT',
                    items: {
                        create: products.map(p => ({
                            productId: p.id,
                            systemOnHandQty: p.stock,
                            differenceQty: 0, // Initial diff is 0 since no count yet
                            isCounted: false
                        }))
                    }
                },
                include: { items: true }
            });

            return session;
        });
    },

    /**
     * อัปเดตปริมาณที่นับได้จริง
     */
    async updateActualCount(sessionId: string, productId: string, countedQty: number, note: string | undefined, ctx: RequestContext) {
        if (countedQty < 0) throw new ServiceError('จำนวนที่นับได้ห้ามติดลบ');

        return runInTransaction(undefined, async (prisma) => {
            const session = await (prisma as any).stockTakeSession.findUnique({
                where: { id: sessionId },
                select: { status: true, shopId: true }
            });

            if (!session || session.shopId !== ctx.shopId) throw new ServiceError('ไม่พบรายการตรวจนับ');
            if (session.status !== 'DRAFT') throw new ServiceError('สามารถแก้ไขจำนวนได้ในสถานะ DRAFT เท่านั้น');

            const item = await (prisma as any).stockTakeItem.findFirst({
                where: { sessionId, productId }
            });

            if (!item) throw new ServiceError('ไม่พบสินค้าในรายการตรวจนับนี้');

            const differenceQty = countedQty - item.systemOnHandQty;

            return (prisma as any).stockTakeItem.update({
                where: { id: item.id },
                data: {
                    countedQty,
                    differenceQty,
                    isCounted: true,
                    countedAt: new Date(),
                    note
                }
            });
        });
    },

    /**
     * ส่งตรวจ (SUBMIT) — ล็อกการแก้ไข
     */
    async submitSession(sessionId: string, ctx: RequestContext) {
        return runInTransaction(undefined, async (prisma) => {
            const session = await (prisma as any).stockTakeSession.findUnique({
                where: { id: sessionId },
                select: { status: true, shopId: true }
            });

            if (!session || session.shopId !== ctx.shopId) throw new ServiceError('ไม่พบรายการตรวจนับ');
            if (session.status !== 'DRAFT') throw new ServiceError('Session ไม่อยู่ในสถานะที่ส่งตรวจได้');

            return (prisma as any).stockTakeSession.update({
                where: { id: sessionId },
                data: {
                    status: 'SUBMITTED',
                    submittedByMemberId: ctx.memberId,
                    submittedAt: new Date()
                }
            });
        });
    },

    /**
     * อนุมัติและปรับปรุงสต็อก (COMPLETE)
     * - ใช้ Freeze-session policy: ปรับตามผลต่างที่คำนวณจาก snapshot ตอนเปิด session
     */
    async completeSession(sessionId: string, ctx: RequestContext) {
        return runInTransaction(undefined, async (prisma) => {
            const session = await (prisma as any).stockTakeSession.findUnique({
                where: { id: sessionId },
                include: { items: true }
            });

            if (!session || session.shopId !== ctx.shopId) throw new ServiceError('ไม่พบรายการตรวจนับ');
            if (session.status !== 'SUBMITTED') throw new ServiceError('ต้องส่งตรวจ (SUBMITTED) ก่อนจึงจะอนุมัติได้');

            // 1. วนลูปปรับปรุงสต็อกสำหรับสินค้าที่มีผลต่าง
            for (const item of (session as any).items) {
                if (!item.isCounted || item.differenceQty === 0) continue;

                // บันทึกการปรับปรุงผ่าน StockService (ให้ DB จัดการลด/เพิ่ม stock อะตอมมิก)
                // Reason: STOCK_TAKE_RECONCILIATION
                await StockService.recordMovement(ctx, {
                    productId: item.productId,
                    type: 'STOCK_TAKE_RECONCILIATION' as any, // Cast to any because of enum refresh
                    quantity: item.differenceQty,
                    note: `Auto-adjusted from Stock Take session: ${session.id}`,
                    stockTakeSessionId: session.id,
                    stockTakeItemId: item.id,
                    tx: prisma
                });
            }

            // 2. ปิด Session
            return (prisma as any).stockTakeSession.update({
                where: { id: sessionId },
                data: {
                    status: 'COMPLETED',
                    completedByMemberId: ctx.memberId,
                    completedAt: new Date()
                }
            });
        });
    },

    /**
     * ยกเลิก Session
     */
    async cancelSession(sessionId: string, reason: string, ctx: RequestContext) {
        return (db as any).stockTakeSession.update({
            where: { id: sessionId, shopId: ctx.shopId },
            data: {
                status: 'CANCELLED',
                cancelledByMemberId: ctx.memberId,
                cancelledAt: new Date(),
                cancelReason: reason
            }
        });
    },

    /**
     * ดึงข้อมูล Session พร้อมรายการ
     */
    async getSessionDetails(sessionId: string, ctx: RequestContext) {
        return (db as any).stockTakeSession.findUnique({
            where: { id: sessionId, shopId: ctx.shopId },
            include: {
                items: {
                    include: { product: true }
                },
                creator: {
                    include: { user: { select: { name: true } } }
                },
                submitter: {
                    include: { user: { select: { name: true } } }
                },
                completer: {
                    include: { user: { select: { name: true } } }
                },
                canceller: {
                    include: { user: { select: { name: true } } }
                }
            }
        });
    }
};
