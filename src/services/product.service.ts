import { db, runInTransaction } from '@/lib/db';
import { ProductInput } from '@/schemas/product';
import { StockService } from './stock.service';
import { AuditService } from './audit.service';
import { Prisma, Product } from '@prisma/client';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';

import { 
  RequestContext, 
  ServiceError, 
  GetProductsParams, 
  BatchProductInput, 
  BatchCreateResult,
  StockAvailability
} from '@/types/domain';
import { IProductService } from '@/types/service-contracts';

import { STOCK_AUDIT_POLICIES } from './stock.policy';
import { PRODUCT_AUDIT_POLICIES } from './product.policy';

export const ProductService: IProductService = {
  /**
   * สร้างสินค้าใหม่ พร้อมตั้งค่าสต็อกเริ่มต้น
   */
  async create(ctx: RequestContext, payload: ProductInput, tx?: Prisma.TransactionClient) {
    return AuditService.runWithAudit(
      ctx,
      PRODUCT_AUDIT_POLICIES.CREATE(payload.name),
      async () => {
        return runInTransaction(tx, async (prisma) => {
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
              shopId: ctx.shopId,
            },
          });

          const initialStock = payload.stock ?? 0;
          if (initialStock > 0) {
            await StockService.recordMovement(ctx, {
              productId: newProduct.id,
              type: 'ADJUSTMENT',
              quantity: initialStock,
              userId: ctx.userId,
              shopId: ctx.shopId,
              note: 'สต็อกเริ่มต้น (สร้างสินค้าใหม่)',
              tx: prisma,
            });
          }

          return { ...newProduct, costPrice: Number(newProduct.costPrice), salePrice: Number(newProduct.salePrice) };
        });
      }
    );
  },

  /**
   * แก้ไขข้อมูลสินค้า พร้อมจัดการประวัติสต็อกด้วย Optimistic Locking
   */
  async update(id: string, ctx: RequestContext, payload: Partial<ProductInput> & { version?: number }, tx?: Prisma.TransactionClient) {
    const p = await db.product.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!p) throw new ServiceError('ไม่พบสินค้า');

    return AuditService.runWithAudit(
      ctx,
      {
        ...PRODUCT_AUDIT_POLICIES.UPDATE(id, p.name),
        beforeSnapshot: () => p,
        afterSnapshot: () => db.product.findFirst({ where: { id } }),
      },
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const existing = await prisma.product.findFirst({ where: { id, shopId: ctx.shopId } });
          if (!existing) throw new ServiceError('ไม่พบสินค้า');
          if (payload.version !== undefined && payload.version !== existing.version) {
            throw new ServiceError('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชแล้วลองใหม่');
          }

          if (payload.sku && payload.sku !== existing.sku) {
            const duplicate = await prisma.product.findFirst({ where: { sku: payload.sku, shopId: ctx.shopId, id: { not: id } } });
            if (duplicate) throw new ServiceError('รหัสสินค้า (SKU) นี้มีอยู่แล้ว');
          }

          if (payload.stock !== undefined && payload.stock !== existing.stock) {
            const diff = payload.stock - existing.stock;
            await StockService.recordMovement(ctx, {
              productId: id,
              type: 'ADJUSTMENT',
              quantity: diff,
              userId: ctx.userId,
              shopId: ctx.shopId,
              note: 'ปรับปรุงสต็อก (แก้ไขสินค้า)',
              tx: prisma,
            });
          }

          const { stock, version, ...otherData } = payload;
          const updatedProduct = await prisma.product.update({
            where: { id },
            data: {
              ...otherData,
              description: otherData.description || null,
              ...(otherData.sku !== undefined ? { sku: otherData.sku || null } : {}),
              isActive: otherData.isActive ?? (otherData.isSaleable !== undefined ? otherData.isSaleable : existing.isActive),
              isSaleable: otherData.isSaleable ?? (otherData.isActive !== undefined ? otherData.isActive : existing.isSaleable),
              metadata: otherData.metadata === null ? Prisma.JsonNull : (otherData.metadata as Prisma.InputJsonValue),
              version: { increment: 1 },
            },
          });

          if (payload.minStock !== undefined) {
            const isLow = updatedProduct.stock <= updatedProduct.minStock;
            await prisma.product.update({ where: { id }, data: { isLowStock: isLow } });
            updatedProduct.isLowStock = isLow;
          }

          return { ...updatedProduct, costPrice: Number(updatedProduct.costPrice), salePrice: Number(updatedProduct.salePrice) };
        });
      }
    );
  },

  /**
   * ดึงข้อมูลสินค้าโดยรหัส (Read)
   */
  async getById(id: string, ctx: RequestContext) {
    const product = await db.product.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });
    if (!product) throw new ServiceError('ไม่พบสินค้า');
    return { ...product, costPrice: Number(product.costPrice), salePrice: Number(product.salePrice) };
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
  async getList(params: GetProductsParams = {}, ctx: RequestContext) {
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
      data: result.data.map(product => ({ ...product, costPrice: Number(product.costPrice), salePrice: Number(product.salePrice) }))
    };
  },

  /**
   * ลบสินค้าแบบ Soft Delete
   */
  async delete(id: string, ctx: RequestContext) {
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
      }
    );
  },

  /**
   * ดึงข้อมูลรายการสินค้าแบบสั้นสำหรับหน้าขาย (เฉพาะที่มีสต็อก > 0)
   */
  async getForSelect(ctx: RequestContext) {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null, stock: { gt: 0 } },
      select: { id: true, name: true, sku: true, salePrice: true, costPrice: true, stock: true, reservedStock: true },
      orderBy: { name: 'asc' },
    });
    return products.map(p => ({ ...p, salePrice: Number(p.salePrice), costPrice: Number(p.costPrice) }));
  },

  /**
   * ดึงข้อมูลรายการสินค้าสำหรับหน้าซื้อเข้า (ทุกชิ้น ไม่สนสต็อก)
   */
  async getForPurchase(ctx: RequestContext) {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null },
      select: { id: true, name: true, sku: true, salePrice: true, costPrice: true, stock: true, reservedStock: true },
      orderBy: { name: 'asc' },
    });
    return products.map(p => ({ ...p, salePrice: Number(p.salePrice), costPrice: Number(p.costPrice) }));
  },

  /**
   * แจ้งเตือนสินค้าเหลือน้อยแบบสั้น (ใช้ Dashboard)
   */
  async getLowStock(limit: number = 5, ctx: RequestContext) {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null, isLowStock: true },
      orderBy: { stock: 'asc' },
      take: limit,
    });
    return products.map(p => ({ ...p, stock: Number(p.stock), minStock: Number(p.minStock) }));
  },

  /**
   * ดึงรายการสินค้าเหลือน้อย (พร้อม Pagination)
   */
  async getLowStockPaginated(params: GetProductsParams = {}, ctx: RequestContext) {
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
      data: result.data.map(p => ({ ...p, costPrice: Number(p.costPrice), salePrice: Number(p.salePrice) }))
    };
  },

  /**
   * ปรับปรุงเลขสต็อกแบบ Manual
   */
  async adjustStockManual(productId: string, input: { type: 'ADD'|'REMOVE'|'SET', quantity: number, note: string }, ctx: RequestContext) {
    const productRef = await db.product.findFirst({ where: { id: productId, shopId: ctx.shopId } });
    if (!productRef) throw new ServiceError('ไม่พบสินค้า');

    return AuditService.runWithAudit(
      ctx,
      STOCK_AUDIT_POLICIES.MANUAL_ADJUST(productRef.name, input.type, input.quantity, input.note),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, stock: true, shopId: true, name: true },
          });

          if (!product || product.shopId !== ctx.shopId) throw new ServiceError('ไม่พบสินค้า');

          const stockBefore = product.stock;
          let change = 0;
          let notePrefix = '';

          switch (input.type) {
            case 'ADD':
              change = input.quantity;
              notePrefix = '[Manual Add]';
              break;
            case 'REMOVE':
              change = -input.quantity;
              notePrefix = '[Manual Remove]';
              break;
            case 'SET':
              change = input.quantity - product.stock;
              notePrefix = '[Manual Set]';
              break;
          }

          if (change === 0) return product;

          const updatedProduct = await StockService.recordMovement(ctx, {
            productId: productId,
            type: 'ADJUSTMENT',
            quantity: change,
            userId: ctx.userId,
            shopId: ctx.shopId,
            note: `${notePrefix} ${input.note}`,
            tx: prisma,
          });

          return { ...updatedProduct, qtyBefore: stockBefore, qtyAfter: updatedProduct.stock, changeQty: change, adjustType: input.type };
        });
      }
    );
  },

  /**
   * สร้างสิงค้าหลายรายการพร้อมกัน (Batch Create/Upsert)
   */
  async batchCreate(inputs: BatchProductInput[], ctx: RequestContext): Promise<BatchCreateResult> {
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

        if (validInputs.length === 0) return { success: true, created: [], failed };

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

        try {
          await runInTransaction(undefined, async (prisma) => {
            for (const input of validInputs) {
              const skuKey = input.sku?.toLowerCase();
              const existingProduct = skuKey ? existingSkuMap.get(skuKey) : null;

              if (existingProduct) {
                const updated = await prisma.product.update({
                  where: { id: existingProduct.id },
                  data: {
                    name: input.name,
                    category: input.category,
                    costPrice: input.costPrice,
                    salePrice: input.salePrice,
                    ...(input.stock !== undefined && { stock: input.stock }),
                    ...(input.minStock !== undefined && { minStock: input.minStock }),
                    isActive: true,
                    deletedAt: null,
                  },
                });
                created.push({ id: updated.id, name: updated.name, costPrice: Number(updated.costPrice) });
              } else {
                const createdP = await prisma.product.create({
                  data: {
                    name: input.name,
                    sku: input.sku,
                    category: input.category,
                    costPrice: input.costPrice,
                    salePrice: input.salePrice,
                    stock: input.stock ?? 0,
                    minStock: input.minStock ?? 5,
                    userId: ctx.userId,
                    shopId: ctx.shopId,
                  },
                });
                created.push({ id: createdP.id, name: createdP.name, costPrice: Number(createdP.costPrice) });
              }
            }
          });
        } catch (error: any) {
          if (error.code === 'P2002') throw new ServiceError('พบ SKU หรือชื่อซ้ำในระบบ');
          throw error;
        }

        return { success: true, created, failed };
      }
    );
  }
};
