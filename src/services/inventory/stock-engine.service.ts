import { db, runInTransaction } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Prisma } from '@prisma/client';
import { WarehouseService } from './warehouse.service';

export type ValidationMode = 'STRICT' | 'WARN' | 'ALLOW_NEGATIVE';

export type StockMovementType =
  | 'SALE'
  | 'SALE_CANCEL'
  | 'PURCHASE'
  | 'RETURN'
  | 'PURCHASE_RETURN'
  | 'ADJUSTMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'STOCK_TAKE'
  | 'RESERVATION'
  | 'RELEASE';

export interface StockMovementInput {
  warehouseId: string;
  productId: string;
  delta: number;
  type: StockMovementType;
  validation?: ValidationMode;
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
      // 1. Calculate Deltas based on Type
      let quantityDelta = 0;
      let reservedDelta = 0;

      switch (input.type) {
        case 'RESERVATION':
          reservedDelta = delta;
          break;
        case 'RELEASE':
          reservedDelta = -Math.abs(delta);
          break;
        case 'SALE':
          quantityDelta = -Math.abs(delta);
          // If we had a reservation, we release it as we deduct on-hand
          // Note: In a simple system, we assume SALE is preceded by RESERVATION
          reservedDelta = -Math.abs(delta);
          break;
        case 'SALE_CANCEL':
        case 'RETURN':
        case 'PURCHASE':
        case 'TRANSFER_IN':
          quantityDelta = Math.abs(delta);
          break;
        case 'TRANSFER_OUT':
          quantityDelta = -Math.abs(delta);
          break;
        case 'STOCK_TAKE':
        case 'ADJUSTMENT':
          quantityDelta = delta; // Can be pos or neg
          break;
        default:
          quantityDelta = delta;
      }

      // 2. Security Guard: Prevent negative stock if STRICT validation is enabled
      // We fetch the current stock within the transaction to ensure consistency
      const currentStock = await (prisma as any).warehouseStock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
        select: { quantity: true, reservedStock: true, product: { select: { name: true } } }
      });

      const validationMode = input.validation || 'ALLOW_NEGATIVE'; // Default for legacy/adjustment
      const potentialQty = (currentStock?.quantity || 0) + quantityDelta;

      if (validationMode === 'STRICT' && potentialQty < 0) {
        throw new ServiceError(
          `สต็อกไม่เพียงพอ: ${currentStock?.product?.name || productId} ในคลังที่เลือกมีไม่เพียงพอ (ต้องการ ${Math.abs(quantityDelta)}, มีอยู่ ${currentStock?.quantity || 0})`,
          { stock: ['INSUFFICIENT_STOCK'] }
        );
      }

      // 3. Update WarehouseStock (SSOT)
      const warehouseStock = await (prisma as any).warehouseStock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId }
        },
        update: {
          quantity: { increment: quantityDelta },
          reservedStock: { increment: reservedDelta }
        },
        create: {
          productId,
          warehouseId,
          shopId: ctx.shopId,
          quantity: potentialQty < 0 ? 0 : potentialQty, // Guard against negative even if not STRICT (clamping)
          reservedStock: Math.max(0, reservedDelta)
        }
      });

      // Clamp reservedStock to not go negative
      if (warehouseStock.reservedStock < 0) {
        await (prisma as any).warehouseStock.update({
          where: { id: warehouseStock.id },
          data: { reservedStock: 0 }
        });
        warehouseStock.reservedStock = 0;
      }

      // 3. Sync READ CACHE: Product.stock ← SUM(WarehouseStock)
      //    ห่อด้วย try/catch — ถ้า Sync ล้มเหลว ไม่ให้ Transaction หลักพัง
      //    เพราะ WarehouseStock คือ SSOT จริงๆ แล้ว อยู่ที่บรรทัดบน
      let newGlobalQty: number;
      try {
        newGlobalQty = await WarehouseService.syncGlobalProductStock(ctx, productId, prisma);
      } catch (syncErr) {
        console.error(`[StockEngine] Cache sync failed for product ${productId}:`, syncErr);
        // Fallback: ใช้ค่า warehouseStock ปัจจุบันแทนการ SUM ทุกคลัง
        newGlobalQty = Number(warehouseStock.quantity);
      }


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
