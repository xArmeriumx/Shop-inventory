import { runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { AuditService } from '@/services/core/system/audit.service';
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

export const ProductUpdateUseCase = {
  async update(id: string, ctx: RequestContext, payload: Partial<ProductInput> & { version?: number }, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedProduct>> {
    return AuditService.runWithAudit(
      ctx,
      {
        ...PRODUCT_AUDIT_POLICIES.UPDATE(id, 'Product Update'),
      },
      async () => {
        const product = await runInTransaction(tx, async (prisma) => {
          // 1. Atomic Load (Check & Snapshot)
          const existingP = await prisma.product.findFirst({
            where: { id, shopId: ctx.shopId, deletedAt: null },
          });
          if (!existingP) throw new ServiceError('ไม่พบสินค้า');

          // Attach before snapshot for audit
          (ctx as any).auditMetadata = { before: existingP };

          // 2. Validate version
          if (payload.version !== undefined && payload.version !== existingP.version) {
            throw new ServiceError('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชแล้วลองใหม่');
          }

          // 3. SKU uniqueness
          if (payload.sku && payload.sku !== existingP.sku) {
            const duplicate = await prisma.product.findFirst({
              where: { sku: payload.sku, shopId: ctx.shopId, id: { not: id } },
              select: { id: true },
            });
            if (duplicate) throw new ServiceError('รหัสสินค้า (SKU) นี้มีอยู่แล้ว');
          }

          // 4. Stock adjustment logic
          if (payload.stock !== undefined && payload.stock !== existingP.stock) {
            const diff = payload.stock - existingP.stock;
            const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
            await StockEngine.executeMovement(ctx, {
              warehouseId: whId,
              productId: id,
              delta: diff,
              type: 'ADJUSTMENT',
              note: `Product Update (Manual stock override)`
            }, prisma);
          }

          const { stock, version, initialStocks, ...otherData } = payload;
          const currentStock = payload.stock !== undefined ? payload.stock : existingP.stock;
          const currentMinStock = otherData.minStock !== undefined ? otherData.minStock : existingP.minStock;

          try {
            const updatedProduct = await prisma.product.update({
              where: { id, version: existingP.version },
              data: {
                ...otherData,
                description: otherData.description || null,
                ...(otherData.sku !== undefined ? { sku: otherData.sku || null } : {}),
                isActive: otherData.isActive ?? (otherData.isSaleable !== undefined ? otherData.isSaleable : existingP.isActive),
                isSaleable: otherData.isSaleable ?? (otherData.isActive !== undefined ? otherData.isActive : existingP.isSaleable),
                metadata: otherData.metadata === null ? Prisma.JsonNull : (otherData.metadata as Prisma.InputJsonValue),
                isLowStock: currentStock <= (currentMinStock ?? 0),
                version: { increment: 1 },
              },
            });

            // Attach after snapshot for audit
            (ctx as any).auditMetadata.after = updatedProduct;

            return updatedProduct;
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
              throw new ServiceError('ข้อมูลถูกแก้ไขพร้อมกันโดยผู้ใช้อื่น กรุณารีเฟรชแล้วลองใหม่ (Concurrent Conflict)');
            }
            throw e;
          }
        });

        return {
          data: serializeProduct(product),
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.DETAIL(id), INVENTORY_TAGS.STOCK(id)]
        };
      }
    );
  }
};
