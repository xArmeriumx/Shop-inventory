import { db } from '@/lib/db';
import {
  RequestContext,
  ServiceError,
  StockAvailability,
} from '@/types/domain';
import { Prisma } from '@prisma/client';

export const StockAvailabilityEngine = {
  async getAvailability(productId: string, ctx: RequestContext): Promise<StockAvailability> {
    const [product, stocks] = await Promise.all([
      db.product.findUnique({
        where: { id: productId },
        select: { shopId: true, minStock: true, isLowStock: true },
      }),
      db.warehouseStock.findMany({
        where: { productId, shopId: ctx.shopId },
        select: { quantity: true, reservedStock: true },
      }),
    ]);

    if (!product || product.shopId !== ctx.shopId) throw new ServiceError('ไม่พบสินค้า');

    const onHand   = stocks.reduce((sum, w) => sum + Number(w.quantity),                    0);
    const reserved = stocks.reduce((sum, w) => sum + Number(w.reservedStock || 0),          0);

    return {
      onHand,
      reserved,
      available:  onHand - reserved,
      isLowStock: onHand < (product.minStock || 0),
      minStock:   product.minStock || 0,
    };
  },

  async checkBulkAvailability(
    items: Array<{ productId: string; quantity: number }>,
    shopId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ allAvailable: boolean; shortages: Array<{ productId: string; required: number; available: number }> }> {
    const executor = tx || db;
    const productIds = Array.from(new Set(items.map(i => i.productId)));

    const warehouseStocks = await (executor as any).warehouseStock.findMany({
      where: { productId: { in: productIds }, shopId },
      select: { productId: true, quantity: true, reservedStock: true },
    });

    const stockMap = new Map<string, { onHand: number; reserved: number }>();
    for (const ws of warehouseStocks) {
      const prev = stockMap.get(ws.productId) ?? { onHand: 0, reserved: 0 };
      stockMap.set(ws.productId, {
        onHand:   prev.onHand   + Number(ws.quantity),
        reserved: prev.reserved + Number(ws.reservedStock || 0),
      });
    }

    const shortages: Array<{ productId: string; required: number; available: number }> = [];

    for (const item of items) {
      const agg       = stockMap.get(item.productId);
      const available = agg ? agg.onHand - agg.reserved : 0;
      if (available < item.quantity) {
        shortages.push({ productId: item.productId, required: item.quantity, available });
      }
    }

    return { allAvailable: shortages.length === 0, shortages };
  }
};
