/**
 * purchase.service.ts — Public Facade for Purchases operations
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 * Public API remains unchanged.
 */

import { IPurchaseService } from '@/types/service-contracts';

import { PurchaseQueryService } from './purchase/query';
import { PurchaseCreateUseCase } from './purchase/create';
import { PurchaseReceiveUseCase } from './purchase/receive';
import { PurchaseCancelUseCase } from './purchase/cancel';

export type { CancelPurchaseInput } from './purchase/cancel';
export { CANCEL_PURCHASE_REASONS } from './purchase/cancel';

export const PurchaseService: IPurchaseService = {
  // Query Operations
  getList: PurchaseQueryService.getList,
  getById: PurchaseQueryService.getById,
  getIncompleteRequests: PurchaseQueryService.getIncompleteRequests,
  getSupplierPurchaseInfo: PurchaseQueryService.getSupplierPurchaseInfo,

  // Create & State Transitions
  create: PurchaseCreateUseCase.create,
  createRequest: PurchaseCreateUseCase.createRequest,
  approveRequest: PurchaseCreateUseCase.approveRequest,
  convertToPO: PurchaseCreateUseCase.convertToPO,
  checkMOQ: PurchaseCreateUseCase.checkMOQ,
  quickAssignSupplier: PurchaseCreateUseCase.quickAssignSupplier,
  createBulkDraftPRs: PurchaseCreateUseCase.createBulkDraftPRs,

  // Receive
  receivePurchase: PurchaseReceiveUseCase.receivePurchase,
  allocateCharges: PurchaseReceiveUseCase.allocateCharges,

  // Cancel
  cancel: PurchaseCancelUseCase.cancel,
};
