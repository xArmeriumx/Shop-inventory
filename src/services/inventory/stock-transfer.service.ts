import { db } from '@/lib/db';
import { RequestContext, ServiceError, DocumentType } from '@/types/domain';
import { Security } from '@/services/core/security.service';
import { SequenceService } from '@/services/core/sequence.service';
import { WarehouseService } from './warehouse.service';

/**
 * StockTransferService — Orchestrate movement between warehouses
 */
export const StockTransferService = {
    /**
     * Create a new stock transfer (Draft)
     */
    async createTransfer(ctx: RequestContext, data: {
        fromWarehouseId: string;
        toWarehouseId: string;
        lines: { productId: string; quantity: number }[];
        notes?: string;
    }) {
        Security.requirePermission(ctx, 'PRODUCT_UPDATE' as any);

        if (data.fromWarehouseId === data.toWarehouseId) {
            throw new ServiceError('คลังสินค้าต้นทางและปลายทางต้องไม่เป็นที่เดียวกัน');
        }

        return await db.$transaction(async (tx) => {
            const transferNo = await SequenceService.generate(ctx, DocumentType.STOCK_TRANSFER, tx);

            return await (tx as any).stockTransfer.create({
                data: {
                    transferNo,
                    shopId: ctx.shopId,
                    memberId: ctx.memberId,
                    fromWarehouseId: data.fromWarehouseId,
                    toWarehouseId: data.toWarehouseId,
                    notes: data.notes,
                    status: 'DRAFT',
                    lines: {
                        create: data.lines.map(l => ({
                            productId: l.productId,
                            quantity: l.quantity
                        }))
                    }
                },
                include: { lines: true }
            });
        });
    },

    /**
     * Commit a stock transfer (Move items)
     * Flow: DRAFT -> COMPLETED
     */
    async completeTransfer(ctx: RequestContext, transferId: string) {
        Security.requirePermission(ctx, 'PRODUCT_UPDATE' as any);

        return await db.$transaction(async (tx) => {
            // 1. Get transfer with lines
            const transfer = await (tx as any).stockTransfer.findFirst({
                where: { id: transferId, shopId: ctx.shopId },
                include: { lines: { include: { product: true } } }
            });

            if (!transfer) throw new ServiceError('ไม่พบรายการโอนสินค้า');
            if (transfer.status === 'COMPLETED') throw new ServiceError('รายการนี้ถูกยืนยันไปแล้ว');

            // 2. Perform Movement
            for (const line of transfer.lines) {
                // Deduct from Source
                await WarehouseService.adjustWarehouseStock(ctx, {
                    warehouseId: transfer.fromWarehouseId,
                    productId: line.productId,
                    delta: -line.quantity
                }, tx);

                // Add to Destination
                await WarehouseService.adjustWarehouseStock(ctx, {
                    warehouseId: transfer.toWarehouseId,
                    productId: line.productId,
                    delta: line.quantity
                }, tx);
            }

            // 3. Update status
            return await (tx as any).stockTransfer.update({
                where: { id: transferId },
                data: { status: 'COMPLETED' }
            });
        }, { timeout: 10000 });
    },

    /**
     * Get transfers list
     */
    async getTransfers(ctx: RequestContext) {
        return await (db as any).stockTransfer.findMany({
            where: { shopId: ctx.shopId },
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                member: { select: { user: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
};
