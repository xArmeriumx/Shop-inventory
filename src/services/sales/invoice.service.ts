/**
 * invoice.service.ts — Public Facade for Invoice operations
 * ============================================================================
 * Refactored into Domain-Driven Use Cases with strict boundary isolation.
 * Public API remains unchanged.
 */

import { InvoiceQueryService } from './invoice/query';
import { InvoiceCreateUseCase } from './invoice/create';
import { InvoicePostUseCase } from './invoice/post';
import { InvoicePaymentUseCase } from './invoice/payment';
import { InvoiceCancelUseCase } from './invoice/cancel';

export const InvoiceService = {
  // Query
  list: InvoiceQueryService.list,
  getById: InvoiceQueryService.getById,
  getStats: InvoiceQueryService.getStats,

  // Create
  createFromSale: InvoiceCreateUseCase.createFromSale,

  // Post & Accounting
  post: InvoicePostUseCase.post,
  tryPost: InvoicePostUseCase.tryPost,
  bulkPost: InvoicePostUseCase.bulkPost,

  // Payment
  markPaid: InvoicePaymentUseCase.markPaid,

  // Cancel
  cancel: InvoiceCancelUseCase.cancel,
};
