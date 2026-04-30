import {
  RequestContext,
  StockMovement,
  MutationResult
} from '@/types/domain';
import { AuditService } from '@/services/core/system/audit.service';
import { STOCK_AUDIT_POLICIES } from '@/policies/inventory/stock.policy';
import { Prisma } from '@prisma/client';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import { StockEngine } from '@/services/inventory/stock-engine.service';

export interface CreateStockMovementParams {
  productId: string;
  type: StockMovement;
  quantity: number;
  warehouseId?: string | null;
  note?: string;
  referenceId?: string;
  referenceType?: string;
  saleId?: string;
  purchaseId?: string;
  deliveryOrderId?: string;
  returnId?: string;
  ctx: RequestContext;
  tx?: Prisma.TransactionClient;
  requireStock?: boolean;
}

export const StockMovementService = {
  async recordMovement(ctx: RequestContext, params: CreateStockMovementParams): Promise<MutationResult<any>> {
    const {
      productId,
      type,
      quantity,
      warehouseId,
      note,
      saleId,
      purchaseId,
      deliveryOrderId,
      returnId,
      tx,
    } = params;

    const result = await AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.MOVE(productId, type as any, quantity, note),
      async () => {
        const resolvedWhId = await StockEngine.resolveWarehouse(ctx, warehouseId || undefined, tx);

        const moveResult = await StockEngine.executeMovement(ctx, {
          productId,
          warehouseId: resolvedWhId,
          delta: quantity,
          type: type as any,
          note,
          saleId,
          purchaseId,
          deliveryOrderId,
          returnId,
          referenceId: params.referenceId,
          referenceType: params.referenceType
        }, tx);

        return moveResult;
      },
      tx
    );

    return {
      data: result,
      affectedTags: [INVENTORY_TAGS.STOCK(productId), INVENTORY_TAGS.LIST, INVENTORY_TAGS.DETAIL(productId)]
    };
  },

  async recordMovements(
    ctx: RequestContext,
    movements: Array<{
      productId: string;
      warehouseId?: string | null;
      type: any;
      quantity: number;
      validation?: any;
      note?: string;
      saleId?: string;
      purchaseId?: string;
      deliveryOrderId?: string;
      returnId?: string;
      referenceId?: string;
      referenceType?: string;
    }>,
    tx: Prisma.TransactionClient
  ): Promise<MutationResult<void>> {
    if (movements.length === 0) return { data: undefined, affectedTags: [] };

    await AuditService.runWithAudit(
      ctx,
      {
        action: 'STOCK_BULK_PROCESS',
        targetType: 'Stock',
        note: `ประมวลผลสต็อกจำนวน ${movements.length} รายการ`,
      },
      async () => {
        const defaultWh = await StockEngine.resolveWarehouse(ctx, undefined, tx);

        const resolvedMovements = await Promise.all(
          movements.map(async (m) => ({
            productId: m.productId,
            warehouseId: m.warehouseId || defaultWh,
            delta: m.quantity,
            type: m.type,
            validation: m.validation,
            note: m.note,
            saleId: m.saleId,
            purchaseId: m.purchaseId,
            deliveryOrderId: m.deliveryOrderId,
            returnId: m.returnId,
            referenceId: m.referenceId,
            referenceType: m.referenceType,
          }))
        );

        await StockEngine.executeBulkMovements(ctx, resolvedMovements, tx);
      },
      tx
    );

    const affectedTags = Array.from(new Set(movements.map(m => INVENTORY_TAGS.STOCK(m.productId))));
    affectedTags.push(INVENTORY_TAGS.LIST);

    return {
      data: undefined,
      affectedTags
    };
  }
};
