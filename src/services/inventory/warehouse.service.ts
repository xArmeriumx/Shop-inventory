import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';

/**
 * WarehouseService — Manage physical storage locations
 * 
 * CORE SSOT RULE:
 * Product.stock MUST equal SUM(WarehouseStock.quantity) Across all warehouses.
 */
export const WarehouseService = {
    /**
     * Get all active warehouses for the shop
     */
    async getWarehouses(ctx: RequestContext) {
        return await (db as any).warehouse.findMany({
            where: { shopId: ctx.shopId, isActive: true },
            orderBy: { createdAt: 'asc' }
        });
    },

    /**
     * Create a new warehouse
     */
    async createWarehouse(ctx: RequestContext, data: {
        name: string;
        code: string;
        address?: string;
        isDefault?: boolean;
    }) {
        Security.requirePermission(ctx, 'PRODUCT_UPDATE' as any); // Or a specific warehouse perm

        // Check for duplicate code
        const existing = await (db as any).warehouse.findFirst({
            where: { shopId: ctx.shopId, code: data.code }
        });

        if (existing) throw new ServiceError(`รหัสคลังสินค้า ${data.code} มีอยู่ในระบบแล้ว`);

        return await db.$transaction(async (tx) => {
            // If this is default, unset others
            if (data.isDefault) {
                await (tx as any).warehouse.updateMany({
                    where: { shopId: ctx.shopId },
                    data: { isDefault: false }
                });
            }

            return await (tx as any).warehouse.create({
                data: {
                    ...data,
                    shopId: ctx.shopId
                }
            });
        });
    },

    /**
     * Get stock levels for a product across all warehouses
     */
    async getProductStockBreakdown(ctx: RequestContext, productId: string) {
        return await (db as any).warehouseStock.findMany({
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
    ) {
        const { warehouseId, productId, delta } = params;

        // 1. Get or Create WarehouseStock record
        const warehouseStock = await (tx as any).warehouseStock.upsert({
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
        await this.syncGlobalProductStock(ctx, productId, tx);

        return warehouseStock;
    },

    /**
     * Sync Product.stock with SUM(WarehouseStock.quantity)
     * MAINTAINS SSOT
     */
    async syncGlobalProductStock(ctx: RequestContext, productId: string, tx: any = db) {
        const stocks = await (tx as any).warehouseStock.findMany({
            where: { productId }
        });

        const totalStock = stocks.reduce((sum: number, s: any) => sum + s.quantity, 0);

        await (tx as any).product.update({
            where: { id: productId },
            data: { stock: totalStock }
        });

        return totalStock;
    },

    /**
     * Find default warehouse for the shop
     */
    async getDefaultWarehouse(ctx: RequestContext) {
        const warehouse = await (db as any).warehouse.findFirst({
            where: { shopId: ctx.shopId, isDefault: true }
        });

        if (!warehouse) {
            // Fallback to first active one if no default set
            return await (db as any).warehouse.findFirst({
                where: { shopId: ctx.shopId, isActive: true }
            });
        }

        return warehouse;
    }
};
