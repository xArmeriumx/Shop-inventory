/**
 * ============================================================================
 * ERP Service Layer - Unified Entry Point
 * ============================================================================
 * All services must be exported from here to maintain a clean public API
 * for the Action and UI layers.
 */

// --- CORE ---
export * from './core/audit.service';
export * from './core/iam.service';
export * from './core/lookup.service';
export * from './core/notification.service';
export * from './core/onboarding.service';
export * from './core/security.service';
export * from './core/sequence.service';
export * from './core/system.service';
export * from './core/workflow.service';

// --- TAX ---
export * from './tax/purchase-tax.service';
export * from './tax/tax-calculation.service';
export * from './tax/tax-resolution.service';
export * from './tax/tax-settings.service';
export * from './tax/wht.service';

// --- ACCOUNTING ---
export * from './accounting/accounting-report.service';
export * from './accounting/accounting.service';
export * from './accounting/bank.service';
export * from './accounting/finance.service';
export * from './accounting/journal.service';
export * from './accounting/posting-engine.service';
export * from './accounting/payment.service';
export * from './accounting/voucher.service';

// --- SALES ---
export * from './sales/invoice.service';
export * from './sales/order-request.service';
export * from './sales/quotation.service';
export * from './sales/sale.service';
export * from './sales/customer.service';
export * from './sales/return.service';

// --- INVENTORY ---
export * from './inventory/delivery-order.service';
export * from './inventory/product.service';
export * from './inventory/purchase.service';
export * from './inventory/shipment.service';
export * from './inventory/stock-take.service';
export * from './inventory/stock-transfer.service';
export * from './inventory/stock.service';
export * from './inventory/supplier.service';
export * from './inventory/warehouse.service';

// --- SHARED / OTHER ---
export * from './ai.service';
export * from './approval.service';
export * from './dashboard.service';
export * from './export.service';
export * from './product-intelligence.service';
export * from './settings.service';

// --- SPECIAL NAMESPACES ---
import * as ReportService from './report.service';
export { ReportService };
export type { ReportData } from './report.service';

// --- TYPES & CONTRACTS ---
export { ServiceError } from '@/types/domain';
export type {
  RequestContext,
  ActionResponse,
  PaginatedResult,
  BaseQueryParams,
  GetCustomersParams,
  GetProductsParams,
  GetSalesParams,
  GetPurchasesParams,
  BatchProductInput,
  BatchCreateResult,
  SerializedProduct,
  SerializedSale,
  SerializedPurchase,
  SerializedSaleWithItems,
} from '@/types/domain';
