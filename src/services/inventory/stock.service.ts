import { db, runInTransaction } from '@/lib/db';
import {
  RequestContext,
  ServiceError,
  StockMovement,
  DocumentType,
  StockAvailability,
} from '@/types/domain';
import { IStockService } from '@/types/service-contracts';
import { SequenceService } from '@/services/core/sequence.service';
import { AuditService } from '@/services/core/audit.service';
import { STOCK_AUDIT_POLICIES } from './stock.policy';
import { Prisma } from '@prisma/client';

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
          select: { stock: true, reservedStock: true, shopId: true },
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
            }
        }

        // อัปเดตสต็อกที่สินค้า
        await executor.product.update({
          where: { id: productId },
          data: {
            stock: newStock,
            reservedStock: newReserved,
            isLowStock: newStock <= 5, // Simple threshold logic
          },
        });

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
      }
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

  async recordMovements(ctx: RequestContext, movements: any[], tx: Prisma.TransactionClient) {
    const created = await (tx as any).stockLog.createMany({
      data: movements.map(l => ({ ...l, memberId: ctx.memberId || null, shopId: ctx.shopId, userId: ctx.userId })) as any,
    });

    // Simple bulk update for low stock flag (could be optimized)
    const productIds = Array.from(new Set(movements.map(l => l.productId)));
    for (const pid of productIds) {
      const p = await tx.product.findUnique({ where: { id: pid }, select: { stock: true } });
      if (p) {
        await tx.product.update({
          where: { id: pid },
          data: { isLowStock: p.stock <= 5 }
        });
      }
    }
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
