'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission, hasPermission } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { productSchema, type ProductInput, type ProductUpdateInput } from '@/schemas/product';
import { Product } from '@prisma/client';
import { ActionResponse } from '@/types/action-response';
import { StockService } from '@/lib/stock-service';

interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  lowStockOnly?: boolean;
}

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

  return paginatedQuery<Product>(db.product, {
    where: whereClause,
    page,
    limit,
    orderBy: { [sortBy]: sortOrder },
  });
}

export async function getProduct(id: string) {
  const ctx = await requirePermission('PRODUCT_VIEW');

  const product = await db.product.findFirst({
    where: {
      id,
      shopId: ctx.shopId,
      isActive: true,
    },
  });

  if (!product) {
    throw new Error('ไม่พบสินค้า');
  }

  return product;
}

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

  try {
    const product = await db.$transaction(async (tx) => {
      // 1. Handle Stock Adjustment if changed
      if (validated.data.stock !== undefined && validated.data.stock !== existing.stock) {
        const diff = validated.data.stock - existing.stock;
        
        // This helper records the movement AND updates the product stock
        await StockService.recordMovement({
          productId: id,
          type: 'ADJUSTMENT',
          quantity: diff,
          userId: ctx.userId,
          note: 'ปรับปรุงสต็อก (แก้ไขสินค้า)',
          tx,
        });
      }

      // 2. Update other fields (excluding stock, as it's handled by StockService)
      const { stock, ...otherData } = validated.data;
      
      return tx.product.update({
        where: { id },
        data: {
          ...otherData,
          description: otherData.description || null,
          sku: otherData.sku || null,
        },
      });
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

export async function getProductsForSelect() {
  const ctx = await requirePermission('PRODUCT_VIEW'); // Assume needed

  return db.product.findMany({
    where: {
      shopId: ctx.shopId,
      isActive: true,
      stock: { gt: 0 },
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
}

export async function getLowStockProducts(limit: number = 5) {
  const ctx = await requirePermission('PRODUCT_VIEW'); // Or DASHBOARD_VIEW

  // Get products where stock <= minStock
  const products = await db.product.findMany({
    where: {
      shopId: ctx.shopId,
      isActive: true,
    },
    orderBy: { stock: 'asc' },
    take: 50, // Get more to filter
  });

  // Filter in JS since Prisma doesn't support comparing two columns directly
  const lowStock = products
    .filter((p: Product) => p.stock <= p.minStock)
    .slice(0, limit);

  return lowStock;
}

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
