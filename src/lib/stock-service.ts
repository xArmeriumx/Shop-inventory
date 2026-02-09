import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { NotificationService } from '@/lib/notification-service';

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
      // 1. Get current product to check existence and current stock
      // We start by updating the product stock directly.
      // Ideally we should lock the row, but Prisma doesn't support SELECT FOR UPDATE easily yet without raw SQL.
      // For now, atomic increment/decrement is safe for concurrency.
      
      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          stock: {
            increment: quantity,
          },
        },
        select: {
          id: true,
          name: true,
          stock: true,
          minStock: true, // Need minStock to compare
          shopId: true,   // Get shopId from product if not provided
        },
      });

      // 1.5 Stock guard: Reject if stock went negative (sale safety)
      if (requireStock && updatedProduct.stock < 0) {
        throw new Error(
          `สินค้า "${updatedProduct.name}" สต็อกไม่พอ (เหลือ ${updatedProduct.stock + Math.abs(quantity)})`
        );
      }

      // 1.5 Calculation: Check if Low Stock
      // We do this immediately to keep the flag in sync
      const isLowStock = updatedProduct.stock <= updatedProduct.minStock;
      
      // Update the flag (Optimized: only if we want to be strict, or we can just always set it)
      // To be safe and simple: Always set it.
      await prisma.product.update({
        where: { id: productId },
        data: { isLowStock },
      });

      // 2. Create Stock Log with the NEW balance
      // RBAC: Use provided shopId or fallback to product's shopId
      const finalShopId = shopId || updatedProduct.shopId;

      // Notification: Low stock alert (non-blocking, fire-and-forget)
      if (isLowStock && updatedProduct.stock > 0) {
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
   * Get stock history for a product
   */
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
