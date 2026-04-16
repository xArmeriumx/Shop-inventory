import { NotificationService } from './notification.service';
import { IStockService } from '@/types/service-contracts';
import { AuditService } from './audit.service';
import { STOCK_AUDIT_POLICIES } from './stock.policy';
import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { RequestContext, ServiceError, StockAvailability, StockMovement } from '@/types/domain';

interface CreateStockMovementParams {
  productId: string;
  type: StockMovement;
  quantity: number; // Positive for add, Negative for remove
  userId: string;
  shopId?: string;
  saleId?: string;
  purchaseId?: string;
  returnId?: string;
  note?: string;
  date?: Date | string;
  tx?: Prisma.TransactionClient;
  requireStock?: boolean;
}

export const StockService: IStockService = {
  /**
   * จองสต็อกสินค้า (เมื่อ Sale เปลี่ยนสถานะเป็น CONFIRMED)
   * - เพิ่ม reservedStock
   * - ตรวจสอบ available (onHand - reserved) >= quantity
   */
  /**
   * จองสต็อกสินค้า (เมื่อ Sale เปลี่ยนสถานะเป็น CONFIRMED)
   * - เพิ่ม reservedStock
   * - ตรวจสอบ available (onHand - reserved) >= quantity
   */
  async reserveStock(productId, quantity, ctx, tx) {
    await AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.RESERVE(productId, quantity),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { stock: true, reservedStock: true, name: true, shopId: true },
          });

          if (!product || product.shopId !== ctx.shopId) {
            throw new Error(`ไม่พบสินค้า: ${productId}`);
          }

          const available = product.stock - product.reservedStock;
          if (available < quantity) {
            throw new Error(`สต็อกสินค้า "${product.name}" ไม่พอสำหรับจอง (คงเหลือที่สั่งซื้อได้: ${available})`);
          }

          const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: {
              reservedStock: { increment: quantity },
            },
          });

          // บันทึก log การจอง
          await prisma.stockLog.create({
            data: {
              type: 'RESERVATION',
              productId,
              quantity,
              balance: product.stock, // onHand balance doesn't change
              userId: ctx.userId,
              shopId: ctx.shopId,
              note: `จองสต็อกคงคลังสำหรับใบสั่งซื้อ`,
            },
          });

          return {
            ...updatedProduct,
            changeQty: quantity,
            reserveBefore: product.reservedStock,
            reserveAfter: updatedProduct.reservedStock,
          };
        });
      }
    );
  },

  /**
   * ตัดสต็อกจริง (เมื่อ Delivery confirmed)
   * - ลด onHand (stock)
   * - ลด reservedStock ที่จองไว้
   */
  async deductStock(productId, quantity, ctx, tx) {
    await AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.DEDUCT(productId, quantity),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, stock: true, reservedStock: true, minStock: true, name: true, shopId: true },
          });

          if (!product || product.shopId !== ctx.shopId) {
            throw new Error(`ไม่พบสินค้า: ${productId}`);
          }

          const newStock = product.stock - quantity;
          const isLowStock = newStock <= product.minStock;

          const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: {
              stock: newStock,
              reservedStock: { decrement: quantity },
              isLowStock,
            },
          });

          // บันทึก log การตัดสต็อก
          await prisma.stockLog.create({
            data: {
              type: 'SALE',
              productId,
              quantity: -quantity,
              balance: newStock,
              userId: ctx.userId,
              shopId: ctx.shopId,
              note: `ตัดสต็อกสินค้าจริง (ส่งของสำเร็จ)`,
            },
          });

          // Notification: Low stock alert
          if (isLowStock && newStock > 0) {
            NotificationService.create({
              shopId: ctx.shopId,
              type: 'LOW_STOCK',
              severity: 'WARNING',
              title: `สินค้าใกล้หมด: ${product.name}`,
              message: `เหลือ ${newStock} ชิ้น (ขั้นต่ำ ${product.minStock})`,
              link: `/products/${productId}`,
              groupKey: `LOW_STOCK:${productId}`,
            }).catch(() => {});
          }

          return {
            ...updatedProduct,
            qtyBefore: product.stock,
            qtyAfter: updatedProduct.stock,
            reserveBefore: product.reservedStock,
            reserveAfter: updatedProduct.reservedStock,
            changeQty: -quantity,
          };
        });
      }
    );
  },

  /**
   * ปล่อยการจอง (เมื่อ Sale ถูก Cancel)
   * - ลด reservedStock
   */
  async releaseStock(productId, quantity, ctx, tx) {
    await AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.RELEASE(productId, quantity),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, stock: true, reservedStock: true, shopId: true },
          });

          if (!product) throw new Error(`ไม่พบสินค้า: ${productId}`);

          const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: {
              reservedStock: { decrement: quantity },
            },
          });

          // บันทึก log การปล่อยจอง
          await prisma.stockLog.create({
            data: {
              type: 'RELEASE',
              productId,
              quantity: -quantity,
              balance: product.stock,
              userId: ctx.userId,
              shopId: ctx.shopId,
              note: `ยกเลิกการจองสต็อก (ใบสั่งซื้อถูกยกเลิก)`,
            },
          });

          return {
            ...updatedProduct,
            reserveBefore: product.reservedStock,
            reserveAfter: updatedProduct.reservedStock,
            changeQty: -quantity,
          };
        });
      }
    );
  },

  /**
   * ดึงสถานะสต็อกแบบ Business-Ready
   */
  async getAvailability(productId, ctx) {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { stock: true, reservedStock: true, minStock: true, isLowStock: true, shopId: true },
    });

    if (!product || product.shopId !== ctx.shopId) {
      throw new Error(`ไม่พบสินค้า: ${productId}`);
    }

    return {
      onHand: product.stock,
      reserved: product.reservedStock,
      available: product.stock - product.reservedStock,
      isLowStock: product.isLowStock,
      minStock: product.minStock,
    };
  },

  /**
   * Records a stock movement and updates the product balance atomically.
   */
  async recordMovement(ctx: RequestContext, {
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
    return AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.MOVE(productId, type, quantity, note),
      async () => {
        const finalDate = date ? new Date(date) : new Date();
        
        return runInTransaction(tx, async (prisma) => {
          const currentProduct = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, stock: true, reservedStock: true, minStock: true, shopId: true },
          });

          if (!currentProduct) {
            throw new Error(`ไม่พบสินค้า ID: ${productId}`);
          }

          const available = currentProduct.stock - currentProduct.reservedStock;
          const newStock = currentProduct.stock + quantity;

          if (requireStock && (available + quantity < 0)) {
            throw new Error(
              `สินค้า "${currentProduct.name}" สต็อกไม่พอ (เหลือที่สั่งได้ ${available})`
            );
          }

          const isLowStock = newStock <= currentProduct.minStock;
          const finalShopId = shopId || currentProduct.shopId;

          const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: {
              stock: newStock,
              isLowStock,
            },
          });

          if (isLowStock && newStock > 0) {
            NotificationService.create({
              shopId: finalShopId,
              type: 'LOW_STOCK',
              severity: 'WARNING',
              title: `สินค้าใกล้หมด: ${currentProduct.name}`,
              message: `เหลือ ${updatedProduct.stock} ชิ้น (ขั้นต่ำ ${currentProduct.minStock})`,
              link: `/products/${productId}`,
              groupKey: `LOW_STOCK:${productId}`,
            }).catch(() => {});
          } else if (!isLowStock) {
            NotificationService.removeByGroupKey(finalShopId, `LOW_STOCK:${productId}`).catch(() => {});
          }
          
          await prisma.stockLog.create({
            data: {
              type,
              productId,
              quantity,
              balance: updatedProduct.stock,
              saleId,
              purchaseId,
              returnId,
              note,
              date: finalDate,
              userId,
              shopId: finalShopId,
            },
          });

          // Return enriched result for audit after-snapshot
          return {
            ...updatedProduct,
            qtyBefore: currentProduct.stock,
            qtyAfter: updatedProduct.stock,
            changeQty: quantity,
          };
        });
      }
    );
  },

  async recordMovements(ctx: RequestContext, movements: CreateStockMovementParams[], tx: Prisma.TransactionClient) {
    if (movements.length === 0) return;

    await AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.BULK_MOVE(movements.length),
      async () => {
        const productIds = Array.from(new Set(movements.map(m => m.productId)));
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, stock: true, reservedStock: true, minStock: true, shopId: true },
        });
        const productMap = new Map(products.map(p => [p.id, p]));

        const stockLogData: Prisma.StockLogCreateManyInput[] = [];
        const updateOps: Promise<any>[] = [];
        let totalQtyChange = 0;

        for (const m of movements) {
          const product = productMap.get(m.productId);
          if (!product) throw new Error(`ไม่พบสินค้า ID: ${m.productId}`);

          const available = product.stock - product.reservedStock;
          const newStock = product.stock + m.quantity;

          if (m.requireStock && (available + m.quantity < 0)) {
            throw new Error(`สินค้า "${product.name}" สต็อกไม่พอ (สั่งได้ ${available})`);
          }

          const isLowStock = newStock <= product.minStock;
          const finalShopId = m.shopId || product.shopId;
          totalQtyChange += m.quantity;

          updateOps.push(
            tx.product.update({
              where: { id: m.productId },
              data: { stock: newStock, isLowStock },
            })
          );

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

          product.stock = newStock;
        }

        await Promise.all([
          ...updateOps,
          tx.stockLog.createMany({ data: stockLogData }),
        ]);

        // Return summary for audit snapshot (Rule: Traceable Bulk Summary)
        return {
          affectedCount: movements.length,
          affectedProductIds: productIds.slice(0, 10), // Truncate if too many for readability
          hasOverflowIds: productIds.length > 10,
          totalQuantityChange: totalQtyChange,
          movementTypes: Array.from(new Set(movements.map(m => m.type))),
        };
      }
    );
  },

  async getProductHistory(productId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      db.stockLog.findMany({
        where: { productId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: { user: { select: { name: true } } },
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
};
