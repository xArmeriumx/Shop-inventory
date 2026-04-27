/**
 * ============================================================================
 * ERP Service Layer - Unified Entry Point
 * ============================================================================
 * All services are exported from here to maintain a clean public API.
 * Optimized for Logical Purity and High Discoverability (Phase 8.2).
 */

// --- CORE: Identity & Access (IAM) ---
export * from './core/iam/iam.service';
export * from './core/iam/security.service';

// --- CORE: System Foundation ---
export * from './core/system/audit.service';
export * from './core/system/lookup.service';
export * from './core/system/onboarding.service';
export * from './core/system/sequence.service';
export * from './core/system/system.service';
export * from './core/system/settings.service';

// --- CORE: Workflow & Orchestration ---
export * from './core/workflow/workflow.service';
export * from './core/workflow/approval.service';

// --- CORE: Intelligence & Tools ---
export * from './core/intelligence/ai.service';
export * from './core/intelligence/dashboard.service';
export * from './core/intelligence/export.service';
export * from './core/intelligence/notification.service';
export * from './core/intelligence/inventory-intelligence.service';

// --- TAX (Government Compliance) ---
export * from './tax/purchase-tax.service';
export * from './tax/tax-calculation.service';
export * from './tax/tax-resolution.service';
export * from './tax/tax-settings.service';
export * from './tax/wht.service';

// --- ACCOUNTING (Ledger, Cash, Bank) ---
export * from './accounting/accounting-report.service';
export * from './accounting/accounting.service';
export * from './accounting/bank.service';
export * from './accounting/finance.service';
export * from './accounting/journal.service';
export * from './accounting/posting-engine.service';
export * from './accounting/payment.service';
export * from './accounting/voucher.service';
export * from './accounting/report.service';

// --- SALES (Revenue Cycle) ---
export * from './sales/invoice.service';
export * from './sales/order-request.service';
export * from './sales/quotation.service';
export * from './sales/sale.service';
export * from './sales/customer.service';
export * from './sales/return.service';

// --- PURCHASES (Procurement Cycle) ---
export * from './purchases/purchase.service';
export * from './purchases/supplier.service';
export * from './purchases/purchase-return.service';

// --- INVENTORY (Stock & Warehouse) ---
export * from './inventory/delivery-order.service';
export * from './inventory/product.service';
export * from './inventory/shipment.service';
export * from './inventory/stock-take.service';
export * from './inventory/stock-transfer.service';
export * from './inventory/stock.service';
export * from './inventory/warehouse.service';
export * from './inventory/stock-engine.service';

// --- TYPES & CONTRACTS (Shared) ---
export * from '../types/serialized';
export * from './sales/sales.types';
export * from './purchases/purchases.types';
export * from './inventory/inventory.types';
export * from './accounting/accounting.types';
export * from './core/core.types';

export { ServiceError } from '@/types/common';
export type {
  RequestContext,
  ActionResponse,
  PaginatedResult,
  BaseQueryParams,
} from '@/types/common';
