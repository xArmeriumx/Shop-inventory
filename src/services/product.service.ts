import { db } from '@/lib/db';
import { ProductInput } from '@/schemas/product';
import { StockService } from './stock.service';
import { Prisma, Product } from '@prisma/client';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  lowStockOnly?: boolean;
}

export interface BatchProductInput {
  name: string;
  sku?: string | null;
  category: string;
  costPrice: number;
  salePrice: number;
  stock?: number;
  minStock?: number;
}

export interface BatchCreateResult {
  success: boolean;
  created: Array<{ id: string; name: string; costPrice: number }>;
  failed: Array<{ name: string; error: string }>;
}

export class ServiceError extends Error {
  constructor(message: string, public errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ServiceError';
  }
}

export interface RequestContext {
  userId: string;
  shopId: string;
}

export const ProductService = {
  /**
   * สร้างสินค้าใหม่ พร้อมตั้งค่าสต็อกเริ่มต้น
   */
  async create(ctx: RequestContext, payload: ProductInput, tx?: Prisma.TransactionClient) {
    const dbClient = tx || db;

    // 1. Business Logic: ตรวจสอบ SKU ซ้ำซ้อนภายในร้าน
    if (payload.sku) {
      const existing = await dbClient.product.findFirst({
        where: { 
          sku: payload.sku,
          shopId: ctx.shopId,
          isActive: true, // Only check active products
        },
      });
      if (existing) {
        throw new ServiceError('รหัสสินค้า (SKU) นี้มีอยู่แล้ว', { sku: ['SKU นี้มีอยู่แล้ว'] });
      }
    }

    // 2. Database Operations
    const executeTransaction = async (prismaTx: Prisma.TransactionClient) => {
      // 2.1 สร้าง Product Item
      const newProduct = await prismaTx.product.create({
        data: {
          ...payload,
          stock: 0, // ให้ stock เริ่มที่ 0 เสมอ เพราะจะถูกเพิ่มด้วย StockLog
          description: payload.description || null,
          sku: payload.sku || null,
          userId: ctx.userId,
          shopId: ctx.shopId,
        },
      });

      // 2.2 จัดการ Initial Stock ฝากให้ StockService จัดการกระแสเงิน/ของ
      const initialStock = payload.stock ?? 0;
      if (initialStock > 0) {
        await StockService.recordMovement({
          productId: newProduct.id,
          type: 'ADJUSTMENT',
          quantity: initialStock,
          userId: ctx.userId,
          shopId: ctx.shopId,
          note: 'สต็อกเริ่มต้น (สร้างสินค้าใหม่)',
          tx: prismaTx,
        });
      }

      return newProduct;
    };

    // 3. Atomicity: รับประกันว่าถ้าเป็น root call จะทำ transaction ครอบเสมอ
    if (tx) {
      return executeTransaction(tx);
    } else {
      return db.$transaction(executeTransaction);
    }
  },

  /**
   * แก้ไขข้อมูลสินค้า พร้อมจัดการประวัติสต็อกด้วย Optimistic Locking
   */
  async update(id: string, ctx: RequestContext, payload: Partial<ProductInput> & { version?: number }, tx?: Prisma.TransactionClient) {
    const dbClient = tx || db;

    // 1. ตรวจสอบความเป็นเจ้าของ/ตัวตน (Is found & scope check)
    const existing = await dbClient.product.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!existing) {
      throw new ServiceError('ไม่พบสินค้า');
    }

    // 2. Optimistic Locking Check
    if (payload.version !== undefined && payload.version !== existing.version) {
      // VERSION_CONFLICT_ERROR = 'version_conflict'
      throw new ServiceError('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชแล้วลองใหม่', { _form: ['version_conflict'] });
    }

    // 3. ตรวจสอบ SKU ซ้ำซ้อน (ถ้ามีการอัปเดต SKU ใหม่)
    if (payload.sku && payload.sku !== existing.sku) {
      const duplicate = await dbClient.product.findFirst({
        where: { 
          sku: payload.sku, 
          shopId: ctx.shopId, 
          id: { not: id } 
        },
      });
      if (duplicate) {
        throw new ServiceError('รหัสสินค้า (SKU) นี้มีอยู่แล้ว', { sku: ['SKU นี้มีอยู่แล้ว'] });
      }
    }

    // 4. Database Operations
    const executeTransaction = async (prismaTx: Prisma.TransactionClient) => {
      // 4.1 ตรวจสอบแล้วบันทึกประวัติลอจิกสต็อก หากมีการแก้ไขตัวเลขสต็อกแบบตรงๆ
      if (payload.stock !== undefined && payload.stock !== existing.stock) {
        const diff = payload.stock - existing.stock;
        await StockService.recordMovement({
          productId: id,
          type: 'ADJUSTMENT',
          quantity: diff,
          userId: ctx.userId,
          shopId: ctx.shopId,
          note: 'ปรับปรุงสต็อก (แก้ไขสินค้า)',
          tx: prismaTx,
        });
      }

      // 4.2 อัปเดตข้อมูล Metadata (หัก field `stock` และ `version` ออก ไม่เซฟทับตรงๆ)
      const { stock, version, ...otherData } = payload;
      
      const updatedProduct = await prismaTx.product.update({
        where: { id },
        data: {
          ...otherData,
          description: otherData.description || null,
          ...(otherData.sku !== undefined ? { sku: otherData.sku || null } : {}),
          version: { increment: 1 },  // Optimistic locking: ++ version เสมอเมื่อมีการเซฟ
        },
      });

      // 4.3 คำนวณ Re-Check Low Stock
      // ถ้ามีการเปลี่ยน MinStock เราควรประมวลผล LowStock แจ้งเตือนใหม่
      if (payload.minStock !== undefined) {
         const isLow = updatedProduct.stock <= updatedProduct.minStock;
         await prismaTx.product.update({
           where: { id },
           data: { isLowStock: isLow }
         });
         updatedProduct.isLowStock = isLow;
      }

      return updatedProduct;
    };

    if (tx) {
      return executeTransaction(tx);
    } else {
      return db.$transaction(executeTransaction);
    }
  },

  /**
   * ดึงข้อมูลสินค้าโดยรหัส (Read)
   */
  async getById(id: string, ctx: RequestContext) {
    const product = await db.product.findFirst({
      where: {
        id,
        shopId: ctx.shopId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new ServiceError('ไม่พบสินค้า');
    }

    return product;
  },

  /**
   * ดึงข้อมูลสินค้า (แสดงผลแบบ List / Pagination)
   */
  async getList(params: GetProductsParams = {}, ctx: RequestContext) {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      category, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      lowStockOnly = false,
    } = params;

    const searchFilter = buildSearchFilter(search, ['name', 'sku', 'description']);

    const whereClause = {
      shopId: ctx.shopId,
      isActive: true,
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
      data: result.data.map(product => ({
        ...product,
        costPrice: Number(product.costPrice),
        salePrice: Number(product.salePrice),
      }))
    };
  },

  /**
   * ลบสินค้าแบบ Soft Delete
   */
  async delete(id: string, ctx: RequestContext) {
    const existing = await db.product.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!existing) {
      throw new ServiceError('ไม่พบสินค้า');
    }

    await db.product.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  },

  /**
   * ดึงข้อมูลรายการสินค้าแบบสั้นสำหรับหน้าขาย (เฉพาะที่มีสต็อก > 0)
   */
  async getForSelect(ctx: RequestContext) {
    const products = await db.product.findMany({
      where: {
        shopId: ctx.shopId,
        isActive: true,
        deletedAt: null,
        stock: { gt: 0 }, 
      },
      select: { id: true, name: true, sku: true, salePrice: true, costPrice: true, stock: true },
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
      select: { id: true, name: true, sku: true, salePrice: true, costPrice: true, stock: true },
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
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stock: true, shopId: true },
      });
      
      if (!product || product.shopId !== ctx.shopId) {
        throw new ServiceError('ไม่พบสินค้า');
      }

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

      if (change === 0) return;

      await StockService.recordMovement({
        productId,
        type: 'ADJUSTMENT',
        quantity: change,
        userId: ctx.userId,
        shopId: ctx.shopId,
        note: `${notePrefix} ${input.note}`,
        tx,
      });
    });
  },

  /**
   * สร้างสิงค้าหลายรายการพร้อมกัน (Batch Create/Upsert)
   */
  async batchCreate(inputs: BatchProductInput[], ctx: RequestContext): Promise<BatchCreateResult> {
    if (!inputs || inputs.length === 0) {
      throw new ServiceError('ไม่มีข้อมูลสินค้าที่จะสร้าง');
    }

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

    if (validInputs.length === 0) {
      throw new ServiceError(`ข้อมูลไม่ถูกต้อง ${failed.length} รายการ`, { _batch: failed as any });
    }

    const created: BatchCreateResult['created'] = [];
    const skusToCheck = validInputs.filter(i => i.sku).map(i => i.sku as string);
    
    let existingProducts: { id: string; sku: string | null; isActive: boolean }[] = [];
    if (skusToCheck.length > 0) {
      existingProducts = await db.product.findMany({
        where: { shopId: ctx.shopId, sku: { in: skusToCheck } },
        select: { id: true, sku: true, isActive: true },
      });
    }

    const existingSkuMap = new Map(existingProducts.map(p => [p.sku, p]));

    try {
      await db.$transaction(async (tx) => {
        for (const input of validInputs) {
          const existingProduct = input.sku ? existingSkuMap.get(input.sku) : null;

          if (existingProduct) {
            const reactivated = await tx.product.update({
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
            created.push({ id: reactivated.id, name: reactivated.name, costPrice: Number(reactivated.costPrice) });
          } else {
            const newProduct = await tx.product.create({
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
            created.push({ id: newProduct.id, name: newProduct.name, costPrice: Number(newProduct.costPrice) });
          }
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ServiceError('พบ SKU หรือชื่อซ้ำในระบบ');
      }
      throw error;
    }

    return { success: true, created, failed };
  }
};
