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
  NONE:     'NONE',
  RESERVED: 'RESERVED',
  DEDUCTED: 'DEDUCTED',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const SaleStatus = {
  DRAFT:      'DRAFT',
  CONFIRMED:  'CONFIRMED',
  INVOICED:   'INVOICED',
  COMPLETED:  'COMPLETED',
  CANCELLED:  'CANCELLED',
  ACTIVE:     'ACTIVE', // Legacy compat
} as const;

export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

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
  LOCAL:   'LOCAL',
  FOREIGN: 'FOREIGN',
} as const;

export type PurchaseType = (typeof PurchaseType)[keyof typeof PurchaseType];

export const PurchaseStatus = {
  DRAFT:     'DRAFT',
  PENDING:   'PENDING',
  APPROVED:  'APPROVED',
  ORDERED:   'ORDERED',
  RECEIVED:  'RECEIVED',
  CANCELLED: 'CANCELLED',
  ACTIVE:    'ACTIVE', // Legacy compat
} as const;

export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

// ============================================================================
// CUSTOMER / CRM DOMAIN
// ============================================================================

export interface GetCustomersParams extends BaseQueryParams {
  region?: string;
}

export const Region = {
  CENTRAL:   'CENTRAL',
  NORTH:     'NORTH',
  NORTHEAST: 'NORTHEAST',
  EAST:      'EAST',
  WEST:      'WEST',
  SOUTH:     'SOUTH',
  BANGKOK:   'BANGKOK',
} as const;

export type Region = (typeof Region)[keyof typeof Region];

// ============================================================================
// DOCUMENT SEQUENCE (SSOT)
// ============================================================================

export const DocumentType = {
  SALE_INVOICE:      'INV',
  PURCHASE_ORDER:    'PO',
  PURCHASE_REQUEST:  'PR',
  SHIPMENT:          'SHP',
  RETURN:            'RET',
  CREDIT_NOTE:       'CN',
  QUOTATION:         'QT',
  BILLING:           'BIL',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const SequenceFormat = {
  STANDARD:   'STANDARD',
  WITH_DEPT:  'WITH_DEPT',
  THAI_YEAR:  'THAI_YEAR',
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
  PENDING:    'PENDING',
  PROCESSING: 'PROCESSING',
  SHIPPED:    'SHIPPED',
  DELIVERED:  'DELIVERED',
  RETURNED:   'RETURNED',
  CANCELLED:  'CANCELLED',
} as const;

export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

/**
 * มาตรฐานการเปลี่ยนสถานะการจัดส่ง (Logistics Workflow)
 */
export const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING:    ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED:    ['DELIVERED', 'RETURNED'],
  DELIVERED:  [],
  RETURNED:   ['PROCESSING', 'CANCELLED'],
  CANCELLED:  ['PENDING'], // Allow retry from cancelled
};

// ============================================================================
// FINANCE DOMAIN
// ============================================================================

export const TaxType = {
  NONE:   'NONE',
  VAT7:   'VAT7',
  WHT1:   'WHT1',
  WHT3:   'WHT3',
  WHT5:   'WHT5',
} as const;

export type TaxType = (typeof TaxType)[keyof typeof TaxType];

export const BillingStatus = {
  UNBILLED:  'UNBILLED',
  BILLED:    'BILLED',
  PAID:      'PAID',
  OVERDUE:   'OVERDUE',
} as const;

export type BillingStatus = (typeof BillingStatus)[keyof typeof BillingStatus];

// ============================================================================
// INVENTORY DOMAIN
// ============================================================================

export const StockMovement = {
  SALE:            'SALE',
  PURCHASE:        'PURCHASE',
  ADJUSTMENT:      'ADJUSTMENT',
  RETURN:          'RETURN',
  WASTE:           'WASTE',
  CANCEL:          'CANCEL',
  SALE_CANCEL:     'SALE_CANCEL',
  PURCHASE_CANCEL: 'PURCHASE_CANCEL',
  RESERVATION:     'RESERVATION',
  RELEASE:         'RELEASE',
} as const;

export type StockMovement = (typeof StockMovement)[keyof typeof StockMovement];
export * from './serialized';
