import { db } from '@/lib/db';
import { RequestContext, ServiceError, DocumentType } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { WarehouseService } from './warehouse.service';
import { StockEngine } from './stock-engine.service';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';

import { IStockTransferService } from '@/types/service-contracts';
import { INVENTORY_TAGS } from '@/config/cache-tags';

/**
 * StockTransferService — Orchestrate movement between warehouses
 */
export const StockTransferService: IStockTransferService = {
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

        return await AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.STOCK_TRANSFER_CREATE,
            targetType: 'StockTransfer',
            note: `สร้างใบโอนสินค้า ${data.lines.length} รายการ จาก ${data.fromWarehouseId} → ${data.toWarehouseId}`,
        }, async () => {
            return await db.$transaction(async (tx) => {
                const transferNo = await SequenceService.generate(ctx, DocumentType.STOCK_TRANSFER, tx);

                const transfer = await (tx as any).stockTransfer.create({
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

                return {
                    data: transfer,
                    affectedTags: [INVENTORY_TAGS.LIST]
                };
            });
        });
    },

    /**
     * Commit a stock transfer (Move items)
     * Flow: DRAFT -> COMPLETED
     */
    async completeTransfer(ctx: RequestContext, transferId: string) {
        Security.requirePermission(ctx, 'PRODUCT_UPDATE' as any);

        return await AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.STOCK_TRANSFER_COMPLETE,
            targetType: 'StockTransfer',
            targetId: transferId,
            note: `ยืนยันการโอนสินค้าสำเร็จ`,
        }, async () => {
            return await db.$transaction(async (tx) => {
                const transfer = await (tx as any).stockTransfer.findFirst({
                    where: { id: transferId, shopId: ctx.shopId },
                    include: { lines: { include: { product: true } } }
                });

                if (!transfer) throw new ServiceError('ไม่พบรายการโอนสินค้า');
                if (transfer.status === 'COMPLETED') throw new ServiceError('รายการนี้ถูกยืนยันไปแล้ว');

                for (const line of transfer.lines) {
                    await StockEngine.executeMovement(ctx, {
                        warehouseId: transfer.fromWarehouseId,
                        productId: line.productId,
                        delta: -line.quantity,
                        type: 'TRANSFER_OUT',
                        note: `โอนไปยังคลัง ${transfer.toWarehouseId} (โอนเลขที่ ${transfer.transferNo})`,
                        referenceId: transfer.id,
                        referenceType: 'StockTransfer'
                    }, tx);

                    await StockEngine.executeMovement(ctx, {
                        warehouseId: transfer.toWarehouseId,
                        productId: line.productId,
                        delta: line.quantity,
                        type: 'TRANSFER_IN',
                        note: `รับโอนจากคลัง ${transfer.fromWarehouseId} (โอนเลขที่ ${transfer.transferNo})`,
                        referenceId: transfer.id,
                        referenceType: 'StockTransfer'
                    }, tx);
                }

                const updatedTransfer = await (tx as any).stockTransfer.update({
                    where: { id: transferId },
                    data: { status: 'COMPLETED' }
                });

                return {
                    data: updatedTransfer,
                    affectedTags: [INVENTORY_TAGS.LIST]
                };
            }, { timeout: 10000 });
        });
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
