/**
 * product.service.ts — Public Facade for Product operations
 * ============================================================================
 * Refactored into Domain-Driven Use Cases with strict boundary isolation.
 * Public API remains unchanged.
 */

import { ProductQuery } from './product/query';
import { ProductCreateUseCase } from './product/create';
import { ProductUpdateUseCase } from './product/update';
import { ProductDeleteUseCase } from './product/delete';
import { ProductAdjustUseCase } from './product/adjust';
import { ProductBatchUseCase } from './product/batch';
import { IProductService } from '@/types/service-contracts';

export const ProductService: IProductService = {
  // Query
  getById: ProductQuery.getById,
  getAvailability: ProductQuery.getAvailability,
  getList: ProductQuery.getList,
  getForSelect: ProductQuery.getForSelect,
  getForPurchase: ProductQuery.getForPurchase,
  getLowStock: ProductQuery.getLowStock,
  getLowStockPaginated: ProductQuery.getLowStockPaginated,

  // Mutation
  create: ProductCreateUseCase.create,
  update: ProductUpdateUseCase.update,
  delete: ProductDeleteUseCase.delete,
  adjustStockManual: ProductAdjustUseCase.adjustStockManual,
  batchCreate: ProductBatchUseCase.batchCreate,
};
