import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { StockService } from '@/services/inventory/stock.service';
import {
    ServiceError,
    RequestContext,
    DocumentType
} from '@/types/domain';
import { SequenceService } from '@/services/core/sequence.service';
import { AuditService } from '@/services/core/audit.service';
import { PURCHASE_AUDIT_POLICIES } from '@/services/inventory/purchase.policy';

export interface PurchaseReturnItemInput {
    purchaseItemId: string;
    productId: string;
    quantity: number;
    recoveryPerUnit: number;
}

export interface CreatePurchaseReturnInput {
    purchaseId: string;
    reason: string;
    recoveryMethod: 'CASH' | 'TRANSFER' | 'CREDIT';
    items: PurchaseReturnItemInput[];
}

export const PurchaseReturnService = {
    /**
     * สร้างรายการส่งคืนสินค้า (Debit Note)
     */
    async create(input: CreatePurchaseReturnInput, ctx: RequestContext) {
        const purchase = await db.purchase.findFirst({
            where: { id: input.purchaseId, shopId: ctx.shopId },
            include: { items: { include: { purchaseReturnItems: true } } }
        });

        if (!purchase) throw new ServiceError('ไม่พบรายการสั่งซื้อ');

        return await AuditService.runWithAudit(
            ctx,
            PURCHASE_AUDIT_POLICIES.RECEIVE(purchase.purchaseNumber || purchase.id), // Reusing policy for now
            async () => {
                return await runInTransaction(undefined, async (prisma) => {
                    let totalRecovery = 0;
                    const returnItemsData = [];

                    for (const item of input.items) {
                        const pItem = (purchase as any).items.find((pi: any) => pi.id === item.purchaseItemId);
                        if (!pItem) throw new ServiceError(`ไม่พบรายการสินค้าในบิลซื้อ: ${item.productId}`);

                        // Check returnable quantity
                        const alreadyReturned = pItem.purchaseReturnItems?.reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;
                        const maxReturnable = pItem.quantity - alreadyReturned;

                        if (item.quantity > maxReturnable) {
                            throw new ServiceError(`สินค้า ${item.productId} คืนได้สูงสุด ${maxReturnable} ชิ้น`);
                        }

                        const amount = Number(item.quantity) * Number(item.recoveryPerUnit);
                        totalRecovery += amount;

                        returnItemsData.push({
                            purchaseItemId: item.purchaseItemId,
                            productId: item.productId,
                            quantity: item.quantity,
                            recoveryPerUnit: item.recoveryPerUnit,
                            recoveryAmount: amount
                        });
                    }

                    const returnNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_RETURN, prisma);

                    const returnRecord = await (prisma as any).purchaseReturn.create({
                        data: {
                            returnNumber,
                            purchaseId: input.purchaseId,
                            reason: input.reason,
                            recoveryAmount: totalRecovery,
                            recoveryMethod: input.recoveryMethod,
                            status: 'COMPLETED',
                            userId: ctx.userId,
                            shopId: ctx.shopId,
                            items: {
                                create: returnItemsData
                            }
                        },
                        include: { items: true }
                    });

                    // Stock Movement (Deduct stock since we are returning it to supplier)
                    await StockService.recordMovements(
                        ctx,
                        returnItemsData.map(item => ({
                            productId: item.productId,
                            type: 'RETURN' as any, // Or custom type if needed
                            quantity: -item.quantity, // Negative for deduction
                            userId: ctx.userId,
                            shopId: ctx.shopId,
                            note: `ส่งคืนสินค้า ${returnRecord.returnNumber} (${input.reason})`
                        })),
                        prisma
                    );

                    // Update Purchase Totals (Optional: reduce residualAmount if applicable)
                    if (input.recoveryMethod === 'CREDIT') {
                        await prisma.purchase.update({
                            where: { id: input.purchaseId },
                            data: {
                                residualAmount: { decrement: totalRecovery }
                            }
                        });
                    }

                    // ERP: Automated Financial Posting (Phase 6)
                    const { PostingService } = await import('@/services/accounting/posting-engine.service');
                    await PostingService.postPurchaseReturn(ctx, returnRecord, prisma);

                    return returnRecord;
                });
            }
        );
    },

    async getList(ctx: RequestContext) {
        return await db.purchaseReturn.findMany({
            where: { shopId: ctx.shopId },
            include: {
                purchase: { select: { purchaseNumber: true, supplierName: true } },
                items: { include: { product: { select: { name: true, sku: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
};
