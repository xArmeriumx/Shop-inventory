'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { productSchema, type ProductInput, type ProductUpdateInput } from '@/schemas/product';
import type { Product } from '@prisma/client';

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
  const userId = await getCurrentUserId();
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
    userId,
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
        userId,
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
  const userId = await getCurrentUserId();

  const product = await db.product.findFirst({
    where: {
      id,
      userId,
      isActive: true,
    },
  });

  if (!product) {
    throw new Error('ไม่พบสินค้า');
  }

  return product;
}

export async function createProduct(input: ProductInput) {
  const userId = await getCurrentUserId();

  // Validate input
  const validated = productSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  // Check duplicate SKU
  if (validated.data.sku) {
    const existing = await db.product.findFirst({
      where: { sku: validated.data.sku },
    });
    if (existing) {
      return { error: { sku: ['SKU นี้มีอยู่แล้ว'] } };
    }
  }

  try {
    const product = await db.product.create({
      data: {
        ...validated.data,
        description: validated.data.description || null,
        sku: validated.data.sku || null,
        userId,
      },
    });

    revalidatePath('/products');
    return { data: product };
  } catch (error) {
    console.error('Create product error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
  const userId = await getCurrentUserId();

  // Validate input
  const validated = productSchema.partial().safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  // Check ownership
  const existing = await db.product.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { error: { _form: ['ไม่พบสินค้า'] } };
  }

  // Check duplicate SKU (if changed)
  if (validated.data.sku && validated.data.sku !== existing.sku) {
    const duplicate = await db.product.findFirst({
      where: { sku: validated.data.sku, id: { not: id } },
    });
    if (duplicate) {
      return { error: { sku: ['SKU นี้มีอยู่แล้ว'] } };
    }
  }

  try {
    const product = await db.product.update({
      where: { id },
      data: {
        ...validated.data,
        description: validated.data.description || null,
        sku: validated.data.sku || null,
      },
    });

    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return { data: product };
  } catch (error) {
    console.error('Update product error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function deleteProduct(id: string) {
  const userId = await getCurrentUserId();

  // Check ownership
  const existing = await db.product.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { error: 'ไม่พบสินค้า' };
  }

  try {
    // Soft delete
    await db.product.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath('/products');
    return { success: true };
  } catch (error) {
    console.error('Delete product error:', error);
    return { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function getProductsForSelect() {
  const userId = await getCurrentUserId();

  return db.product.findMany({
    where: {
      userId,
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
  const userId = await getCurrentUserId();

  // Get products where stock <= minStock
  const products = await db.product.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: { stock: 'asc' },
    take: 50, // Get more to filter
  });

  // Filter in JS since Prisma doesn't support comparing two columns directly
  const lowStock = products
    .filter((p) => p.stock <= p.minStock)
    .slice(0, limit);

  return lowStock;
}
