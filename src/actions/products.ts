'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission, hasPermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { productSchema, productUpdateSchema, type ProductInput, type ProductUpdateInput } from '@/schemas/product';
import { Product } from '@prisma/client';
import { ActionResponse } from '@/types/domain';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { VERSION_CONFLICT_ERROR } from '@/lib/optimistic-lock';
export type { BatchProductInput, BatchCreateResult } from '@/services';
import {
  ProductService,
  ServiceError,
  GetProductsParams,
  type BatchProductInput,
  type BatchCreateResult,
  type SerializedProduct
} from '@/services';

//get product (paginated)
export async function getProducts(params: any = {}) {
  // RBAC: Require PRODUCT_VIEW permission for list
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ProductService.getList(params, ctx);
}

//get product by id 
export async function getProduct(id: string) {
  const ctx = await requirePermission('PRODUCT_VIEW');
  try {
    return await ProductService.getById(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

//create product  
export async function createProduct(input: ProductInput): Promise<ActionResponse<SerializedProduct>> {
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

  try {
    // โยนงานต่อให้ Service Layer ซึ่งจะจัดการเรื่องเช็คซ้ำ การสร้างของ และโยง Stock
    const product = await ProductService.create(
      ctx,
      validated.data
    );

    revalidatePath('/products');
    return {
      success: true,
      message: 'สร้างสินค้าสำเร็จ',
      data: product
    };
  } catch (error: unknown) {
    // กรณีที่ Service ตั้งใจโยน Validation Exception ออกมา
    if (error instanceof ServiceError) {
      return {
        success: false,
        message: error.message,
        errors: error.errors,
        action: error.action
      };
    }

    const typedError = error as Error;
    await logger.error('Create product error', typedError, { path: 'createProduct', userId: ctx.userId });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาดในการสร้างสินค้า'
    };
  }
}

//update product  
export async function updateProduct(id: string, input: ProductUpdateInput): Promise<ActionResponse<SerializedProduct>> {
  // RBAC: Require PRODUCT_EDIT permission
  const ctx = await requirePermission('PRODUCT_EDIT');

  // Validate input (use productUpdateSchema which includes version)
  const validated = productUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      message: 'ข้อมูลสินค้าไม่ถูกต้อง',
      errors: validated.error.flatten().fieldErrors
    };
  }

  try {
    const product = await ProductService.update(
      id,
      ctx,
      validated.data
    );

    revalidatePath('/products');
    revalidatePath(`/products/${id}`);

    return {
      success: true,
      message: 'อัปเดตสินค้าสำเร็จ',
      data: product
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return {
        success: false,
        message: error.message,
        errors: error.errors,
        action: error.action
      };
    }

    const typedError = error as Error;
    await logger.error('Update product error', typedError, { path: 'updateProduct', userId: ctx.userId, productId: id });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาดในการอัปเดตสินค้า'
    };
  }
}

// Delete Product (Soft Delete  )
export async function deleteProduct(id: string): Promise<ActionResponse> {
  // RBAC: Require PRODUCT_DELETE permission
  const ctx = await requirePermission('PRODUCT_DELETE');

  try {
    await ProductService.delete(id, ctx);

    revalidatePath('/products');
    return {
      success: true,
      message: 'ลบสินค้าสำเร็จ'
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return { success: false, message: error.message, action: error.action };
    }
    const typedError = error as Error;
    await logger.error('Delete product error', typedError, { path: 'deleteProduct', userId: ctx.userId, productId: id });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาดในการลบสินค้า'
    };
  }
}


// Get Products for Select (แสดงสินค้าใน Select)  
export async function getProductsForSelect() {
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ProductService.getForSelect(ctx);
}

// Get Products for Purchase (แสดงสินค้าใน Select สำหรับหน้าซื้อสินค้า)
export async function getProductsForPurchase() {
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ProductService.getForPurchase(ctx);
}

export async function getLowStockProducts(limit: number = 5) {
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ProductService.getLowStock(limit, ctx);
}

// Adjust Stock (เพิ่ม/ลดสต็อก)
interface AdjustStockInput {
  type: 'ADD' | 'REMOVE' | 'SET';
  quantity: number;
  note: string;
  reason?: string;
}

export async function adjustStock(productId: string, input: AdjustStockInput): Promise<ActionResponse> {
  const ctx = await requirePermission('PRODUCT_EDIT');
  try {
    await ProductService.adjustStockManual(productId, {
      quantity: input.quantity,
      description: input.reason || input.note,
      type: input.type
    }, ctx);
    revalidatePath(`/products/${productId}`);
    return { success: true, message: 'ปรับปรุงสต็อกสำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message, action: error.action };
    const typedError = error as Error;
    await logger.error('Adjust stock error', typedError, { path: 'adjustStock', userId: ctx.userId, productId });
    return { success: false, message: typedError.message || 'เกิดข้อผิดพลาดในการปรับปรุงสต็อก' };
  }
}

export async function getLowStockProductsPaginated(params: GetProductsParams = {}) {
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ProductService.getLowStockPaginated(params, ctx);
}

// Batch Create Products (สร้างสินค้าหลายรายการพร้อมกัน - ใช้ createMany)
export async function batchCreateProducts(inputs: BatchProductInput[]): Promise<ActionResponse<BatchCreateResult>> {
  const ctx = await requirePermission('PRODUCT_CREATE');

  try {
    const result = await ProductService.batchCreate(inputs, ctx);
    revalidatePath('/products');

    return {
      success: true,
      message: `สร้างสินค้าสำเร็จ ${result.created.length} รายการ${result.failed.length > 0 ? `, ข้าม ${result.failed.length} รายการ` : ''}`,
      data: result,
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return {
        success: false,
        message: error.message,
        data: { success: false, created: [], failed: (error.errors as any)?._batch || [] },
      };
    }

    const typedError = error as Error;
    await logger.error('Batch create products error', typedError, { path: 'batchCreateProducts', userId: ctx.userId, inputCount: inputs.length });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาดในการสร้างสินค้า',
    };
  }
}


