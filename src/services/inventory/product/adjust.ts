import { runInTransaction } from '@/lib/db';
import { AuditService } from '@/services/core/system/audit.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { STOCK_AUDIT_POLICIES } from '@/policies/inventory/stock.policy';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import { RequestContext, ServiceError, MutationResult, AdjustStockInput } from '@/types/domain';

export const ProductAdjustUseCase = {
  async adjustStockManual(productId: string, input: AdjustStockInput, ctx: RequestContext): Promise<MutationResult<void>> {
    return AuditService.runWithAudit(
      ctx,
      {
        ...STOCK_AUDIT_POLICIES.MANUAL_ADJUST('', input.type, input.quantity, input.description),
      },
      async () => {
        await runInTransaction(undefined, async (prisma) => {
          // 1. Atomic Load for Snapshot
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, stock: true, shopId: true, name: true, reservedStock: true, minStock: true },
          });

          if (!product || product.shopId !== ctx.shopId) throw new ServiceError('ไม่พบสินค้า');

          // Attach for Audit
          (ctx as any).auditMetadata = { before: product };

          let change = 0;
          let notePrefix = '';

          switch (input.type) {
            case 'ADD':
              change = input.quantity;
              notePrefix = '[Manual Add]';
              break;
            case 'REMOVE':
              if (input.quantity > product.stock) {
                throw new ServiceError(`สต็อกไม่เพียงพอ (คงเหลือ: ${product.stock}, ต้องการลด: ${input.quantity})`);
              }
              change = -input.quantity;
              notePrefix = '[Manual Remove]';
              break;
            case 'SET':
              change = input.quantity - product.stock;
              notePrefix = '[Manual Set]';
              if (change < 0 && product.stock + change < 0) {
                throw new ServiceError(`ค่าที่ตั้งต่ำกว่า 0 ไม่ได้รับอนุญาต`);
              }
              break;
          }

          if (change !== 0) {
            // SSOT: resolveWarehouse — ใช้ warehouseId ที่ส่งมา หรือ fallback ไป default
            const whId = await StockEngine.resolveWarehouse(ctx, input.warehouseId, prisma);
            await StockEngine.executeMovement(ctx, {
              warehouseId: whId,
              productId: productId,
              delta: change,
              type: 'ADJUSTMENT',
              note: `${notePrefix} ${input.description}`,
              reasonCode: input.reasonCode,
            }, prisma);
          }

          // Capture After
          const after = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, stock: true, shopId: true, name: true, reservedStock: true, minStock: true },
          });
          (ctx as any).auditMetadata.after = after;
        });

        return {
          data: undefined,
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.DETAIL(productId), INVENTORY_TAGS.STOCK(productId)]
        };
      }
    );
  }
};
