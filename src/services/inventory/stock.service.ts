import { db, runInTransaction } from '@/lib/db';
import {
  RequestContext,
  ServiceError,
  StockMovement,
  DocumentType,
  StockAvailability,
  MutationResult
} from '@/types/domain';
import { IStockService } from '@/types/service-contracts';
import { SequenceService } from '@/services/core/system/sequence.service';
import { AuditService } from '@/services/core/system/audit.service';
import { STOCK_AUDIT_POLICIES } from '@/policies/inventory/stock.policy';
import { Prisma } from '@prisma/client';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { INVENTORY_TAGS } from '@/config/cache-tags';

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
  async recordMovement(ctx: RequestContext, params: CreateStockMovementParams): Promise<MutationResult<any>> {
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

    const result = await AuditService.runWithAudit(
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
        let newStock = Number(product.stock);
        let newReserved = Number(product.reservedStock || 0);

        // Logic ตามความหมายทางธุรกิจของ ERP
        switch (type) {
          case 'PURCHASE': // รับเข้าจากใบสั่งซื้อ
          case 'RETURN': // รับเข้าจากการคืนสินค้า
            newStock += quantity;
            break;

          case 'CANCEL': // จ่ายออกทั่วไป
          case 'SALE_CANCEL' as any: // In case of cancel sale
            newStock += quantity;
            break;

          case 'SALE': // ตัดสต็อกจากการขาย (ลด Stock, ลด Reserved)
            if (requireStock && product.stock < quantity) {
              throw new ServiceError(`สต็อกไม่เพียงพอ (คงเหลือ: ${product.stock}, ต้องการ: ${quantity})`);
            }
            newStock -= quantity;
            if (product.reservedStock >= quantity) {
              newReserved -= quantity;
            }
            break;

          case 'RESERVATION': // จองสต็อก (เพิ่ม Reserved, Stock เท่าเดิม)
            if (requireStock && (product.stock - (product.reservedStock || 0)) < quantity) {
              throw new ServiceError(`สต็อกพร้อมขายไม่เพียงพอ (คงเหลือ: ${product.stock}, จองแล้ว: ${product.reservedStock}, ต้องการจองเพิ่ม: ${quantity})`);
            }
            newReserved += quantity;
            break;

          case 'RELEASE': // ปล่อยการจอง (ลด Reserved, Stock เท่าเดิม)
            newReserved = Math.max(0, (product.reservedStock || 0) - quantity);
            break;

          default:
            if (type === 'ADJUSTMENT' as any) {
              newStock += quantity; 
              if (newStock < 0) {
                throw new ServiceError(`ไม่สามารถลดสต็อกได้ เนื่องจากสต็อกจะติดลบ (คงเหลือ: ${product.stock}, ต้องการลด: ${Math.abs(quantity)})`);
              }
            }
        }

        // Optimistic Locking
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
        const log = await (executor as any).stockLog.create({
          data: {
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
            memberId: ctx.memberId || null,
            shopId: ctx.shopId,
          } as any,
        });

        return log;
      },
      tx
    );

    return {
      data: result,
      affectedTags: [INVENTORY_TAGS.STOCK(productId), INVENTORY_TAGS.LIST]
    };
  },

  /**
   * จองสต็อกสินค้า (เมื่อ Sale เปลี่ยนสถานะเป็น CONFIRMED)
   */
  async reserveStock(productId: string, quantity: number, ctx: RequestContext, tx: Prisma.TransactionClient): Promise<any> {
    const result = await this.recordMovement(ctx, {
      productId,
      type: 'RESERVATION',
      quantity,
      note: 'จองสินค้าสำหรับรายการขาย',
      ctx,
      tx,
    });
    return result.data;
  },

  /**
   * ปล่อยการจอง (เมื่อ Sale ถูก Cancel ก่อนส่งของ)
   */
  async releaseStock(productId: string, quantity: number, ctx: RequestContext, tx: Prisma.TransactionClient): Promise<any> {
    const result = await this.recordMovement(ctx, {
      productId,
      type: 'RELEASE',
      quantity,
      note: 'คืนสต็อกจากการยกเลิกรายการขาย',
      ctx,
      tx,
      requireStock: false,
    });
    return result.data;
  },

  /**
   * ตัดสต็อกจริงเมื่อส่งสินค้า
   */
  async deductStock(productId: string, quantity: number, ctx: RequestContext, tx?: Prisma.TransactionClient, docRef?: { saleId?: string; deliveryOrderId?: string }): Promise<any> {
    const result = await this.recordMovement(ctx, {
      productId,
      type: 'SALE',
      quantity,
      saleId: docRef?.saleId,
      deliveryOrderId: docRef?.deliveryOrderId,
      note: `ตัดสต็อกสำหรับรายการขาย`,
      ctx,
      tx,
    });
    return result.data;
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

  async checkBulkAvailability(
    items: Array<{ productId: string; quantity: number }>,
    shopId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ allAvailable: boolean; shortages: Array<{ productId: string; required: number; available: number }> }> {
    const executor = tx || db;
    const productIds = Array.from(new Set(items.map(i => i.productId)));

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

  async recordMovements(ctx: RequestContext, movements: any[], tx: Prisma.TransactionClient): Promise<MutationResult<void>> {
    if (movements.length === 0) return { data: undefined, affectedTags: [] };

    await AuditService.runWithAudit(
      ctx,
      {
        action: 'STOCK_BULK_PROCESS',
        targetType: 'Stock',
        note: `ประมวลผลสต็อกจำนวน ${movements.length} รายการ`,
      },
      async () => {
        const productIds = Array.from(new Set(movements.map(m => m.productId)));
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, stock: true, reservedStock: true, minStock: true, shopId: true, version: true },
        });

        const productMap = new Map(products.map(p => [p.id, p]));

        for (const movement of movements) {
          const { productId, type, quantity } = movement;
          const product = productMap.get(productId);
          if (!product) continue;

          let newStock = Number(product.stock);
          let newReserved = Number(product.reservedStock || 0);

          switch (type) {
            case 'RESERVATION': newReserved += quantity; break;
            case 'RELEASE': newReserved = Math.max(0, newReserved - quantity); break;
            case 'SALE':
              newStock -= quantity;
              if (newReserved >= quantity) newReserved -= quantity;
              break;
            case 'PURCHASE':
            case 'RETURN':
            case 'SALE_CANCEL':
              newStock += quantity;
              break;
            default: newStock += quantity;
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

        await (tx as any).stockLog.createMany({
          data: movements.map(m => ({
            ...m,
            memberId: ctx.memberId || null,
            shopId: ctx.shopId,
            userId: ctx.userId,
            balance: productMap.get(m.productId)!.stock
          })) as any,
        });
      },
      tx
    );

    const affectedTags = Array.from(new Set(movements.map(m => INVENTORY_TAGS.STOCK(m.productId))));
    affectedTags.push(INVENTORY_TAGS.LIST);

    return {
      data: undefined,
      affectedTags
    };
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
