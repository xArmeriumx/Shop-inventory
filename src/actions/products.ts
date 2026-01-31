'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission, hasPermission } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { productSchema, type ProductInput, type ProductUpdateInput } from '@/schemas/product';
import { Product } from '@prisma/client';
import { ActionResponse } from '@/types/action-response';
import { StockService } from '@/lib/stock-service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  lowStockOnly?: boolean;
}

//get product (paginated)
export async function getProducts(params: GetProductsParams = {}) {
  // RBAC: Require PRODUCT_VIEW permission for list
  const ctx = await requirePermission('PRODUCT_VIEW');
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

  const where = {
    // userId, // Removed: Scope by Shop instead
    shopId: ctx.shopId,

    isActive: true,

    ...(searchFilter && searchFilter),
    ...(category && { category }),

    ...(lowStockOnly && {
      stock: {
        lte: db.product.fields.minStock,
      },
    }),
  };

  // For lowStockOnly, we need raw SQL or a different approach
  // Simplified version without raw SQL comparison
  const whereClause = lowStockOnly
    ? {
        // userId, // Removed
        shopId: ctx.shopId,
        isActive: true,
        ...(searchFilter && searchFilter),
        ...(category && { category }),
      }
    : where;


//Paginated query
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
}

//get product by id 
export async function getProduct(id: string) {
  const ctx = await requirePermission('PRODUCT_VIEW');

  const product = await db.product.findFirst({
    where: {
      id,
      shopId: ctx.shopId,
      isActive: true,
      deletedAt: null,
    },
  });

  if (!product) {
    throw new Error('ไม่พบสินค้า');
  }

  return product;
}

//create product  
export async function createProduct(input: ProductInput): Promise<ActionResponse<Product>> {
  // RBAC: Require PRODUCT_CREATE permission
  const ctx = await requirePermission('PRODUCT_CREATE');

  // Validate input
  const validated = productSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      message: 'ข้อมูลสินค้าไม่ถูกต้อง',
      errors: validated.error.flatten().fieldErrors
    };
  }

  // Check duplicate SKU (within shop if available, otherwise global)
  if (validated.data.sku) {
    const existing = await db.product.findFirst({
      where: { 
        sku: validated.data.sku,
        shopId: ctx.shopId,
      },
    });
    if (existing) {
      return {
        success: false,
        message: 'รหัสสินค้า (SKU) นี้มีอยู่แล้ว',
        errors: { sku: ['SKU นี้มีอยู่แล้ว'] }
      };
    }
  }

  //create product  
  //table product
  try {
    const product = await db.product.create({
      data: {
        ...validated.data,
        description: validated.data.description || null,
        sku: validated.data.sku || null,
        userId: ctx.userId,
        shopId: ctx.shopId,  // RBAC: Set shopId for new records
      },
    });

    revalidatePath('/products');
    return {
      success: true,
      message: 'สร้างสินค้าสำเร็จ',
      data: product
    };
  } catch (error: any) {
    console.error('Create product error:', error);
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการสร้างสินค้า'
    };
  }
}

//update product  
export async function updateProduct(id: string, input: ProductUpdateInput): Promise<ActionResponse<Product>> {
  // RBAC: Require PRODUCT_EDIT permission
  const ctx = await requirePermission('PRODUCT_EDIT');

  // Validate input
  const validated = productSchema.partial().safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      message: 'ข้อมูลสินค้าไม่ถูกต้อง',
      errors: validated.error.flatten().fieldErrors
    };
  }

  // Check ownership by shop (RBAC scope)
  const existing = await db.product.findFirst({
    where: { id, shopId: ctx.shopId },
  });

  if (!existing) {
    return {
      success: false,
      message: 'ไม่พบสินค้า'
    };
  }

  // Check duplicate SKU (if changed) - scoped by shop
  if (validated.data.sku && validated.data.sku !== existing.sku) {
    const duplicate = await db.product.findFirst({
      where: { 
        sku: validated.data.sku, 
        shopId: ctx.shopId,  // RBAC: Scope to shop
        id: { not: id } 
      },
    });
    if (duplicate) {
      return {
        success: false,
        message: 'รหัสสินค้า (SKU) นี้มีอยู่แล้ว',
        errors: { sku: ['SKU นี้มีอยู่แล้ว'] }
      };
    }
  }


    // Transaction
    // 1. StockLog
    // 2. Update Product
    // 3. Calculate Low Stock
  try {
    const product = await db.$transaction(async (tx) => {


      // 1. Handle Stock Adjustment if changed
      if (validated.data.stock !== undefined && validated.data.stock !== existing.stock) {
        const diff = validated.data.stock - existing.stock;
        
        // เรียก StockService (ซึ่งจะ Create StockLog + Update Product ให้อัตโนมัติ)
        await StockService.recordMovement({
          productId: id,
          type: 'ADJUSTMENT',
          quantity: diff,
          userId: ctx.userId,
          shopId: ctx.shopId,  // RBAC: Set shopId for stock log
          note: 'ปรับปรุงสต็อก (แก้ไขสินค้า)',
          tx,
        });
      }

      // Step 2: อัปเดตข้อมูลอื่นๆ (ชื่อ, ราคา, หมวดหมู่)
      const { stock, ...otherData } = validated.data;
      
      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          ...otherData,
          description: otherData.description || null,
          sku: otherData.sku || null,
        },
      });

       // Step 3: Re-Check Low Stock (ถ้ามีการแก้ MinStock)
      if (validated.data.minStock !== undefined) {
         const isLow = updatedProduct.stock <= updatedProduct.minStock;
       
         // Update Low Stock Status
         await tx.product.update({
           where: { id },
           data: { isLowStock: isLow }
         });
        
         updatedProduct.isLowStock = isLow;
      }

      return updatedProduct;
    });

    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    
    return {
      success: true,
      message: 'อัปเดตสินค้าสำเร็จ',
      data: product
    };
  } catch (error: any) {
    console.error('Update product error:', error);
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการอัปเดตสินค้า'
    };
  }
}

// Delete Product (Soft Delete  )
export async function deleteProduct(id: string): Promise<ActionResponse> {
  // RBAC: Require PRODUCT_DELETE permission
  const ctx = await requirePermission('PRODUCT_DELETE');

  // Check ownership/scope
  const existing = await db.product.findFirst({
    where: { id, shopId: ctx.shopId },
  });

  if (!existing) {
    return {
      success: false,
      message: 'ไม่พบสินค้า'
    };
  }

  try {
    // Soft delete
    await db.product.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath('/products');
    return {
      success: true,
      message: 'ลบสินค้าสำเร็จ'
    };
  } catch (error: any) {
    console.error('Delete product error:', error);
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการลบสินค้า'
    };
  }
}


// Get Products for Select (แสดงสินค้าใน Select)  
// ใช้สำหรับหน้า Sale - ต้องมีสต็อกมากกว่า 0 ถึงจะขายได้
export async function getProductsForSelect() {
  const ctx = await requirePermission('PRODUCT_VIEW'); // Assume needed

  const products = await db.product.findMany({
    where: {
      shopId: ctx.shopId,
      isActive: true,
      deletedAt: null,
      stock: { gt: 0 }, // ต้องมีสต็อกมากกว่า 0 
    },
    select: {
      id: true,
      name: true,
      sku: true,
      salePrice: true, // ราคาขาย
      costPrice: true, // ราคาต้นทุน
      stock: true, // สต็อก
    },
    orderBy: { name: 'asc' },
  });
  
  // Convert Decimal to Number for Client Components
  return products.map((p) => ({
    ...p,
    salePrice: Number(p.salePrice),
    costPrice: Number(p.costPrice),
  }));
}

// Get Products for Purchase (แสดงสินค้าใน Select สำหรับหน้าซื้อสินค้า)
// ใช้สำหรับหน้า Purchase - แสดงทุกสินค้า แม้สต็อกเป็น 0 เพราะกำลังจะซื้อเพิ่ม
export async function getProductsForPurchase() {
  const ctx = await requirePermission('PRODUCT_VIEW');

  const products = await db.product.findMany({
    where: {
      shopId: ctx.shopId,
      isActive: true,
      deletedAt: null,
      // ไม่ filter by stock - แสดงทุกสินค้าเพื่อให้สั่งซื้อเพิ่มได้
    },
    select: {
      id: true,
      name: true,
      sku: true,
      salePrice: true,
      costPrice: true,
      stock: true,
    },
    orderBy: { name: 'asc' },
  });
  
  return products.map((p) => ({
    ...p,
    salePrice: Number(p.salePrice),
    costPrice: Number(p.costPrice),
  }));
}

export async function getLowStockProducts(limit: number = 5) {
  const ctx = await requirePermission('PRODUCT_VIEW');

  // Optimized: Use Cached isLowStock Field
  // Super fast, no calculation needed
  const products = await db.product.findMany({
    where: {
      shopId: ctx.shopId,
      isActive: true,
      deletedAt: null,
      isLowStock: true, // Only this!
    },
    orderBy: { stock: 'asc' },
    take: limit,
  });

  return products.map(p => ({
    ...p,
    stock: Number(p.stock),
    minStock: Number(p.minStock),
  }));
}
  
// Adjust Stock (เพิ่ม/ลดสต็อก)
interface AdjustStockInput {
  type: 'ADD' | 'REMOVE' | 'SET';
  quantity: number;
  note: string;
}

export async function adjustStock(productId: string, input: AdjustStockInput): Promise<ActionResponse> {
  // Use specific permission or PRODUCT_EDIT
  const ctx = await requirePermission('PRODUCT_EDIT'); 

  try {
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stock: true, shopId: true },
      });
      
      // Safety check: product exists and belongs to this shop
      if (!product || product.shopId !== ctx.shopId) {
        throw new Error('ไม่พบสินค้า');
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

      if (change === 0) return; // No change

      await StockService.recordMovement({
        productId,
        type: 'ADJUSTMENT',
        quantity: change,
        userId: ctx.userId,
        shopId: ctx.shopId,  // RBAC: Set shopId for stock log
        note: `${notePrefix} ${input.note}`,
        tx,
      });
    });

    revalidatePath(`/products/${productId}`);
    return {
      success: true,
      message: 'ปรับปรุงสต็อกสำเร็จ'
    };
  } catch (error: any) {
    console.error('Adjust stock error:', error);
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการปรับปรุงสต็อก'
    };
  }
}

export async function getLowStockProductsPaginated(params: GetProductsParams = {}) {
  const ctx = await requirePermission('PRODUCT_VIEW');
  const { page = 1, limit = 20, search, category } = params;
  
  const searchFilter = buildSearchFilter(search, ['name', 'sku']);

  const where = {
    shopId: ctx.shopId,
    isActive: true,
    deletedAt: null,
    isLowStock: true, // The Magic Filter
    ...(searchFilter && searchFilter),
    ...(category && { category }),
  };

  const result = await paginatedQuery<Product>(db.product, {
    where,
    page,
    limit,
    orderBy: { stock: 'asc' },
  });

  return {
    ...result,
    data: result.data.map(p => ({
      ...p,
      costPrice: Number(p.costPrice),
      salePrice: Number(p.salePrice),
    }))
  };
}

// Batch Create Products (สร้างสินค้าหลายรายการพร้อมกัน - ใช้ createMany)
export interface BatchProductInput {
  name: string;
  sku?: string | null;
  category: string;
  costPrice: number;
  salePrice: number;
}

export interface BatchCreateResult {
  success: boolean;
  created: Array<{ id: string; name: string; costPrice: number }>;
  failed: Array<{ name: string; error: string }>;
}

export async function batchCreateProducts(
  inputs: BatchProductInput[]
): Promise<ActionResponse<BatchCreateResult>> {
  console.log('[BatchCreate] ========== START ==========');
  console.log('[BatchCreate] Received inputs:', inputs.length);
  
  const ctx = await requirePermission('PRODUCT_CREATE');
  console.log('[BatchCreate] Auth context:', { userId: ctx.userId, shopId: ctx.shopId });

  if (!inputs || inputs.length === 0) {
    console.log('[BatchCreate] No inputs provided');
    return {
      success: false,
      message: 'ไม่มีข้อมูลสินค้าที่จะสร้าง',
    };
  }

  // 1. Validate inputs first
  const validInputs: BatchProductInput[] = [];
  const failed: BatchCreateResult['failed'] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    console.log(`[BatchCreate][${i}] Validating:`, {
      name: input.name,
      category: input.category,
      sku: input.sku,
    });

    if (!input.name || !input.name.trim()) {
      console.log(`[BatchCreate][${i}] FAILED: Missing name`);
      failed.push({ name: input.name || 'ไม่มีชื่อ', error: 'ไม่มีชื่อสินค้า' });
      continue;
    }

    if (!input.category || !input.category.trim()) {
      console.log(`[BatchCreate][${i}] FAILED: Missing category`);
      failed.push({ name: input.name, error: 'ไม่มีหมวดหมู่' });
      continue;
    }

    validInputs.push({
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      category: input.category.trim(),
      costPrice: input.costPrice || 0,
      salePrice: input.salePrice || 0,
    });
  }

  console.log('[BatchCreate] Valid inputs:', validInputs.length);
  console.log('[BatchCreate] Failed validation:', failed.length);

  if (validInputs.length === 0) {
    console.log('[BatchCreate] No valid inputs after validation');
    return {
      success: false,
      message: `ข้อมูลไม่ถูกต้อง ${failed.length} รายการ`,
      data: { success: false, created: [], failed },
    };
  }

  const created: BatchCreateResult['created'] = [];

  try {
    // 2. Check for existing products with same SKU (including inactive)
    const skusToCheck = validInputs.filter(i => i.sku).map(i => i.sku as string);
    
    let existingProducts: { id: string; sku: string | null; isActive: boolean }[] = [];
    if (skusToCheck.length > 0) {
      existingProducts = await db.product.findMany({
        where: {
          shopId: ctx.shopId,  // RBAC: Use shopId for SKU uniqueness check
          sku: { in: skusToCheck },
        },
        select: { id: true, sku: true, isActive: true },
      });
      console.log('[BatchCreate] Found existing products with SKUs:', existingProducts.length);
    }

    const existingSkuMap = new Map(existingProducts.map(p => [p.sku, p]));

    // 3. Process each product - reactivate existing or create new
    await db.$transaction(async (tx) => {
      for (const input of validInputs) {
        const existingProduct = input.sku ? existingSkuMap.get(input.sku) : null;

        if (existingProduct) {
          // Reactivate existing product
          console.log('[BatchCreate] Reactivating existing product:', input.sku);
          const reactivated = await tx.product.update({
            where: { id: existingProduct.id },
            data: {
              name: input.name,
              category: input.category,
              costPrice: input.costPrice,
              salePrice: input.salePrice,
              isActive: true,
              deletedAt: null,
            },
          });
          created.push({
            id: reactivated.id,
            name: reactivated.name,
            costPrice: Number(reactivated.costPrice),
          });
        } else {
          // Create new product
          console.log('[BatchCreate] Creating new product:', input.name);
          const newProduct = await tx.product.create({
            data: {
              name: input.name,
              sku: input.sku,
              category: input.category,
              costPrice: input.costPrice,
              salePrice: input.salePrice,
              stock: 0,
              minStock: 5,
              userId: ctx.userId,
              shopId: ctx.shopId,
            },
          });
          created.push({
            id: newProduct.id,
            name: newProduct.name,
            costPrice: Number(newProduct.costPrice),
          });
        }
      }
    });

    revalidatePath('/products');

    console.log('[BatchCreate] ========== SUCCESS ==========');
    console.log('[BatchCreate] Created/Reactivated:', created.length, 'Failed:', failed.length);

    return {
      success: true,
      message: `สร้างสินค้าสำเร็จ ${created.length} รายการ${failed.length > 0 ? `, ข้าม ${failed.length} รายการ` : ''}`,
      data: { success: true, created, failed },
    };
  } catch (error: any) {
    console.error('[BatchCreate] ========== ERROR ==========');
    console.error('[BatchCreate] Error:', error);
    console.error('[BatchCreate] Error code:', error.code);
    console.error('[BatchCreate] Error message:', error.message);

    if (error.code === 'P2002') {
      return {
        success: false,
        message: 'พบ SKU หรือชื่อซ้ำในระบบ',
        data: { success: false, created: [], failed },
      };
    }

    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการสร้างสินค้า',
    };
  }
}


