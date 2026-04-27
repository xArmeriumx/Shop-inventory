import { db, runInTransaction } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Prisma } from '@prisma/client';
import { WarehouseService } from './warehouse.service';

export type StockMovementType =
  | 'SALE'
  | 'SALE_CANCEL'
  | 'PURCHASE'
  | 'RETURN'
  | 'PURCHASE_RETURN'
  | 'ADJUSTMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'STOCK_TAKE';

export interface StockMovementInput {
  warehouseId: string;
  productId: string;
  delta: number;
  type: StockMovementType;
  note?: string;
  reasonCode?: string;
  referenceId?: string;
  referenceType?: string;
  saleId?: string;
  purchaseId?: string;
  purchaseReceiptId?: string;
  returnId?: string;
  deliveryOrderId?: string;
}

/**
 * StockEngine — The Single Entry Point for all inventory writes.
 * Ensures WarehouseStock is SSOT and Product.stock is synced.
 */
export const StockEngine = {
  /**
   * Execute a single stock movement
   */
  async executeMovement(
    ctx: RequestContext,
    input: StockMovementInput,
    tx: any = db
  ): Promise<{ newWarehouseQty: number; newGlobalQty: number }> {
    const { warehouseId, productId, delta } = input;

    return await runInTransaction(tx, async (prisma) => {
      // 1. Update WarehouseStock (SSOT)
      const warehouseStock = await (prisma as any).warehouseStock.upsert({
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

      // 2. Sync Global Product Stock
      const newGlobalQty = await WarehouseService.syncGlobalProductStock(ctx, productId, prisma);

      // 3. Create StockLog (with warehouseId and balance)
      // Note: In Phase 1, we don't have warehouseId in StockLog yet. 
      // We will add it in Phase 2 Migration. For now, we use existing StockLog.
      await (prisma as any).stockLog.create({
        data: {
          type: input.type,
          productId,
          quantity: delta,
          balance: newGlobalQty, // Total stock after movement
          warehouseId: warehouseId,
          warehouseBalance: warehouseStock.quantity,
          note: input.note,
          reasonCode: input.reasonCode,
          referenceId: input.referenceId,
          referenceType: input.referenceType,
          saleId: input.saleId,
          purchaseId: input.purchaseId,
          purchaseReceiptId: input.purchaseReceiptId,
          returnId: input.returnId,
          deliveryOrderId: input.deliveryOrderId,
          userId: ctx.userId,
          memberId: ctx.memberId || null,
          shopId: ctx.shopId,
        }
      });

      return {
        newWarehouseQty: warehouseStock.quantity,
        newGlobalQty
      };
    });
  },

  /**
   * Resolve warehouse: Use default if not specified
   */
  async resolveWarehouse(ctx: RequestContext, warehouseId?: string, tx: any = db): Promise<string> {
    if (warehouseId) return warehouseId;
    const defaultWh = await WarehouseService.getDefaultWarehouse(ctx);
    if (!defaultWh) {
      // Fallback to auto-provisioning if missing
      const provisioned = await WarehouseService.ensureDefaultWarehouse(ctx, tx);
      return provisioned.id;
    }
    return defaultWh.id;
  },

  /**
   * Execute multiple movements in a single transaction
   */
  async executeBulkMovements(
    ctx: RequestContext,
    inputs: StockMovementInput[],
    tx: any = db
  ): Promise<void> {
    await runInTransaction(tx, async (prisma) => {
      for (const input of inputs) {
        await this.executeMovement(ctx, input, prisma);
      }
    });
  }
};
