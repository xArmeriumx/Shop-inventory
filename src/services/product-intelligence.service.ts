import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from './security';
import { ProductIntelligenceSummary, StockMovementDTO, SupplierIntelligenceDTO } from '@/types/intelligence';

export const ProductIntelligenceService = {
    async getSummary(productId: string, ctx: RequestContext): Promise<ProductIntelligenceSummary> {
        Security.requirePermission(ctx, 'PRODUCT_VIEW');

        const product = await db.product.findUnique({
            where: { id: productId, shopId: ctx.shopId },
            select: {
                id: true,
                stock: true,
                reservedStock: true,
                salePrice: true,
            }
        });

        if (!product) throw new ServiceError('ไม่พบข้อมูลสินค้า');

        // Get latest purchase cost (Rule 3)
        const latestPurchaseItem = await (db as any).purchaseItem.findFirst({
            where: {
                productId,
                purchase: { shopId: ctx.shopId, status: { not: 'CANCELLED' } }
            },
            orderBy: { createdAt: 'desc' },
            select: { price: true }
        });

        const latestCost = latestPurchaseItem ? Number(latestPurchaseItem.price) : 0;

        return {
            productId: product.id,
            onHand: product.stock,
            reserved: product.reservedStock,
            available: product.stock - product.reservedStock,
            currentWac: latestCost, // Simplified for Phase 3
            latestCost,
            latestSalePrice: Number(product.salePrice),
        };
    },

    async getMovementHistory(productId: string, ctx: RequestContext, params: { page?: number; limit?: number } = {}) {
        Security.requirePermission(ctx, 'STOCK_VIEW' as any);
        const { page = 1, limit = 10 } = params;
        const skip = (page - 1) * limit;

        const where: any = {
            productId,
            shopId: ctx.shopId,
        };

        const [logs, total] = await Promise.all([
            (db as any).stockLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { name: true, sku: true } },
                    member: { select: { name: true } },
                } as any,
                skip,
                take: limit,
            }),
            (db as any).stockLog.count({ where })
        ]);

        const data: StockMovementDTO[] = (logs as any[]).map(log => {
            return {
                id: log.id,
                type: log.type,
                quantity: Number(log.quantity),
                balance: Number(log.balance),
                date: log.createdAt,
                note: log.note,
                referenceType: log.saleId ? 'SALE' : log.purchaseId ? 'PURCHASE' : log.deliveryOrderId ? 'DELIVERY' : 'UNKNOWN',
                referenceId: log.saleId || log.purchaseId || log.deliveryOrderId || undefined,
                actorName: log.member?.name || 'Unknown',
            };
        });

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            }
        };
    },

    async getSupplierIntelligence(productId: string, ctx: RequestContext): Promise<SupplierIntelligenceDTO[]> {
        Security.requirePermission(ctx, 'PRODUCT_VIEW');

        // Get all suppliers who provided this product
        const items = await (db as any).purchaseItem.findMany({
            where: {
                productId,
                purchase: { shopId: ctx.shopId }
            },
            include: {
                purchase: {
                    include: { supplier: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const suppliersMap = new Map<string, SupplierIntelligenceDTO>();
        for (const item of items) {
            const supplier = (item as any).purchase?.supplier;
            if (!supplier) continue;

            if (!suppliersMap.has(supplier.id)) {
                suppliersMap.set(supplier.id, {
                    id: supplier.id, // Logic identifier
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    lastPurchasePrice: Number(item.price),
                    lastPurchasedDate: (item as any).purchase?.createdAt,
                });
            }
        }

        return Array.from(suppliersMap.values());
    }
};
