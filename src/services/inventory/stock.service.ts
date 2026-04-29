import { db } from '@/lib/db';
import {
  RequestContext,
  ServiceError,
  StockMovement,
  StockAvailability,
  MutationResult
} from '@/types/domain';
import { IStockService } from '@/types/service-contracts';
import { AuditService } from '@/services/core/system/audit.service';
import { STOCK_AUDIT_POLICIES } from '@/policies/inventory/stock.policy';
import { Prisma } from '@prisma/client';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import { StockEngine } from '@/services/inventory/stock-engine.service';

export interface CreateStockMovementParams {
  productId: string;
  type: StockMovement;
  quantity: number;
  warehouseId?: string | null;
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
      warehouseId,
      note,
      saleId,
      purchaseId,
      deliveryOrderId,
      returnId,
      tx,
    } = params;

    const result = await AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.MOVE(productId, type as any, quantity, note),
      async () => {
        // Resolve warehouse
        const resolvedWhId = await StockEngine.resolveWarehouse(ctx, warehouseId || undefined, tx);

        // Delegate to StockEngine (SSOT)
        const moveResult = await StockEngine.executeMovement(ctx, {
          productId,
          warehouseId: resolvedWhId,
          delta: quantity,
          type: type as any,
          note,
          saleId,
          purchaseId,
          deliveryOrderId,
          returnId,
          referenceId: params.referenceId,
          referenceType: params.referenceType
        }, tx);

        return moveResult;
      },
      tx
    );

    return {
      data: result,
      affectedTags: [INVENTORY_TAGS.STOCK(productId), INVENTORY_TAGS.LIST, INVENTORY_TAGS.DETAIL(productId)]
    };
  },

  /**
   * จองสต็อกสินค้า (เมื่อ Sale เปลี่ยนสถานะเป็น CONFIRMED)
   */
  async reserveStock(productId: string, quantity: number, ctx: RequestContext, tx: Prisma.TransactionClient, warehouseId?: string | null): Promise<any> {
    const result = await this.recordMovement(ctx, {
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

  /**
   * ปล่อยการจอง (เมื่อ Sale ถูก Cancel ก่อนส่งของ)
   */
  async releaseStock(productId: string, quantity: number, ctx: RequestContext, tx: Prisma.TransactionClient, warehouseId?: string | null): Promise<any> {
    const result = await this.recordMovement(ctx, {
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

  /**
   * ตัดสต็อกจริงเมื่อส่งสินค้า
   */
  async deductStock(productId: string, quantity: number, ctx: RequestContext, tx?: Prisma.TransactionClient, docRef?: { saleId?: string; deliveryOrderId?: string }, warehouseId?: string | null): Promise<any> {
    const result = await this.recordMovement(ctx, {
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

  /**
   * ดึงสถานะสต็อกแบบ Real-time (Business-Ready)
   *
   * 🛡️  SSOT: Query จาก WarehouseStock โดยตรง ไม่ใช้ Product.stock (Cache)
   *     ใช้ฟังก์ชันนี้ก่อนตัดสินใจทุก Business Action เช่น ตรวจก่อนขาย
   */
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

    // Aggregate จาก WarehouseStock ทุกคลัง (SSOT)
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

  /**
   * ตรวจสอบสต็อกหลายรายการพร้อมกัน (ก่อนสร้างบิลขาย)
   *
   * 🛡️  SSOT: Aggregate จาก WarehouseStock โดยตรง ไม่ใช้ Product.stock (Cache)
   *     เพื่อความแม่นยำสูงสุดก่อน Deduct สต็อกจริง
   */
  async checkBulkAvailability(
    items: Array<{ productId: string; quantity: number }>,
    shopId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ allAvailable: boolean; shortages: Array<{ productId: string; required: number; available: number }> }> {
    const executor = tx || db;
    const productIds = Array.from(new Set(items.map(i => i.productId)));

    // Query WarehouseStock ทุก Row ของทุก productId (SSOT)
    const warehouseStocks = await (executor as any).warehouseStock.findMany({
      where: { productId: { in: productIds }, shopId },
      select: { productId: true, quantity: true, reservedStock: true },
    });

    // Aggregate ต่อ productId: SUM(quantity) และ SUM(reservedStock)
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
  },

  async bulkReserveStock(items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const movements = items.map(item => ({
      productId: item.productId,
      warehouseId: item.warehouseId,
      type: 'RESERVATION',
      quantity: item.quantity,
      note: 'จองสินค้าสำหรับรายการขาย (Bulk)',
    }));
    await this.recordMovements(ctx, movements, tx);
  },

  async bulkReleaseStock(items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const movements = items.map(item => ({
      productId: item.productId,
      warehouseId: item.warehouseId,
      type: 'RELEASE',
      quantity: item.quantity,
      note: 'คืนสต็อกจากการยกเลิกรายการขาย (Bulk)',
    }));
    await this.recordMovements(ctx, movements, tx);
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
    await this.recordMovements(ctx, movements, tx);
  },

  async recordMovements(
    ctx: RequestContext,
    movements: Array<{
      productId: string;
      warehouseId?: string | null;
      type: any;
      quantity: number;
      validation?: any;
      note?: string;
      saleId?: string;
      purchaseId?: string;
      deliveryOrderId?: string;
      returnId?: string;
      referenceId?: string;
      referenceType?: string;
    }>,
    tx: Prisma.TransactionClient
  ): Promise<MutationResult<void>> {
    if (movements.length === 0) return { data: undefined, affectedTags: [] };

    await AuditService.runWithAudit(
      ctx,
      {
        action: 'STOCK_BULK_PROCESS',
        targetType: 'Stock',
        note: `ประมวลผลสต็อกจำนวน ${movements.length} รายการ`,
      },
      async () => {
        // Wrap everything in StockEngine bulk process for warehouse-consistent logic
        await StockEngine.executeBulkMovements(ctx, movements.map(m => ({
          productId: m.productId,
          warehouseId: m.warehouseId as string, // Might be null/undefined, engine will resolve
          delta: m.quantity,
          type: m.type,
          validation: m.validation, // Propagate validation mode
          note: m.note,
          saleId: m.saleId,
          purchaseId: m.purchaseId,
          deliveryOrderId: m.deliveryOrderId,
          returnId: m.returnId,
          referenceId: m.referenceId,
          referenceType: m.referenceType
        })), tx);
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
        include: {
          warehouse: { select: { name: true } },
          user: { select: { name: true } }
        },
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
