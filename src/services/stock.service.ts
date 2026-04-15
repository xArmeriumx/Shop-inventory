import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { NotificationService } from './notification.service';

export type StockMovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'WASTE' | 'CANCEL' | 'SALE_CANCEL' | 'PURCHASE_CANCEL';

interface CreateStockMovementParams {
  productId: string;
  type: StockMovementType;
  quantity: number; // Positive for add, Negative for remove
  userId: string;
  shopId?: string;  // RBAC: Shop scope for multi-tenant isolation
  saleId?: string;
  purchaseId?: string;
  returnId?: string;
  note?: string;
  date?: Date | string;
  tx?: Prisma.TransactionClient; // Optional transaction client
  requireStock?: boolean; // If true, reject when stock would go negative (for sales)
}

export class StockService {
  /**
   * Records a stock movement and updates the product balance atomically.
   * Keeps a history log for traceability.
   * Optimized: merges stock + isLowStock into a single product.update (was 2 queries before).
   */
  static async recordMovement({
    productId,
    type,
    quantity,
    userId,
    shopId,
    saleId,
    purchaseId,
    returnId,
    note,
    date,
    tx,
    requireStock,
  }: CreateStockMovementParams) {
    const finalDate = date ? new Date(date) : new Date();

    // Use provided transaction or create a new one
    const operation = async (prisma: Prisma.TransactionClient) => {
      // 1. Read current product state
      const currentProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, stock: true, minStock: true, shopId: true },
      });

      if (!currentProduct) {
        throw new Error(`ไม่พบสินค้า ID: ${productId}`);
      }

      const newStock = currentProduct.stock + quantity;

      // 1.5 Stock guard: Reject if stock would go negative (sale safety)
      if (requireStock && newStock < 0) {
        throw new Error(
          `สินค้า "${currentProduct.name}" สต็อกไม่พอ (เหลือ ${currentProduct.stock})`
        );
      }

      // 2. Single atomic update: stock + isLowStock in ONE query (was 2 queries before)
      const isLowStock = newStock <= currentProduct.minStock;
      const finalShopId = shopId || currentProduct.shopId;

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          stock: newStock,
          isLowStock,
        },
        select: { id: true, name: true, stock: true, minStock: true, shopId: true },
      });

      // 3. Notification: Low stock alert (non-blocking, fire-and-forget)
      if (isLowStock && newStock > 0) {
        NotificationService.create({
          shopId: finalShopId,
          type: 'LOW_STOCK',
          severity: 'WARNING',
          title: `สินค้าใกล้หมด: ${updatedProduct.name}`,
          message: `เหลือ ${updatedProduct.stock} ชิ้น (ขั้นต่ำ ${updatedProduct.minStock})`,
          link: `/products/${productId}`,
          groupKey: `LOW_STOCK:${productId}`,
        }).catch(() => {}); // Non-blocking
      } else if (!isLowStock) {
        // Stock restored: remove the low stock notification
        NotificationService.removeByGroupKey(finalShopId, `LOW_STOCK:${productId}`).catch(() => {});
      }
      
      // 4. Create Stock Log
      await prisma.stockLog.create({
        data: {
          type,
          productId,
          quantity,
          balance: updatedProduct.stock, // Snapshot balance after movement
          saleId,
          purchaseId,
          returnId,
          note,
          date: finalDate,
          userId,
          shopId: finalShopId,  // RBAC: Set shopId for multi-tenant filtering
        },
      });

      return updatedProduct;
    };

    if (tx) {
      return operation(tx);
    } else {
      return db.$transaction(operation);
    }
  }

  /**
   * Bulk version: Records multiple stock movements efficiently.
   * Products are fetched in batch, then each is updated individually within the same transaction.
   * Stock logs are inserted via createMany for maximum throughput.
   */
  static async recordMovements(
    movements: CreateStockMovementParams[],
    tx: Prisma.TransactionClient
  ) {
    if (movements.length === 0) return;

    // 1. Batch-fetch all products in ONE query
    const productIds = Array.from(new Set(movements.map(m => m.productId)));
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stock: true, minStock: true, shopId: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // 2. Validate & compute new stock values
    const stockLogData: Prisma.StockLogCreateManyInput[] = [];
    const updateOps: Promise<any>[] = [];

    for (const m of movements) {
      const product = productMap.get(m.productId);
      if (!product) throw new Error(`ไม่พบสินค้า ID: ${m.productId}`);

      const newStock = product.stock + m.quantity;

      if (m.requireStock && newStock < 0) {
        throw new Error(`สินค้า "${product.name}" สต็อกไม่พอ (เหลือ ${product.stock})`);
      }

      const isLowStock = newStock <= product.minStock;
      const finalShopId = m.shopId || product.shopId;

      // Queue product update
      updateOps.push(
        tx.product.update({
          where: { id: m.productId },
          data: { stock: newStock, isLowStock },
        })
      );

      // Prepare stock log entry
      stockLogData.push({
        type: m.type,
        productId: m.productId,
        quantity: m.quantity,
        balance: newStock,
        saleId: m.saleId,
        purchaseId: m.purchaseId,
        returnId: m.returnId,
        note: m.note,
        date: m.date ? new Date(m.date) : new Date(),
        userId: m.userId,
        shopId: finalShopId,
      });

      // Update local map for subsequent movements of the same product
      product.stock = newStock;

      // Notification (non-blocking)
      if (isLowStock && newStock > 0) {
        NotificationService.create({
          shopId: finalShopId,
          type: 'LOW_STOCK',
          severity: 'WARNING',
          title: `สินค้าใกล้หมด: ${product.name}`,
          message: `เหลือ ${newStock} ชิ้น (ขั้นต่ำ ${product.minStock})`,
          link: `/products/${m.productId}`,
          groupKey: `LOW_STOCK:${m.productId}`,
        }).catch(() => {});
      } else if (!isLowStock) {
        NotificationService.removeByGroupKey(finalShopId, `LOW_STOCK:${m.productId}`).catch(() => {});
      }
    }

    // 3. Execute all product updates in parallel + bulk insert stock logs
    await Promise.all([
      ...updateOps,
      tx.stockLog.createMany({ data: stockLogData }),
    ]);
  }

  /**
   * Get stock history for a product with pagination
   */
  static async getProductHistory(productId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      db.stockLog.findMany({
        where: { productId },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ],
        include: {
          user: {
            select: { name: true },
          },
        },
        skip,
        take: limit,
      }),
      db.stockLog.count({ where: { productId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
