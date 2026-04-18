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
            throw new ServiceError(
              `สต็อกสินค้า "${product.name}" ไม่พอสำหรับจอง (คงเหลือที่สั่งซื้อได้: ${available})`,
              undefined,
              { label: 'สั่งซื้อสินค้าเพิ่ม', href: '/purchases/new' }
            );
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

          // P1.1: Guard — reservedStock ห้ามติดลบ
          if (product.reservedStock < quantity) {
            throw new ServiceError(
              `ไม่สามารถตัดสต็อกสินค้า "${product.name}" ได้: สต็อกที่จองไว้ (${product.reservedStock}) น้อยกว่าที่ต้องการตัด (${quantity})`,
            );
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

          // Notification: Trigger Operational Health Check (Summary)
          NotificationService.checkOperationalHealth(ctx.shopId).catch(() => { });

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
            select: { id: true, stock: true, reservedStock: true, shopId: true, name: true },
          });

          if (!product) throw new Error(`ไม่พบสินค้า: ${productId}`);

          // P1.1: Guard — reservedStock ห้ามติดลบ
          if (product.reservedStock < quantity) {
            throw new ServiceError(
              `ไม่สามารถปล่อยการจองสินค้า "${product.name}": สต็อกที่จองไว้ (${product.reservedStock}) น้อยกว่าที่ต้องการปล่อย (${quantity})`,
            );
          }

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
            throw new ServiceError(
              `สินค้า "${currentProduct.name}" สต็อกไม่พอ (เหลือที่สั่งได้ ${available})`,
              undefined,
              { label: 'สั่งซื้อสินค้าเพิ่ม', href: '/purchases/new' }
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

          // Notification: Trigger Operational Health Check (Summary)
          NotificationService.checkOperationalHealth(finalShopId).catch(() => { });

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

        // R-INV-02: Read product metadata (for validation + minStock check only)
        // We do NOT use the stock value from here for updates — the DB handles that atomically
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, stock: true, reservedStock: true, minStock: true, shopId: true },
        });
        const productMap = new Map(products.map(p => [p.id, p]));

        // Pre-validate all movements before any DB mutation (Fail Fast principle)
        for (const m of movements) {
          const product = productMap.get(m.productId);
          if (!product) throw new Error(`ไม่พบสินค้า ID: ${m.productId}`);

          if (m.requireStock) {
            const available = product.stock - product.reservedStock;
            if (available + m.quantity < 0) {
              throw new ServiceError(
                `สินค้า "${product.name}" สต็อกไม่พอ (สั่งได้ ${available})`,
                undefined,
                { label: 'สั่งซื้อสินค้าเพิ่ม', href: '/purchases/new' }
              );
            }
          }
        }

        // R-INV-02: Atomic SQL UPDATE — ป้องกัน race condition
        // ใช้ SET stock = stock + qty แทนการ read → compute → write
        // เพื่อให้ DB เป็น owner ของการเปลี่ยนแปลง ไม่ใช่ application
        const atomicUpdates: Promise<any>[] = [];
        const stockLogData: Prisma.StockLogCreateManyInput[] = [];
        let totalQtyChange = 0;

        for (const m of movements) {
          const product = productMap.get(m.productId)!;
          const finalShopId = m.shopId || product.shopId;
          const finalDate = m.date ? new Date(m.date) : new Date();
          totalQtyChange += m.quantity;

          // Atomic stock increment at DB level
          atomicUpdates.push(
            tx.$executeRaw`
              UPDATE "Product"
              SET
                stock       = stock + ${m.quantity},
                "isLowStock" = (stock + ${m.quantity} <= "minStock"),
                "updatedAt" = NOW()
              WHERE id = ${m.productId}
            `
          );

          // StockLog balance will be approximate here — use DB trigger or
          // a follow-up read if precise balance snapshot is required.
          // For now, optimistic balance = current + delta (acceptable for logs)
          stockLogData.push({
            type: m.type,
            productId: m.productId,
            quantity: m.quantity,
            balance: product.stock + m.quantity, // Optimistic snapshot
            saleId: m.saleId,
            purchaseId: m.purchaseId,
            returnId: m.returnId,
            note: m.note,
            date: finalDate,
            userId: m.userId,
            shopId: finalShopId,
          });
        }

        // Execute all atomic stock updates + log inserts in parallel within the tx
        await Promise.all([
          ...atomicUpdates,
          tx.stockLog.createMany({ data: stockLogData }),
        ]);

        // Trigger health check after bulk movement (fire-and-forget)
        const shopIds = new Set(stockLogData.map(s => s.shopId));
        shopIds.forEach(shopId => {
          NotificationService.checkOperationalHealth(shopId).catch(() => { });
        });

        return {
          affectedCount: movements.length,
          affectedProductIds: productIds.slice(0, 10),
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
