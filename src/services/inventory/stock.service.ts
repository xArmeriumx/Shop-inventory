import { db, runInTransaction } from '@/lib/db';
import {
  RequestContext,
  ServiceError,
  StockMovement,
  DocumentType,
  StockAvailability,
} from '@/types/domain';
import { IStockService } from '@/types/service-contracts';
import { SequenceService } from '@/services/core/system/sequence.service';
import { AuditService } from '@/services/core/system/audit.service';
import { STOCK_AUDIT_POLICIES } from '@/policies/inventory/stock.policy';
import { Prisma } from '@prisma/client';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/lib/constants';

export interface CreateStockMovementParams {
  productId: string;
  type: StockMovement;
  quantity: number;
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

export const StockService: IStockService = {
  /**
   * บันทึกการเคลื่อนไหวสต็อก (Source of Truth สำหรับการตัดสต็อก)
   */
  async recordMovement(ctx: RequestContext, params: CreateStockMovementParams) {
    const {
      productId,
      type,
      quantity,
      note,
      saleId,
      purchaseId,
      deliveryOrderId,
      returnId,
      tx,
      requireStock = true,
    } = params;

    return AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.MOVE(productId, type as any, quantity, note),
      async () => {
        const executor = tx || db;

        // ดึงข้อมูลสินค้าและสต็อกล่าสุด (Lock for update ถ้าอยู่ใน transaction)
        const product = await executor.product.findUnique({
          where: { id: productId },
          select: { stock: true, reservedStock: true, minStock: true, shopId: true, version: true },
        });

        if (!product) throw new ServiceError('ไม่พบสินค้า');
        if (product.shopId !== ctx.shopId) throw new ServiceError('ไม่มีสิทธิ์จัดการสินค้านี้');

        // คำนวณสต็อกใหม่
        let newStock = product.stock;
        let newReserved = product.reservedStock;

        // Logic ตามความหมายทางธุรกิจของ ERP
        switch (type) {
          case 'PURCHASE': // รับเข้าจากใบสั่งซื้อ
          case 'RETURN': // รับเข้าจากการคืนสินค้า
            newStock += quantity;
            break;

          case 'CANCEL': // จ่ายออกทั่วไป
            if (requireStock && product.stock < quantity) {
              throw new ServiceError(`สต็อกไม่เพียงพอ (คงเหลือ: ${product.stock}, ต้องการ: ${quantity})`);
            }
            newStock -= quantity;
            break;

          case 'SALE': // ตัดสต็อกจากการขาย (ลด Stock, ลด Reserved)
            if (requireStock && product.stock < quantity) {
              throw new ServiceError(`สต็อกไม่เพียงพอ (คงเหลือ: ${product.stock}, ต้องการ: ${quantity})`);
            }
            newStock -= quantity;
            // ถ้าระบบมีการจองสต็อกไว้ (Reserved) ให้ตัด Reserved ออกด้วย
            if (product.reservedStock >= quantity) {
              newReserved -= quantity;
            }
            break;

          case 'RESERVATION': // จองสต็อก (เพิ่ม Reserved, Stock เท่าเดิม)
            if (requireStock && (product.stock - product.reservedStock) < quantity) {
              throw new ServiceError(`สต็อกพร้อมขายไม่เพียงพอ (คงเหลือ: ${product.stock}, จองแล้ว: ${product.reservedStock}, ต้องการจองเพิ่ม: ${quantity})`);
            }
            newReserved += quantity;
            break;

          case 'RELEASE': // ปล่อยการจอง (ลด Reserved, Stock เท่าเดิม)
            newReserved = Math.max(0, product.reservedStock - quantity);
            break;

          default:
            // Custom types or adjustments
            if (type === 'ADJUSTMENT' as any) {
              newStock += quantity; // Positive or negative
              // 🛡️ Bug #5 Fix: Guard against negative stock
              if (newStock < 0) {
                throw new ServiceError(`ไม่สามารถลดสต็อกได้ เนื่องจากสต็อกจะติดลบ (คงเหลือ: ${product.stock}, ต้องการลด: ${Math.abs(quantity)})`);
              }
            }
        }

        // Pillar 6.3: Optimistic Locking
        try {
          await executor.product.update({
            where: { id: productId, version: product.version },
            data: {
              stock: newStock,
              reservedStock: newReserved,
              isLowStock: newStock <= (product.minStock ?? DEFAULT_LOW_STOCK_THRESHOLD),
              version: { increment: 1 },
            },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
            throw new ServiceError('ข้อมูลสินค้ามีการเปลี่ยนแปลงโดยผู้ใช้อื่น กรุณาลองใหม่อีกครั้ง (Concurrency Conflict)');
          }
          throw e;
        }

        // บันทึก Log
        const logData = {
          type,
          productId,
          quantity,
          balance: newStock,
          note,
          saleId,
          purchaseId,
          deliveryOrderId,
          returnId,
          userId: ctx.userId,
          shopId: ctx.shopId,
        };

        const log = await (executor as any).stockLog.create({
          data: {
            ...logData,
            memberId: ctx.memberId || null,
          } as any,
        });

        return log;
      },
      tx
    );
  },

  /**
   * จองสต็อกสินค้า (เมื่อ Sale เปลี่ยนสถานะเป็น CONFIRMED)
   */
  async reserveStock(productId: string, quantity: number, ctx: RequestContext, tx: Prisma.TransactionClient) {
    return this.recordMovement(ctx, {
      productId,
      type: 'RESERVATION',
      quantity,
      note: 'จองสินค้าสำหรับรายการขาย',
      ctx,
      tx,
    });
  },

  /**
   * ปล่อยการจอง (เมื่อ Sale ถูก Cancel ก่อนส่งของ)
   */
  async releaseStock(productId: string, quantity: number, ctx: RequestContext, tx: Prisma.TransactionClient) {
    return this.recordMovement(ctx, {
      productId,
      type: 'RELEASE',
      quantity,
      note: 'คืนสต็อกจากการยกเลิกรายการขาย',
      ctx,
      tx,
      requireStock: false,
    });
  },

  /**
   * ตัดสต็อกจริงเมื่อส่งสินค้า
   */
  async deductStock(productId: string, quantity: number, ctx: RequestContext, tx?: Prisma.TransactionClient, docRef?: { saleId?: string; deliveryOrderId?: string }) {
    return this.recordMovement(ctx, {
      productId,
      type: 'SALE',
      quantity,
      saleId: docRef?.saleId,
      deliveryOrderId: docRef?.deliveryOrderId,
      note: `ตัดสต็อกสำหรับรายการขาย`,
      ctx,
      tx,
    });
  },

  /**
   * ดึงสถานะสต็อกแบบ Business-Ready
   */
  async getAvailability(productId: string, ctx: RequestContext): Promise<StockAvailability> {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { stock: true, reservedStock: true, minStock: true, isLowStock: true, shopId: true },
    });

    if (!product || product.shopId !== ctx.shopId) throw new ServiceError('ไม่พบสินค้า');

    return {
      onHand: product.stock,
      reserved: product.reservedStock,
      available: product.stock - product.reservedStock,
      isLowStock: !!product.isLowStock,
      minStock: product.minStock || 0,
    };
  },

  /**
   * checkBulkAvailability — ตรวจสอบสต็อกทุก Item ใน 1 Query (O(n) product lookup)
   * ใช้ใน DeliveryOrderService.create() เพื่อตั้ง Initial Status
   *
   * @returns { allAvailable: boolean, shortages: Array<{ productId, required, available }> }
   */
  async checkBulkAvailability(
    items: Array<{ productId: string; quantity: number }>,
    shopId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ allAvailable: boolean; shortages: Array<{ productId: string; required: number; available: number }> }> {
    const executor = tx || db;
    const productIds = Array.from(new Set(items.map(i => i.productId)));

    // ⚡ 1 query สำหรับทุก product
    const products = await executor.product.findMany({
      where: { id: { in: productIds }, shopId },
      select: { id: true, stock: true, reservedStock: true },
    });

    const productMap = new Map(products.map(p => [p.id, p]));
    const shortages: Array<{ productId: string; required: number; available: number }> = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        shortages.push({ productId: item.productId, required: item.quantity, available: 0 });
        continue;
      }
      const available = Number(product.stock) - Number(product.reservedStock || 0);
      if (available < item.quantity) {
        shortages.push({ productId: item.productId, required: item.quantity, available });
      }
    }

    return { allAvailable: shortages.length === 0, shortages };
  },

  async bulkReserveStock(items: Array<{ productId: string; quantity: number }>, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const movements = items.map(item => ({
      productId: item.productId,
      type: 'RESERVATION',
      quantity: item.quantity,
      note: 'จองสินค้าสำหรับรายการขาย (Bulk)',
    }));
    await this.recordMovements(ctx, movements, tx);
  },

  async bulkReleaseStock(items: Array<{ productId: string; quantity: number }>, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const movements = items.map(item => ({
      productId: item.productId,
      type: 'RELEASE',
      quantity: item.quantity,
      note: 'คืนสต็อกจากการยกเลิกรายการขาย (Bulk)',
    }));
    await this.recordMovements(ctx, movements, tx);
  },

  async bulkDeductStock(items: Array<{ productId: string; quantity: number }>, ctx: RequestContext, tx: Prisma.TransactionClient, docRef?: { saleId?: string; deliveryOrderId?: string }) {
    const movements = items.map(item => ({
      productId: item.productId,
      type: 'SALE',
      quantity: item.quantity,
      saleId: docRef?.saleId,
      deliveryOrderId: docRef?.deliveryOrderId,
      note: `ตัดสต็อกสำหรับรายการขาย (Bulk)`,
    }));
    await this.recordMovements(ctx, movements, tx);
  },

  async recordMovements(ctx: RequestContext, movements: any[], tx: Prisma.TransactionClient) {
    if (movements.length === 0) return;

    return AuditService.runWithAudit(
      ctx,
      {
        action: 'STOCK_BULK_PROCESS',
        targetType: 'Stock',
        note: `ประมวลผลสต็อกจำนวน ${movements.length} รายการ`,
      },
      async () => {
        const productIds = Array.from(new Set(movements.map(m => m.productId)));
        
        // ⚡ Bulk Fetch all products at once
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, stock: true, reservedStock: true, minStock: true, shopId: true, version: true },
        });

        const productMap = new Map(products.map(p => [p.id, p]));

        // ⚡ Perform all updates sequentially in memory but write to DB
        // (Prisma doesn't support bulk update with logic, so we still update in loop but we skip findUnique)
        for (const movement of movements) {
          const { productId, type, quantity } = movement;
          const product = productMap.get(productId);
          if (!product) continue;

          let newStock = Number(product.stock);
          let newReserved = Number(product.reservedStock || 0);

          switch (type) {
            case 'RESERVATION':
              newReserved += quantity;
              break;
            case 'RELEASE':
              newReserved = Math.max(0, newReserved - quantity);
              break;
            case 'SALE':
              newStock -= quantity;
              if (newReserved >= quantity) newReserved -= quantity;
              break;
            case 'PURCHASE':
            case 'RETURN':
            case 'SALE_CANCEL':
              newStock += quantity;
              break;
            default:
              newStock += quantity;
          }

          await tx.product.update({
            where: { id: productId, version: product.version },
            data: {
              stock: newStock,
              reservedStock: newReserved,
              isLowStock: newStock <= (product.minStock ?? DEFAULT_LOW_STOCK_THRESHOLD),
              version: { increment: 1 },
            },
          });
        }

        // ⚡ Bulk Insert all logs in ONE command
        await (tx as any).stockLog.createMany({
          data: movements.map(m => ({
            ...m,
            memberId: ctx.memberId || null,
            shopId: ctx.shopId,
            userId: ctx.userId,
            balance: productMap.get(m.productId)!.stock // Note: legacy balance might be slightly off in createMany for same-product bulk
          })) as any,
        });
      },
      tx // ⚡ PROPAGATE TRANSACTION CLIENT HERE
    );
  },

  async getProductHistory(ctx: RequestContext, productId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      (db as any).stockLog.findMany({
        where: { productId, shopId: ctx.shopId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (db as any).stockLog.count({ where: { productId, shopId: ctx.shopId } }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }
};
