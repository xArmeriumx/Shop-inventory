/**
 * ============================================================================
 * Shop-Inventory: Core Domain Types & Interfaces
 * ============================================================================
 *
 * ไฟล์นี้คือ "Single Source of Truth" ของ Type System ทั้งหมดในระบบ
 * ทุก Service, Action, และ Component ต้องอ้างอิง Type จากไฟล์นี้เท่านั้น
 *
 * @module Domain Types
 */

import type { Prisma, Permission } from '@prisma/client';

// ============================================================================
// SHARED / CROSS-MODULE TYPES
// ============================================================================

/**
 * RequestContext — ตัวตนของผู้ใช้ในทุก Service call
 * ถูกสร้างจาก Action Layer (auth-guard) และส่งลงมายัง Service Layer
 * 
 * ขยายให้ครอบคลุม RBAC เพื่อให้ Service ตรวจสอบสิทธิ์เองได้ (Defense in Depth)
 */
export interface RequestContext {
  userId: string;
  memberId?: string; // Standard ERP Actor ID
  userName?: string;

  userEmail?: string;
  shopId: string;
  permissions: Permission[];
  isOwner: boolean;
  sessionVersion?: number;
  employeeDepartment?: string; // e.g., 'SALES', 'WH', 'ACC'
}

/**
 * ActionResponse — รูปแบบ Response มาตรฐานจาก Server Action
 */
export type ActionResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]> | string;
  action?: ErrorAction;
};

/**
 * PaginatedResult — รูปแบบ Response มาตรฐานสำหรับการ Query ข้อมูลแบบแบ่งหน้า
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ErrorAction {
  label: string;
  href: string;
}

/**
 * ServiceError — Business Logic error ที่มี context ชัดเจน
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public errors?: Record<string, string[]>,
    public action?: ErrorAction
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * มาตรฐานการดึงข้อมูลแบบมี Pagination
 */
export interface BaseQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// PRODUCT DOMAIN
// ============================================================================

export interface GetProductsParams extends BaseQueryParams {
  category?: string;
  lowStockOnly?: boolean;
}

export interface BatchProductInput {
  name: string;
  sku?: string | null;
  category: string;
  costPrice: number;
  salePrice: number;
  stock?: number;
  minStock?: number;
}

export interface BatchCreateResult {
  success: boolean;
  created: Array<{ id: string; name: string; costPrice: number }>;
  failed: Array<{ name: string; error: string }>;
}

/**
 * StockAvailability — Interface สำหรับแสดงสถานะสต็อกแบบ Business-ready
 */
export interface StockAvailability {
  onHand: number;          // จำนวนจริงในคลัง
  reserved: number;        // จำนวนที่ถูกจองไว้ (จาก Sale ที่ CONFIRMED)
  available: number;       // จำนวนที่ขายได้จริง = onHand - reserved
  isLowStock: boolean;     // ต่ำกว่า minStock หรือไม่
  minStock: number;        // จุด Reorder Point
}

// ============================================================================
// SALES DOMAIN
// ============================================================================

export interface GetSalesParams extends BaseQueryParams {
  paymentMethod?: string;
  channel?: string;
  status?: SaleStatus;
  customerId?: string;
}

export const BookingStatus = {
  NONE: 'NONE',
  RESERVED: 'RESERVED',
  DEDUCTED: 'DEDUCTED',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export interface AdjustStockInput {
  type: 'ADD' | 'REMOVE' | 'SET';
  quantity: number;
  description: string;
}

export const SaleStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  INVOICED: 'INVOICED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  ACTIVE: 'ACTIVE', // Legacy compat
} as const;

export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export type EditLockStatus = 'NONE' | 'BILLED' | 'CANCELLED' | 'APPROVED' | 'POSTED' | 'PAID';

export type DocPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface GetQuotationsParams extends BaseQueryParams {
  customerId?: string;
  status?: QuotationStatus;
}

export interface CreateQuotationInput {
  customerId: string;
  salespersonId?: string;
  date?: Date;
  validUntil?: Date;
  currencyCode?: string;
  notes?: string;
  items: Array<{
    productId: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
}

// ============================================================================
// PURCHASE DOMAIN
// ============================================================================

export interface GetPurchasesParams extends BaseQueryParams {
  paymentMethod?: string;
  supplierId?: string;
  status?: string;
}

export interface GetIncompletePurchasesParams extends BaseQueryParams {
  status?: string;
}

export const PurchaseType = {
  LOCAL: 'LOCAL',
  FOREIGN: 'FOREIGN',
} as const;

export type PurchaseType = (typeof PurchaseType)[keyof typeof PurchaseType];

export const PurchaseStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  ORDERED: 'ORDERED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
  ACTIVE: 'ACTIVE', // Legacy compat
} as const;

export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

export interface GetOrderRequestsParams extends BaseQueryParams {
  requesterId?: string;
  status?: OrderRequestStatus;
}

export interface CreateOrderRequestInput {
  requesterId: string;
  notes?: string;
  items: Array<{
    productId?: string;
    description?: string;
    quantity: number;
    uom?: string;
  }>;
}

// ============================================================================
// CUSTOMER / CRM DOMAIN
// ============================================================================

export interface GetCustomersParams extends BaseQueryParams {
  region?: string;
}

export const Region = {
  CENTRAL: 'CENTRAL',
  NORTH: 'NORTH',
  NORTHEAST: 'NORTHEAST',
  EAST: 'EAST',
  WEST: 'WEST',
  SOUTH: 'SOUTH',
  BANGKOK: 'BANGKOK',
} as const;

export type Region = (typeof Region)[keyof typeof Region];

// ============================================================================
// DOCUMENT SEQUENCE (SSOT)
// ============================================================================

export const DocumentType = {
  SALE_INVOICE: 'INV',
  PURCHASE_ORDER: 'PO',
  PURCHASE_REQUEST: 'PR',
  SHIPMENT: 'SHP',
  RETURN: 'RET',
  CREDIT_NOTE: 'CN',
  QUOTATION: 'QT',
  BILLING: 'BIL',
  ORDER_REQUEST: 'OR',
  DELIVERY_ORDER: 'DO',
  PURCHASE_TAX: 'PTX',
  WHT_CERTIFICATE: 'WHT',
  JOURNAL_VOUCHER: 'JV',
  PAYMENT: 'RCP',
  STOCK_TRANSFER: 'ST',
  PURCHASE_RETURN: 'DBN',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const QuotationStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;

export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const OrderRequestStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderRequestStatus = (typeof OrderRequestStatus)[keyof typeof OrderRequestStatus];

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const SequenceFormat = {
  STANDARD: 'STANDARD',
  WITH_DEPT: 'WITH_DEPT',
  THAI_YEAR: 'THAI_YEAR',
} as const;

export type SequenceFormat = (typeof SequenceFormat)[keyof typeof SequenceFormat];

export interface SequenceConfig {
  documentType: DocumentType;
  format: SequenceFormat;
  prefix?: string;
  departmentCode?: string;
  purchaseType?: PurchaseType; // ★ NEW: FOR PR/PO Separation
  resetCycle: 'MONTHLY' | 'YEARLY' | 'NEVER';
  padLength: number;
  useBuddhistYear: boolean;
}

// ============================================================================
// SHIPPING PRODUCT DOMAIN
// ============================================================================

export interface GetShipmentsParams extends BaseQueryParams {
  status?: string;
}

export const ShipmentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
} as const;

export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const DeliveryStatus = {
  DRAFT: 'DRAFT',
  WAITING: 'WAITING',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export interface GetInvoicesParams extends BaseQueryParams {
  saleId?: string;
  customerId?: string;
  status?: InvoiceStatus;
}

export interface CreateInvoiceInput {
  saleId?: string;
  customerId?: string;
  date?: Date;
  dueDate?: Date;
  currencyCode?: string;
  notes?: string;
  items: Array<{
    productId: string;
    description?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface GetDeliveryOrdersParams extends BaseQueryParams {
  saleId?: string;
  status?: DeliveryStatus;
}

export interface CreateDeliveryOrderInput {
  saleId: string;
  scheduledDate?: Date;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface SubmitApprovalInput {
  documentType: 'SALE' | 'PURCHASE' | 'ORDER_REQUEST';
  documentId: string;
  approverUserIds: string[]; // List of historical approvers or initial set
}

export interface ApprovalActionInput {
  approvalInstanceId: string;
  documentId?: string;       // Optional: for lookup if instanceId is empty
  documentType?: string;     // Optional: for lookup if instanceId is empty
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}

/**
 * มาตรฐานการเปลี่ยนสถานะการจัดส่ง (Logistics Workflow)
 */
export const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: [],
  RETURNED: ['PROCESSING', 'CANCELLED'],
  CANCELLED: ['PENDING'], // Allow retry from cancelled
};

// ============================================================================
// FINANCE DOMAIN
// ============================================================================

export interface GetFinanceParams extends BaseQueryParams {
  category?: string;
}

export const TaxType = {
  NONE: 'NONE',
  VAT7: 'VAT7',
  WHT1: 'WHT1',
  WHT3: 'WHT3',
  WHT5: 'WHT5',
} as const;

export type TaxType = (typeof TaxType)[keyof typeof TaxType];

export const BillingStatus = {
  UNBILLED: 'UNBILLED',
  BILLED: 'BILLED',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;

export type BillingStatus = (typeof BillingStatus)[keyof typeof BillingStatus];

// ============================================================================
// TAX DOMAIN (Phase T3)
// ============================================================================

export const ClaimStatus = {
  CLAIMABLE: 'CLAIMABLE',
  WAITING_DOC: 'WAITING_DOC',
  NON_CLAIMABLE: 'NON_CLAIMABLE',
} as const;

export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

export const PurchaseTaxStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  VOIDED: 'VOIDED',
} as const;

export type PurchaseTaxStatus = (typeof PurchaseTaxStatus)[keyof typeof PurchaseTaxStatus];

export const PurchaseTaxSourceType = {
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  MANUAL_EXPENSE: 'MANUAL_EXPENSE',
} as const;

export type PurchaseTaxSourceType = (typeof PurchaseTaxSourceType)[keyof typeof PurchaseTaxSourceType];

// ============================================================================
// INVENTORY DOMAIN
// ============================================================================

export const StockMovement = {
  SALE: 'SALE',
  PURCHASE: 'PURCHASE',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN',
  WASTE: 'WASTE',
  CANCEL: 'CANCEL',
  SALE_CANCEL: 'SALE_CANCEL',
  PURCHASE_CANCEL: 'PURCHASE_CANCEL',
  RESERVATION: 'RESERVATION',
  RELEASE: 'RELEASE',
  STOCK_TAKE_RECONCILIATION: 'STOCK_TAKE_RECONCILIATION',
} as const;

export type StockMovement = (typeof StockMovement)[keyof typeof StockMovement];

// ============================================================================
// ANALYTICS & REORDER DOMAIN
// ============================================================================

export interface InventoryHealthMetrics {
  productId: string;
  productName: string;
  sku: string | null;
  avgDailySales: number;     // อัตราการขายออกเฉลี่ยต่อวัน
  avgLeadTimeDays: number;   // ระยะเวลาสั่งซื้อเฉลี่ย (วัน)
  reorderPoint: number;      // จุดสั่งซื้อใหม่ (ADS * LT + Safety)
  availableQty: number;      // จำนวนที่นับได้จริง (onHand - reserved)
  incomingQty: number;       // จำนวนที่กำลังมา (Confirmed PO)
  healthStatus: 'HEALTHY' | 'REORDER' | 'CRITICAL';
}

export interface ReorderSuggestion {
  productId: string;
  suggestedQty: number;
  suggestedSupplierId?: string | null;
  reason: string;            // เช่น "สต็อกจะหมดภายใน 3 วัน", "อิงตาม Lead Time 5 วัน"
}
export * from './serialized';
