import { runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { AuditService } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { PRODUCT_AUDIT_POLICIES } from '@/policies/inventory/product.policy';
import { serializeProduct } from '@/lib/mappers';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import {
  RequestContext,
  ServiceError,
  MutationResult,
  SerializedProduct,
} from '@/types/domain';
import { ProductInput } from '@/schemas/inventory/product.schema';

export const ProductCreateUseCase = {
  async create(ctx: RequestContext, payload: ProductInput, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedProduct>> {
    Security.requirePermission(ctx, 'PRODUCT_CREATE');
    return AuditService.runWithAudit(
      ctx,
      PRODUCT_AUDIT_POLICIES.CREATE(payload.name),
      async () => {
        const product = await runInTransaction(tx, async (prisma) => {
          if (payload.sku) {
            const existing = await prisma.product.findFirst({
              where: { sku: payload.sku, shopId: ctx.shopId, isActive: true },
            });
            if (existing) throw new ServiceError('รหัสสินค้า (SKU) นี้มีอยู่แล้ว', { sku: ['SKU นี้มีอยู่แล้ว'] });
          }

          const { initialStocks, ...productData } = payload as any;

          const newProduct = await prisma.product.create({
            data: {
              ...productData,
              stock: 0,
              description: productData.description || null,
              sku: productData.sku || null,
              isActive: productData.isActive ?? productData.isSaleable ?? true,
              isSaleable: productData.isSaleable ?? productData.isActive ?? true,
              metadata: (productData.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              userId: ctx.userId,
              memberId: ctx.memberId || null,
              shopId: ctx.shopId,
            } as any,
          });

          const stocksToInit = initialStocks || [];

          if (stocksToInit.length > 0) {
            // Process multi-warehouse initial levels
            await StockEngine.executeBulkMovements(ctx, initialStocks.map((item: any) => ({
              warehouseId: item.warehouseId,
              productId: newProduct.id,
              delta: item.quantity,
              type: 'ADJUSTMENT',
              note: `Initial Stock (Genesis) - Location: ${item.binLocation || 'N/A'}`
            })), prisma);
          } else {
            // Fallback: Legacy/Simple single-stock import
            const initialStock = payload.stock ?? 0;
            if (initialStock > 0) {
              const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
              await StockEngine.executeMovement(ctx, {
                warehouseId: whId,
                productId: newProduct.id,
                delta: initialStock,
                type: 'ADJUSTMENT',
                note: 'Initial Stock (Genesis)'
              }, prisma);
            }
          }

          return newProduct;
        });

        return {
          data: serializeProduct(product),
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.SELECT]
        };
      }
    );
  }
};
