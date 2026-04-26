import { db, runInTransaction } from '@/lib/db';
import { RequestContext, ServiceError, MutationResult } from '@/types/domain';
import { StockTakeStatus, Prisma } from '@prisma/client';
import { StockService } from '@/services/inventory/stock.service';
import { AuditService } from '@/services/core/system/audit.service';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import { STOCK_TAKE_AUDIT_POLICIES } from '@/policies/inventory/stock-take.policy';
import { IStockTakeService } from '@/types/service-contracts';

export const StockTakeService: IStockTakeService = {
    /**
     * สร้าง Session การตรวจนับใหม่และ Snapshot สต็อกปัจจุบัน
     */
    async createSession(productIds: string[], notes: string | undefined, ctx: RequestContext): Promise<MutationResult<any>> {
        const result = await AuditService.runWithAudit(
            ctx,
            STOCK_TAKE_AUDIT_POLICIES.CREATE(productIds.length),
            async () => {
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
                                    differenceQty: 0, 
                                    isCounted: false
                                }))
                            }
                        },
                        include: { items: true }
                    });

                    return session;
                });
            }
        );

        return {
            data: result,
            affectedTags: [INVENTORY_TAGS.STOCK_TAKE.LIST]
        };
    },

    /**
     * อัปเดตปริมาณที่นับได้จริง
     */
    async updateActualCount(sessionId: string, productId: string, countedQty: number, note: string | undefined, ctx: RequestContext): Promise<MutationResult<any>> {
        if (countedQty < 0) throw new ServiceError('จำนวนที่นับได้ห้ามติดลบ');

        const result = await runInTransaction(undefined, async (prisma) => {
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

            return await (prisma as any).stockTakeItem.update({
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

        return {
            data: result,
            affectedTags: [INVENTORY_TAGS.STOCK_TAKE.DETAIL(sessionId)]
        };
    },

    /**
     * ส่งตรวจ (SUBMIT) — ล็อกการแก้ไข
     */
    async submitSession(sessionId: string, ctx: RequestContext): Promise<MutationResult<any>> {
        const result = await AuditService.runWithAudit(
            ctx,
            STOCK_TAKE_AUDIT_POLICIES.SUBMIT(sessionId),
            async () => {
                return runInTransaction(undefined, async (prisma) => {
                    const session = await (prisma as any).stockTakeSession.findUnique({
                        where: { id: sessionId },
                        select: { status: true, shopId: true }
                    });

                    if (!session || session.shopId !== ctx.shopId) throw new ServiceError('ไม่พบรายการตรวจนับ');
                    if (session.status !== 'DRAFT') throw new ServiceError('Session ไม่อยู่ในสถานะที่ส่งตรวจได้');

                    return await (prisma as any).stockTakeSession.update({
                        where: { id: sessionId },
                        data: {
                            status: 'SUBMITTED',
                            submittedByMemberId: ctx.memberId,
                            submittedAt: new Date()
                        }
                    });
                });
            }
        );

        return {
            data: result,
            affectedTags: [INVENTORY_TAGS.STOCK_TAKE.LIST, INVENTORY_TAGS.STOCK_TAKE.DETAIL(sessionId)]
        };
    },

    /**
     * อนุมัติและปรับปรุงสต็อก (COMPLETE)
     */
    async completeSession(sessionId: string, ctx: RequestContext): Promise<MutationResult<any>> {
        const result = await AuditService.runWithAudit(
            ctx,
            STOCK_TAKE_AUDIT_POLICIES.COMPLETE(sessionId),
            async () => {
                return runInTransaction(undefined, async (prisma) => {
                    const session = await (prisma as any).stockTakeSession.findUnique({
                        where: { id: sessionId },
                        include: { items: true }
                    });

                    if (!session || session.shopId !== ctx.shopId) throw new ServiceError('ไม่พบรายการตรวจนับ');
                    if (session.status !== 'SUBMITTED') throw new ServiceError('ต้องส่งตรวจ (SUBMITTED) ก่อนจึงจะอนุมัติได้');

                    const affectedProductIds: string[] = [];

                    for (const item of (session as any).items) {
                        if (!item.isCounted || item.differenceQty === 0) continue;

                        await StockService.recordMovement(ctx, {
                            productId: item.productId,
                            type: 'ADJUSTMENT' as any, 
                            quantity: item.differenceQty,
                            note: `Stock reconciliation (Session: ${session.id})`,
                            tx: prisma
                        });
                        
                        affectedProductIds.push(item.productId);
                    }

                    const updatedSession = await (prisma as any).stockTakeSession.update({
                        where: { id: sessionId },
                        data: {
                            status: 'COMPLETED',
                            completedByMemberId: ctx.memberId,
                            completedAt: new Date()
                        }
                    });

                    return { updatedSession, affectedProductIds };
                });
            }
        );

        const tags = [
            INVENTORY_TAGS.STOCK_TAKE.LIST, 
            INVENTORY_TAGS.STOCK_TAKE.DETAIL(sessionId),
            INVENTORY_TAGS.LIST
        ];
        
        result.affectedProductIds.forEach((pid: string) => {
            tags.push(INVENTORY_TAGS.STOCK(pid));
        });

        return {
            data: result.updatedSession,
            affectedTags: Array.from(new Set(tags))
        };
    },

    /**
     * ยกเลิก Session
     */
    async cancelSession(sessionId: string, reason: string, ctx: RequestContext): Promise<MutationResult<any>> {
        const result = await AuditService.runWithAudit(
            ctx,
            STOCK_TAKE_AUDIT_POLICIES.CANCEL(sessionId, reason),
            async () => {
                return await (db as any).stockTakeSession.update({
                    where: { id: sessionId, shopId: ctx.shopId },
                    data: {
                        status: 'CANCELLED',
                        cancelledByMemberId: ctx.memberId,
                        cancelledAt: new Date(),
                        cancelReason: reason
                    }
                });
            }
        );

        return {
            data: result,
            affectedTags: [INVENTORY_TAGS.STOCK_TAKE.LIST, INVENTORY_TAGS.STOCK_TAKE.DETAIL(sessionId)]
        };
    },

    /**
     * ดึงข้อมูล Session
     */
    async getSessionDetails(sessionId: string, ctx: RequestContext) {
        return await (db as any).stockTakeSession.findUnique({
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
