import { runInTransaction } from '@/lib/db';
import { AuditService } from '@/services/core/system/audit.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { PRODUCT_AUDIT_POLICIES } from '@/policies/inventory/product.policy';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import { RequestContext, ServiceError, MutationResult, BatchProductInput, BatchCreateResult } from '@/types/domain';

export const ProductBatchUseCase = {
  async batchCreate(inputs: BatchProductInput[], ctx: RequestContext): Promise<MutationResult<BatchCreateResult>> {
    if (!inputs || inputs.length === 0) throw new ServiceError('ไม่มีข้อมูลสินค้าที่จะสร้าง');

    return AuditService.runWithAudit(
      ctx,
      PRODUCT_AUDIT_POLICIES.BATCH_CREATE(inputs.length),
      async () => {
        const validInputs: BatchProductInput[] = [];
        const failed: BatchCreateResult['failed'] = [];

        for (const input of inputs) {
          if (!input.name || !input.name.trim()) {
            failed.push({ name: input.name || 'ไม่มีชื่อ', error: 'ไม่มีชื่อสินค้า' });
            continue;
          }
          if (!input.category || !input.category.trim()) {
            failed.push({ name: input.name, error: 'ไม่มีหมวดหมู่' });
            continue;
          }
          validInputs.push({
            name: input.name.trim(),
            sku: input.sku?.trim() || null,
            category: input.category.trim(),
            costPrice: input.costPrice || 0,
            salePrice: input.salePrice || 0,
            stock: input.stock,
            minStock: input.minStock,
          });
        }

        if (validInputs.length === 0) return { data: { created: [], failed }, affectedTags: [] };

        const result = await runInTransaction(undefined, async (prisma) => {
          const created: BatchCreateResult['created'] = [];
          const seenSkus = new Set<string>();
          for (const input of validInputs) {
            if (input.sku) {
              const normalizedSku = input.sku.toLowerCase();
              if (seenSkus.has(normalizedSku)) {
                input.sku = null;
              } else {
                seenSkus.add(normalizedSku);
              }
            }
          }

          const skusToCheck = validInputs.filter(i => i.sku).map(i => i.sku as string);
          let existingSkuMap = new Map();
          if (skusToCheck.length > 0) {
            const existing = await prisma.product.findMany({
              where: { shopId: ctx.shopId, sku: { in: skusToCheck, mode: 'insensitive' } },
              select: { id: true, sku: true, isActive: true },
            });
            existingSkuMap = new Map(existing.map(p => [p.sku?.toLowerCase(), p]));
          }

          for (const input of validInputs) {
            const skuKey = input.sku?.toLowerCase();
            const existingProduct = skuKey ? existingSkuMap.get(skuKey) : null;

            if (existingProduct) {
              const current = await prisma.product.findUnique({
                where: { id: existingProduct.id },
                select: { stock: true },
              });

              const updated = await prisma.product.update({
                where: { id: existingProduct.id },
                data: {
                  name: input.name,
                  category: input.category,
                  costPrice: input.costPrice,
                  salePrice: input.salePrice,
                  ...(input.minStock !== undefined && { minStock: input.minStock }),
                  isActive: true,
                  deletedAt: null,
                },
              });

              if (input.stock !== undefined && current && input.stock !== current.stock) {
                const diff = input.stock - current.stock;
                const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
                await StockEngine.executeMovement(ctx, {
                  warehouseId: whId,
                  productId: updated.id,
                  delta: diff,
                  type: 'ADJUSTMENT',
                  note: `[Batch Import] ปรับสต็อก: ${input.name}`
                }, prisma);
              }

              created.push({ id: updated.id, name: updated.name, costPrice: Number(updated.costPrice) });
            } else {
              const createdP = await prisma.product.create({
                data: {
                  name: input.name,
                  sku: input.sku,
                  category: input.category,
                  costPrice: input.costPrice,
                  salePrice: input.salePrice,
                  stock: 0,
                  minStock: input.minStock ?? 5,
                  userId: ctx.userId,
                  shopId: ctx.shopId,
                },
              });

              const initialStock = input.stock ?? 0;
              if (initialStock > 0) {
                const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
                await StockEngine.executeMovement(ctx, {
                  warehouseId: whId,
                  productId: createdP.id,
                  delta: initialStock,
                  type: 'ADJUSTMENT',
                  note: `[Batch Import] สต็อกเริ่มต้น: ${input.name}`
                }, prisma);
              }

              created.push({ id: createdP.id, name: createdP.name, costPrice: Number(createdP.costPrice) });
            }
          }
          return { created, failed };
        });

        return {
          data: result,
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.SELECT]
        };
      }
    );
  }
};
