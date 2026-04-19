'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { productSchema, productUpdateSchema, type ProductInput, type ProductUpdateInput } from '@/schemas/product';
import { ActionResponse } from '@/types/domain';
import { handleActionError } from '@/lib/error-handler';
import {
  ProductService,
  ServiceError,
  GetProductsParams,
  type BatchProductInput,
  type BatchCreateResult,
  type SerializedProduct
} from '@/services';

// Re-export types for other components (like scan-review-modal)
export type { BatchProductInput, BatchCreateResult, SerializedProduct };

//get product (paginated)
export async function getProducts(params: any = {}) {
  // RBAC: Require PRODUCT_VIEW permission for list
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ProductService.getList(params, ctx);
}

//get product by id 
export async function getProduct(id: string) {
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ProductService.getById(id, ctx);
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
    const product = await ProductService.create(ctx, validated.data);
    revalidatePath('/products');
    return { success: true, message: 'สร้างสินค้าสำเร็จ', data: product };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการสร้างสินค้า', { path: 'createProduct', userId: ctx.userId });
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
    const product = await ProductService.update(id, ctx, validated.data);
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return { success: true, message: 'อัปเดตสินค้าสำเร็จ', data: product };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการอัปเดตสินค้า', { path: 'updateProduct', userId: ctx.userId, productId: id });
  }
}

// Delete Product (Soft Delete  )
export async function deleteProduct(id: string): Promise<ActionResponse> {
  // RBAC: Require PRODUCT_DELETE permission
  const ctx = await requirePermission('PRODUCT_DELETE');

  try {
    await ProductService.delete(id, ctx);
    revalidatePath('/products');
    return { success: true, message: 'ลบสินค้าสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการลบสินค้า', { path: 'deleteProduct', userId: ctx.userId, productId: id });
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
interface AdjustStockInputManual {
  type: 'ADD' | 'REMOVE' | 'SET';
  quantity: number;
  note: string;
  reason?: string;
}

export async function adjustStock(productId: string, input: AdjustStockInputManual): Promise<ActionResponse> {
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
    return handleActionError(error, 'เกิดข้อผิดพลาดในการปรับปรุงสต็อก', { path: 'adjustStock', userId: ctx.userId, productId });
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
    return handleActionError(error, 'เกิดข้อผิดพลาดในการสร้างสินค้า', { path: 'batchCreateProducts', userId: ctx.userId, inputCount: inputs.length });
  }
}
// Get Stock Movement History (ประวัติการเคลื่อนไหวของสต็อก)
export async function getProductHistory(productId: string, page: number = 1, limit: number = 20) {
  await requirePermission('PRODUCT_VIEW');
  const { StockService } = await import('@/services');
  return StockService.getProductHistory(productId, page, limit);
}
