import { RequestContext } from '@/types/domain';
import { Prisma } from '@prisma/client';
import { StockMovementService } from './movement';

export const StockAllocation = {
  async reserveStock(productId: string, quantity: number, ctx: RequestContext, tx: Prisma.TransactionClient, warehouseId?: string | null): Promise<any> {
    const result = await StockMovementService.recordMovement(ctx, {
      productId,
      type: 'RESERVATION',
      quantity,
      warehouseId,
      note: 'จองสินค้าสำหรับรายการขาย',
      ctx,
      tx,
    });
    return result.data;
  },

  async releaseStock(productId: string, quantity: number, ctx: RequestContext, tx: Prisma.TransactionClient, warehouseId?: string | null): Promise<any> {
    const result = await StockMovementService.recordMovement(ctx, {
      productId,
      type: 'RELEASE',
      quantity,
      warehouseId,
      note: 'คืนสต็อกจากการยกเลิกรายการขาย',
      ctx,
      tx,
      requireStock: false,
    });
    return result.data;
  },

  async deductStock(productId: string, quantity: number, ctx: RequestContext, tx?: Prisma.TransactionClient, docRef?: { saleId?: string; deliveryOrderId?: string }, warehouseId?: string | null): Promise<any> {
    const result = await StockMovementService.recordMovement(ctx, {
      productId,
      type: 'SALE',
      quantity,
      warehouseId,
      saleId: docRef?.saleId,
      deliveryOrderId: docRef?.deliveryOrderId,
      note: `ตัดสต็อกสำหรับรายการขาย`,
      ctx,
      tx,
    });
    return result.data;
  },

  async bulkReserveStock(items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const movements = items.map(item => ({
      productId: item.productId,
      warehouseId: item.warehouseId,
      type: 'RESERVATION',
      quantity: item.quantity,
      note: 'จองสินค้าสำหรับรายการขาย (Bulk)',
    }));
    await StockMovementService.recordMovements(ctx, movements, tx);
  },

  async bulkReleaseStock(items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const movements = items.map(item => ({
      productId: item.productId,
      warehouseId: item.warehouseId,
      type: 'RELEASE',
      quantity: item.quantity,
      note: 'คืนสต็อกจากการยกเลิกรายการขาย (Bulk)',
    }));
    await StockMovementService.recordMovements(ctx, movements, tx);
  },

  async bulkDeductStock(
    items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>,
    ctx: RequestContext,
    tx: Prisma.TransactionClient,
    docRef?: { saleId?: string; deliveryOrderId?: string; validation?: 'STRICT' | 'WARN' | 'ALLOW_NEGATIVE' }
  ) {
    const movements = items.map(item => ({
      productId: item.productId,
      warehouseId: item.warehouseId,
      type: 'SALE' as const,
      quantity: item.quantity,
      saleId: docRef?.saleId,
      deliveryOrderId: docRef?.deliveryOrderId,
      validation: docRef?.validation,
      note: `ตัดสต็อกสำหรับรายการขาย (Bulk)`,
    }));
    await StockMovementService.recordMovements(ctx, movements, tx);
  }
};
