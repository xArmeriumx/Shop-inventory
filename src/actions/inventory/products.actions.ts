'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { productSchema, productUpdateSchema, type ProductInput, type ProductUpdateInput } from '@/schemas/inventory/product.schema';
import {
  ProductService,
  ServiceError,
  GetProductsParams,
  type BatchProductInput,
  type BatchCreateResult,
  type SerializedProduct
} from '@/services';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction, type ActionResponse } from '@/lib/action-handler';

// Re-export types for other components (like scan-review-modal)
export type { BatchProductInput, BatchCreateResult, SerializedProduct };

//get product (paginated)
export async function getProducts(params: any = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      return ProductService.getList(params, ctx);
    }, 'inventory:getProducts');
  }, { context: { action: 'getProducts' } });
}

//get product by id 
export async function getProduct(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      return ProductService.getById(id, ctx);
    }, 'inventory:getProduct');
  }, { context: { action: 'getProduct', id } });
}

//create product  
export async function createProduct(input: ProductInput): Promise<ActionResponse<SerializedProduct>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const _start = performance.now();

      const ctx = await requirePermission('PRODUCT_CREATE');
      const _auth = performance.now() - _start;

      const validated = productSchema.parse(input);
      const _val = performance.now() - (_start + _auth);

      const product = await ProductService.create(ctx, validated);
      const _svc = performance.now() - (_start + _auth + _val);

      // P0 Optimization: revalidateTag is targeted, revalidatePath invalidates the entire route tree
      revalidateTag('products');
      const _reval = performance.now() - (_start + _auth + _val + _svc);

      PerformanceCollector.setMetadata('latencies', {
        auth: _auth.toFixed(2),
        validation: _val.toFixed(2),
        service: _svc.toFixed(2),
        revalidation: _reval.toFixed(2),
        total: (performance.now() - _start).toFixed(2)
      });

      return product;
    }, 'inventory:createProduct');
  }, { context: { action: 'createProduct' } });
}

//update product  
export async function updateProduct(id: string, input: ProductUpdateInput): Promise<ActionResponse<SerializedProduct>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_UPDATE');
      const validated = productUpdateSchema.parse(input);
      const product = await ProductService.update(id, ctx, validated);
      // P0 Optimization: targeted tag invalidation instead of full-path purge
      revalidateTag('products');
      revalidatePath(`/products/${id}`);
      return product;
    }, 'inventory:updateProduct');
  }, { context: { action: 'updateProduct' } });
}

// Delete Product (Soft Delete  )
export async function deleteProduct(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_DELETE');
      await ProductService.delete(id, ctx);
      revalidateTag('products');
      return null;
    }, 'inventory:deleteProduct');
  }, { context: { action: 'deleteProduct', productId: id } });
}

// Get Products for Select (แสดงสินค้าใน Select)  
export async function getProductsForSelect(): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      return ProductService.getForSelect(ctx);
    }, 'inventory:getProductsForSelect');
  }, { context: { action: 'getProductsForSelect' } });
}

// Get Products for Purchase (แสดงสินค้าใน Select สำหรับหน้าซื้อสินค้า)
export async function getProductsForPurchase(): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      return ProductService.getForPurchase(ctx);
    }, 'inventory:getProductsForPurchase');
  }, { context: { action: 'getProductsForPurchase' } });
}

export async function getLowStockProducts(limit: number = 5): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      return ProductService.getLowStock(limit, ctx);
    }, 'inventory:getLowStockProducts');
  }, { context: { action: 'getLowStockProducts' } });
}

// Adjust Stock (เพิ่ม/ลดสต็อก)
export interface AdjustStockInputManual {
  type: 'ADD' | 'REMOVE' | 'SET';
  quantity: number;
  note: string;
  reason?: string;
}

export async function adjustStock(productId: string, input: AdjustStockInputManual): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_UPDATE');
      await ProductService.adjustStockManual(productId, {
        quantity: input.quantity,
        description: input.reason || input.note,
        type: input.type
      }, ctx);
      revalidatePath(`/products/${productId}`);
      return null;
    }, 'inventory:adjustStock');
  }, { context: { action: 'adjustStock', productId } });
}

export async function getLowStockProductsPaginated(params: GetProductsParams = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      return ProductService.getLowStockPaginated(params, ctx);
    }, 'inventory:getLowStockProductsPaginated');
  }, { context: { action: 'getLowStockProductsPaginated' } });
}

// Batch Create Products (สร้างสินค้าหลายรายการพร้อมกัน - ใช้ createMany)
export async function batchCreateProducts(inputs: BatchProductInput[]): Promise<ActionResponse<BatchCreateResult>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_CREATE');
      const result = await ProductService.batchCreate(inputs, ctx);
      revalidatePath('/products');
      return result;
    }, 'inventory:batchCreateProducts');
  }, { context: { action: 'batchCreateProducts' } });
}

// Get Stock Movement History (ประวัติการเคลื่อนไหวของสต็อก)
export async function getProductHistory(productId: string, page: number = 1, limit: number = 20): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      const { StockService } = await import('@/services');
      return StockService.getProductHistory(ctx, productId, page, limit);
    }, 'inventory:getProductHistory');
  }, { context: { action: 'getProductHistory', productId } });
}

