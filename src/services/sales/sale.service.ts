/**
 * sale.service.ts — Public Facade for Sales operations
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 * Public API remains unchanged.
 */

import { ISaleService } from '@/types/service-contracts';

import { SaleQueryService } from './sale/query';
import { SaleCreateUseCase } from './sale/create';
import { SaleCancelUseCase } from './sale/cancel';
import { SalePaymentUseCase } from './sale/payment';
import { SaleFulfillmentUseCase } from './sale/fulfillment';

export type { CancelSaleInput } from './sale/cancel';

export const SaleService: ISaleService = {
  // Query Operations
  getList: SaleQueryService.getList,
  getById: SaleQueryService.getById,
  getTodayAggregate: SaleQueryService.getTodayAggregate,
  getRecentList: SaleQueryService.getRecentList,
  getLockedFields: SaleQueryService.getLockedFields,

  // Create & Update
  create: SaleCreateUseCase.create,
  update: SaleCreateUseCase.update,

  // Cancel & Delete
  cancel: SaleCancelUseCase.cancel,
  delete: SaleCancelUseCase.delete,
  releaseStock: SaleCancelUseCase.releaseStock,

  // Payment & Invoice
  verifyPayment: SalePaymentUseCase.verifyPayment,
  uploadPaymentProof: SalePaymentUseCase.uploadPaymentProof,
  generateInvoice: SalePaymentUseCase.generateInvoice,

  // Fulfillment
  confirmOrder: SaleFulfillmentUseCase.confirmOrder,
  completeSale: SaleFulfillmentUseCase.completeSale,
};
