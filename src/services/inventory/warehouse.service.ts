import { db, runInTransaction } from '@/lib/db';
import { RequestContext, ServiceError, MutationResult } from '@/types/domain';
import { Permission } from '@prisma/client';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { WAREHOUSE_AUDIT_POLICIES } from '@/policies/inventory/warehouse.policy';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import { IWarehouseService } from '@/types/service-contracts';
import { StockEngine } from '@/services/inventory/stock-engine.service';

/**
 * WarehouseService — Manage physical storage locations
 * 
 * CORE SSOT RULE:
 * Product.stock MUST equal SUM(WarehouseStock.quantity) Across all warehouses.
 */
export const WarehouseService: IWarehouseService = {
    async getWarehouses(ctx: RequestContext) {
        return await db.warehouse.findMany({
            where: { shopId: ctx.shopId, isActive: true },
            orderBy: { createdAt: 'asc' }
        });
    },

    async createWarehouse(ctx: RequestContext, data: {
        name: string;
        code: string;
        address?: string;
        isDefault?: boolean;
        isActive?: boolean;
    }): Promise<MutationResult<any>> {
        return AuditService.runWithAudit(
            ctx,
            WAREHOUSE_AUDIT_POLICIES.CREATE(data.name, data.code),
            async () => {
                const warehouse = await runInTransaction(undefined, async (tx) => {
                    Security.requirePermission(ctx, Permission.WAREHOUSE_MANAGE);

                    // Check for duplicate code
                    const existing = await tx.warehouse.findFirst({
                        where: { shopId: ctx.shopId, code: data.code }
                    });

                    if (existing) throw new ServiceError(`รหัสคลังสินค้า ${data.code} มีอยู่ในระบบแล้ว`);

                    // If this is default, unset others
                    if (data.isDefault) {
                        await tx.warehouse.updateMany({
                            where: { shopId: ctx.shopId },
                            data: { isDefault: false }
                        });
                    }

                    return await tx.warehouse.create({
                        data: {
                            ...data,
                            shopId: ctx.shopId
                        }
                    });
                });

                return {
                    data: warehouse,
                    affectedTags: [INVENTORY_TAGS.WAREHOUSE.LIST]
                };
            }
        );
    },

    /**
     * Get stock levels for a product across all warehouses
     */
    async getProductStockBreakdown(ctx: RequestContext, productId: string) {
        return await db.warehouseStock.findMany({
            where: { shopId: ctx.shopId, productId },
            include: { warehouse: true }
        });
    },

    /**
     * Update stock in a specific warehouse
     * Used by Sales, Purchases, and Transfers
     */
    async adjustWarehouseStock(
        ctx: RequestContext,
        params: {
            warehouseId: string;
            productId: string;
            delta: number; // e.g. -5 for sale, +10 for purchase
        },
        tx: any = db
    ): Promise<MutationResult<any>> {
        // We use runWithAudit for the internal adjustment block if called from an Action
        // If called within another Service transaction, Audit will be handled by the parent
        const { warehouseId, productId, delta } = params;

        const result = await runInTransaction(tx, async (prisma) => {
            // Get references for audit note
            const [warehouse, product] = await Promise.all([
                (prisma as any).warehouse.findUnique({ where: { id: warehouseId }, select: { name: true } }),
                (prisma as any).product.findUnique({ where: { id: productId }, select: { name: true } })
            ]);

            return await AuditService.runWithAudit(
                ctx,
                WAREHOUSE_AUDIT_POLICIES.ADJUST_STOCK(
                    warehouse?.name || 'Unknown',
                    product?.name || 'Unknown',
                    delta
                ),
                async () => {
                    // 1. Get or Create WarehouseStock record
                    const warehouseStock = await prisma.warehouseStock.upsert({
                        where: {
                            productId_warehouseId: { productId, warehouseId }
                        },
                        update: {
                            quantity: { increment: delta }
                        },
                        create: {
                            productId,
                            warehouseId,
                            shopId: ctx.shopId,
                            quantity: delta
                        }
                    });

                    // 2. Critical: Recalculate Global Product Stock
                    await this.syncGlobalProductStock(ctx, productId, prisma);

                    return warehouseStock;
                }
            );
        });

        return {
            data: result,
            affectedTags: [INVENTORY_TAGS.STOCK(productId), INVENTORY_TAGS.LIST]
        };
    },

    /**
     * Sync Product.stock with SUM(WarehouseStock.quantity)
     * MAINTAINS SSOT
     */
    async syncGlobalProductStock(ctx: RequestContext, productId: string, tx: any = db): Promise<number> {
        const stocks = await tx.warehouseStock.findMany({
            where: { productId }
        });

        const totalStock = stocks.reduce((sum: number, s: any) => sum + s.quantity, 0);
        const totalReserved = stocks.reduce((sum: number, s: any) => sum + (s.reservedStock || 0), 0);

        await tx.product.update({
            where: { id: productId },
            data: {
                stock: totalStock,
                reservedStock: totalReserved
            }
        });

        return totalStock;
    },

    /**
     * Find default warehouse for the shop
     */
    async getDefaultWarehouse(ctx: RequestContext) {
        const warehouse = await db.warehouse.findFirst({
            where: { shopId: ctx.shopId, isDefault: true }
        });

        if (!warehouse) {
            // Fallback to first active one if no default set
            return await db.warehouse.findFirst({
                where: { shopId: ctx.shopId, isActive: true }
            });
        }

        return warehouse;
    },

    async ensureDefaultWarehouse(ctx: RequestContext, tx: any = db): Promise<any> {
        const existing = await tx.warehouse.findFirst({
            where: { shopId: ctx.shopId }
        });

        if (existing) return existing;

        // Auto-provision WH-MAIN
        return await tx.warehouse.create({
            data: {
                name: 'คลังสินค้าหลัก',
                code: 'WH-MAIN',
                isDefault: true,
                isActive: true,
                shopId: ctx.shopId
            }
        });
    },

    /**
     * Transfer stock between warehouses atomatically
     */
    async transferStock(
        ctx: RequestContext,
        input: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; notes?: string }
    ): Promise<MutationResult<void>> {
        const { productId, fromWarehouseId, toWarehouseId, quantity, notes } = input;

        if (quantity <= 0) throw new ServiceError('จำนวนที่โอนต้องมากกว่า 0');
        if (fromWarehouseId === toWarehouseId) throw new ServiceError('คลังต้นทางและปลายทางต้องเป็นคนละคลังกัน');

        await runInTransaction(undefined, async (prisma) => {
            // Check source stock
            const sourceStock = await prisma.warehouseStock.findUnique({
                where: { productId_warehouseId: { productId, warehouseId: fromWarehouseId } }
            });

            if (!sourceStock || sourceStock.quantity < quantity) {
                throw new ServiceError('สต็อกในคลังต้นทางไม่เพียงพอ');
            }

            // Execute using StockEngine for SSOT/Log integrity
            await StockEngine.executeBulkMovements(ctx, [
                {
                    productId,
                    warehouseId: fromWarehouseId,
                    delta: -quantity,
                    type: 'TRANSFER_OUT',
                    note: `Transfer to ${toWarehouseId}. ${notes || ''}`
                },
                {
                    productId,
                    warehouseId: toWarehouseId,
                    delta: quantity,
                    type: 'TRANSFER_IN',
                    note: `Transfer from ${fromWarehouseId}. ${notes || ''}`
                }
            ], prisma);
        });

        return {
            data: undefined,
            affectedTags: [INVENTORY_TAGS.STOCK(productId), INVENTORY_TAGS.DETAIL(productId)]
        };
    }
};
