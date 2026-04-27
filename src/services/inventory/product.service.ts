import { db, runInTransaction } from '@/lib/db';
import { ProductInput } from '@/schemas/inventory/product.schema';
import { StockService } from '@/services/inventory/stock.service';
import { WarehouseService } from '@/services/inventory/warehouse.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { AuditService } from '@/services/core/system/audit.service';
import { Prisma, Product } from '@prisma/client';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';

import {
  RequestContext,
  ServiceError,
  PaginatedResult,
  GetProductsParams,
  BatchProductInput,
  BatchCreateResult,
  StockAvailability,
  SerializedProduct,
  AdjustStockInput,
  MutationResult
} from '@/types/domain';
import { PRODUCT_AUDIT_POLICIES } from '@/policies/inventory/product.policy';
import { STOCK_AUDIT_POLICIES } from '@/policies/inventory/stock.policy';
import { serializeProduct } from '@/lib/mappers';
import { IProductService } from '@/types/service-contracts';
import { INVENTORY_TAGS } from '@/config/cache-tags';

/**
 * @module ProductService
 */

export const ProductService: IProductService = {
  /**
   * สร้างสินค้าใหม่ พร้อมตั้งค่าสต็อกเริ่มต้น
   */
  async create(ctx: RequestContext, payload: ProductInput, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedProduct>> {
    return AuditService.runWithAudit(
      ctx,
      PRODUCT_AUDIT_POLICIES.CREATE(payload.name),
      async () => {
        const product = await runInTransaction(tx, async (prisma) => {
          if (payload.sku) {
            const existing = await prisma.product.findFirst({
              where: { sku: payload.sku, shopId: ctx.shopId, isActive: true },
            });
            if (existing) throw new ServiceError('รหัสสินค้า (SKU) นี้มีอยู่แล้ว', { sku: ['SKU นี้มีอยู่แล้ว'] });
          }

          const newProduct = await prisma.product.create({
            data: {
              ...payload,
              stock: 0,
              description: payload.description || null,
              sku: payload.sku || null,
              isActive: payload.isActive ?? payload.isSaleable ?? true,
              isSaleable: payload.isSaleable ?? payload.isActive ?? true,
              metadata: (payload.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              userId: ctx.userId,
              memberId: ctx.memberId || null,
              shopId: ctx.shopId,
            } as any,
          });

          const initialStock = payload.stock ?? 0;
          if (initialStock > 0) {
            const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
            await StockEngine.executeMovement(ctx, {
              warehouseId: whId,
              productId: newProduct.id,
              delta: initialStock,
              type: 'ADJUSTMENT',
              note: 'Initial Stock (Genesis)'
            }, prisma);
          }

          return newProduct;
        });

        return {
          data: serializeProduct(product),
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.SELECT]
        };
      }
    );
  },

  /**
   * แก้ไขข้อมูลสินค้า พร้อมจัดการประวัติสต็อกด้วย Optimistic Locking
   * SSOT: Atomic Snapshotting inside transaction to prevent TOCTOU race.
   */
  async update(id: string, ctx: RequestContext, payload: Partial<ProductInput> & { version?: number }, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedProduct>> {
    return AuditService.runWithAudit(
      ctx,
      {
        ...PRODUCT_AUDIT_POLICIES.UPDATE(id, 'Product Update'),
      },
      async () => {
        const product = await runInTransaction(tx, async (prisma) => {
          // 1. Atomic Load (Check & Snapshot)
          const existingP = await prisma.product.findFirst({
            where: { id, shopId: ctx.shopId, deletedAt: null },
          });
          if (!existingP) throw new ServiceError('ไม่พบสินค้า');

          // Attach before snapshot for audit
          (ctx as any).auditMetadata = { before: existingP };

          // 2. Validate version
          if (payload.version !== undefined && payload.version !== existingP.version) {
            throw new ServiceError('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชแล้วลองใหม่');
          }

          // 3. SKU uniqueness
          if (payload.sku && payload.sku !== existingP.sku) {
            const duplicate = await prisma.product.findFirst({
              where: { sku: payload.sku, shopId: ctx.shopId, id: { not: id } },
              select: { id: true },
            });
            if (duplicate) throw new ServiceError('รหัสสินค้า (SKU) นี้มีอยู่แล้ว');
          }

          // 4. Stock adjustment logic
          if (payload.stock !== undefined && payload.stock !== existingP.stock) {
            const diff = payload.stock - existingP.stock;
            const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
            await StockEngine.executeMovement(ctx, {
              warehouseId: whId,
              productId: id,
              delta: diff,
              type: 'ADJUSTMENT',
              note: `Product Update (Manual stock override)`
            }, prisma);
          }

          const { stock, version, ...otherData } = payload;
          const currentStock = payload.stock !== undefined ? payload.stock : existingP.stock;
          const currentMinStock = otherData.minStock !== undefined ? otherData.minStock : existingP.minStock;

          try {
            const updatedProduct = await prisma.product.update({
              where: { id, version: existingP.version },
              data: {
                ...otherData,
                description: otherData.description || null,
                ...(otherData.sku !== undefined ? { sku: otherData.sku || null } : {}),
                isActive: otherData.isActive ?? (otherData.isSaleable !== undefined ? otherData.isSaleable : existingP.isActive),
                isSaleable: otherData.isSaleable ?? (otherData.isActive !== undefined ? otherData.isActive : existingP.isSaleable),
                metadata: otherData.metadata === null ? Prisma.JsonNull : (otherData.metadata as Prisma.InputJsonValue),
                isLowStock: currentStock <= (currentMinStock ?? 0),
                version: { increment: 1 },
              },
            });
            
            // Attach after snapshot for audit
            (ctx as any).auditMetadata.after = updatedProduct;
            
            return updatedProduct;
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
              throw new ServiceError('ข้อมูลถูกแก้ไขพร้อมกันโดยผู้ใช้อื่น กรุณารีเฟรชแล้วลองใหม่ (Concurrent Conflict)');
            }
            throw e;
          }
        });

        return {
          data: serializeProduct(product),
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.DETAIL(id), INVENTORY_TAGS.STOCK(id)]
        };
      }
    );
  },

  /**
   * ดึงข้อมูลสินค้าโดยรหัส (Read)
   */
  async getById(id: string, ctx: RequestContext): Promise<SerializedProduct> {
    const product = await db.product.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: {
        warehouseStocks: {
          include: { warehouse: true }
        }
      }
    });
    if (!product) throw new ServiceError('ไม่พบสินค้า');
    return serializeProduct(product);
  },

  /**
   *ดึงข้อมูลความพร้อมของสต็อก (Stock Availability)
   */
  async getAvailability(id: string, ctx: RequestContext): Promise<StockAvailability> {
    const product = await db.product.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      select: { stock: true, reservedStock: true, minStock: true, isLowStock: true },
    });
    if (!product) throw new ServiceError('ไม่พบสินค้า');
    return {
      onHand: product.stock,
      reserved: product.reservedStock,
      available: product.stock - product.reservedStock,
      isLowStock: product.isLowStock,
      minStock: product.minStock,
    };
  },

  /**
   * ดึงข้อมูลสินค้า (แสดงผลแบบ List / Pagination)
   */
  async getList(params: GetProductsParams = {}, ctx: RequestContext): Promise<PaginatedResult<SerializedProduct>> {
    const { page = 1, limit = 20, search, category, sortBy = 'createdAt', sortOrder = 'desc', lowStockOnly = false } = params;
    const searchFilter = buildSearchFilter(search, ['name', 'sku', 'description']);
    const whereClause = {
      shopId: ctx.shopId,
      deletedAt: null,
      ...(searchFilter && searchFilter),
      ...(category && { category }),
      ...(lowStockOnly && { isLowStock: true }),
    };
    const result = await paginatedQuery<Product>(db.product, {
      where: whereClause,
      page,
      limit,
      orderBy: { [sortBy]: sortOrder },
    });
    return {
      ...result,
      data: result.data.map(product => serializeProduct(product))
    };
  },

  /**
   * ลบสินค้าแบบ Soft Delete (Archive)
   */
  async delete(id: string, ctx: RequestContext): Promise<MutationResult<void>> {
    const existing = await db.product.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!existing) throw new ServiceError('ไม่พบสินค้า');

    return AuditService.runWithAudit(
      ctx,
      {
        ...PRODUCT_AUDIT_POLICIES.DELETE(id, existing.name),
        beforeSnapshot: () => existing,
      },
      async () => {
        await db.product.update({
          where: { id },
          data: { isActive: false, deletedAt: new Date() },
        });

        return {
          data: undefined,
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.SELECT, INVENTORY_TAGS.DETAIL(id)]
        };
      }
    );
  },

  /**
   * ดึงข้อมูลรายการสินค้าแบบสั้นสำหรับหน้าขาย (เฉพาะที่มีสต็อก > 0)
   */
  async getForSelect(ctx: RequestContext): Promise<SerializedProduct[]> {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null, stock: { gt: 0 } },
      orderBy: { name: 'asc' },
    });
    return products.map(p => serializeProduct(p));
  },

  /**
   * ดึงข้อมูลรายการสินค้าสำหรับหน้าซื้อเข้า (ทุกชิ้น ไม่สนสต็อก)
   */
  async getForPurchase(ctx: RequestContext): Promise<SerializedProduct[]> {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return products.map(p => serializeProduct(p));
  },

  /**
   * แจ้งเตือนสินค้าเหลือน้อยแบบสั้น (ใช้ Dashboard)
   */
  async getLowStock(limit: number = 5, ctx: RequestContext): Promise<SerializedProduct[]> {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null, isLowStock: true },
      orderBy: { stock: 'asc' },
      take: limit,
    });
    return products.map(p => serializeProduct(p));
  },

  /**
   * ดึงรายการสินค้าเหลือน้อย (พร้อม Pagination)
   */
  async getLowStockPaginated(params: GetProductsParams = {}, ctx: RequestContext): Promise<PaginatedResult<SerializedProduct>> {
    const { page = 1, limit = 20, search, category } = params;
    const searchFilter = buildSearchFilter(search, ['name', 'sku']);
    const whereClause = {
      shopId: ctx.shopId,
      isActive: true,
      deletedAt: null,
      isLowStock: true,
      ...(searchFilter && searchFilter),
      ...(category && { category }),
    };
    const result = await paginatedQuery<Product>(db.product, {
      where: whereClause,
      page,
      limit,
      orderBy: { stock: 'asc' },
    });
    return {
      ...result,
      data: result.data.map(p => serializeProduct(p))
    };
  },

  /**
   * ปรับปรุงเลขสต็อกแบบ Manual
   * SSOT: Atomic snapshotting inside transaction.
   */
  async adjustStockManual(productId: string, input: AdjustStockInput, ctx: RequestContext): Promise<MutationResult<void>> {
    return AuditService.runWithAudit(
      ctx,
      {
        ...STOCK_AUDIT_POLICIES.MANUAL_ADJUST('', input.type, input.quantity, input.description),
      },
      async () => {
        await runInTransaction(undefined, async (prisma) => {
          // 1. Atomic Load for Snapshot
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, stock: true, shopId: true, name: true, reservedStock: true, minStock: true },
          });

          if (!product || product.shopId !== ctx.shopId) throw new ServiceError('ไม่พบสินค้า');
          
          // Attach for Audit
          (ctx as any).auditMetadata = { before: product };

          let change = 0;
          let notePrefix = '';

          switch (input.type) {
            case 'ADD':
              change = input.quantity;
              notePrefix = '[Manual Add]';
              break;
            case 'REMOVE':
              if (input.quantity > product.stock) {
                throw new ServiceError(`สต็อกไม่เพียงพอ (คงเหลือ: ${product.stock}, ต้องการลด: ${input.quantity})`);
              }
              change = -input.quantity;
              notePrefix = '[Manual Remove]';
              break;
            case 'SET':
              change = input.quantity - product.stock;
              notePrefix = '[Manual Set]';
              if (change < 0 && product.stock + change < 0) {
                throw new ServiceError(`ค่าที่ตั้งต่ำกว่า 0 ไม่ได้รับอนุญาต`);
              }
              break;
          }

          if (change !== 0) {
            const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
            await StockEngine.executeMovement(ctx, {
              warehouseId: whId,
              productId: productId,
              delta: change,
              type: 'ADJUSTMENT',
              note: `${notePrefix} ${input.description}`
            }, prisma);
          }
          
          // Capture After
          const after = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, stock: true, shopId: true, name: true, reservedStock: true, minStock: true },
          });
          (ctx as any).auditMetadata.after = after;
        });

        return {
          data: undefined,
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.DETAIL(productId), INVENTORY_TAGS.STOCK(productId)]
        };
      }
    );
  },

  /**
   * สร้างสิงค้าหลายรายการพร้อมกัน (Batch Create/Upsert)
   */
  async batchCreate(inputs: BatchProductInput[], ctx: RequestContext): Promise<MutationResult<BatchCreateResult>> {
    if (!inputs || inputs.length === 0) throw new ServiceError('ไม่มีข้อมูลสินค้าที่จะสร้าง');

    return AuditService.runWithAudit(
      ctx,
      PRODUCT_AUDIT_POLICIES.BATCH_CREATE(inputs.length),
      async () => {
        const validInputs: BatchProductInput[] = [];
        const failed: BatchCreateResult['failed'] = [];

        for (const input of inputs) {
          if (!input.name || !input.name.trim()) {
            failed.push({ name: input.name || 'ไม่มีชื่อ', error: 'ไม่มีชื่อสินค้า' });
            continue;
          }
          if (!input.category || !input.category.trim()) {
            failed.push({ name: input.name, error: 'ไม่มีหมวดหมู่' });
            continue;
          }
          validInputs.push({
            name: input.name.trim(),
            sku: input.sku?.trim() || null,
            category: input.category.trim(),
            costPrice: input.costPrice || 0,
            salePrice: input.salePrice || 0,
            stock: input.stock,
            minStock: input.minStock,
          });
        }

        if (validInputs.length === 0) return { data: { created: [], failed }, affectedTags: [] };

        const result = await runInTransaction(undefined, async (prisma) => {
          const created: BatchCreateResult['created'] = [];
          const seenSkus = new Set<string>();
          for (const input of validInputs) {
            if (input.sku) {
              const normalizedSku = input.sku.toLowerCase();
              if (seenSkus.has(normalizedSku)) {
                input.sku = null;
              } else {
                seenSkus.add(normalizedSku);
              }
            }
          }

          const skusToCheck = validInputs.filter(i => i.sku).map(i => i.sku as string);
          let existingSkuMap = new Map();
          if (skusToCheck.length > 0) {
            const existing = await db.product.findMany({
              where: { shopId: ctx.shopId, sku: { in: skusToCheck, mode: 'insensitive' } },
              select: { id: true, sku: true, isActive: true },
            });
            existingSkuMap = new Map(existing.map(p => [p.sku?.toLowerCase(), p]));
          }

          for (const input of validInputs) {
            const skuKey = input.sku?.toLowerCase();
            const existingProduct = skuKey ? existingSkuMap.get(skuKey) : null;

            if (existingProduct) {
              const current = await prisma.product.findUnique({
                where: { id: existingProduct.id },
                select: { stock: true },
              });

              const updated = await prisma.product.update({
                where: { id: existingProduct.id },
                data: {
                  name: input.name,
                  category: input.category,
                  costPrice: input.costPrice,
                  salePrice: input.salePrice,
                  ...(input.minStock !== undefined && { minStock: input.minStock }),
                  isActive: true,
                  deletedAt: null,
                },
              });

              if (input.stock !== undefined && current && input.stock !== current.stock) {
                const diff = input.stock - current.stock;
                const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
                await StockEngine.executeMovement(ctx, {
                  warehouseId: whId,
                  productId: updated.id,
                  delta: diff,
                  type: 'ADJUSTMENT',
                  note: `[Batch Import] ปรับสต็อก: ${input.name}`
                }, prisma);
              }

              created.push({ id: updated.id, name: updated.name, costPrice: Number(updated.costPrice) });
            } else {
              const createdP = await prisma.product.create({
                data: {
                  name: input.name,
                  sku: input.sku,
                  category: input.category,
                  costPrice: input.costPrice,
                  salePrice: input.salePrice,
                  stock: 0,
                  minStock: input.minStock ?? 5,
                  userId: ctx.userId,
                  shopId: ctx.shopId,
                },
              });

              const initialStock = input.stock ?? 0;
              if (initialStock > 0) {
                const whId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
                await StockEngine.executeMovement(ctx, {
                  warehouseId: whId,
                  productId: createdP.id,
                  delta: initialStock,
                  type: 'ADJUSTMENT',
                  note: `[Batch Import] สต็อกเริ่มต้น: ${input.name}`
                }, prisma);
              }

              created.push({ id: createdP.id, name: createdP.name, costPrice: Number(createdP.costPrice) });
            }
          }
          return { created, failed };
        });

        return {
          data: result,
          affectedTags: [INVENTORY_TAGS.LIST, INVENTORY_TAGS.SELECT]
        };
      }
    );
  }
};
