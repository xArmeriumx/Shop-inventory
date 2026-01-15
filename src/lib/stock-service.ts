import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export type StockMovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'WASTE' | 'CANCEL';

interface CreateStockMovementParams {
  productId: string;
  type: StockMovementType;
  quantity: number; // Positive for add, Negative for remove
  userId: string;
  referenceId?: string;
  referenceType?: 'SALE' | 'PURCHASE';
  note?: string;
  date?: Date | string;
  tx?: Prisma.TransactionClient; // Optional transaction client
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
    referenceId,
    referenceType,
    note,
    date,
    tx,
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
          stock: true,
        },
      });

      // 2. Create Stock Log with the NEW balance
      await prisma.stockLog.create({
        data: {
          type,
          productId,
          quantity,
          balance: updatedProduct.stock, // Snapshot balance after movement
          referenceId,
          referenceType,
          note,
          date: finalDate,
          userId,
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
  static async getProductHistory(productId: string) {
    return db.stockLog.findMany({
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
      take: 50, // Limit for performance
    });
  }
}
