/**
 * ============================================================================
 * ERP-Namfon: Core Domain Types & Interfaces
 * ============================================================================
 *
 * ไฟล์นี้คือ "Single Source of Truth" ของ Type System ทั้งหมดในระบบ ERP
 * ทุก Service, Action, และ Component ต้องอ้างอิง Type จากไฟล์นี้เท่านั้น
 *
 * หลักการออกแบบ:
 * 1. Enums ใช้ const object + type union (ไม่ใช้ TypeScript enum) เพื่อความ compatible กับ Zod
 * 2. Interface แยกตาม Domain (Sale, Purchase, Shipping, Finance)
 * 3. ทุก Status มี Transition Map กำกับว่าเปลี่ยนสถานะได้จากไหนไปไหน
 *
 * @module ERP Core Types
 */

import type { Prisma } from '@prisma/client';

// ============================================================================
// SHARED / CROSS-MODULE TYPES
// ============================================================================

/**
 * RequestContext — ตัวตนของผู้ใช้ในทุก Service call
 * ถูกสร้างจาก Action Layer (auth-guard) และส่งลงมายัง Service Layer
 */
export interface RequestContext {
  userId: string;
  shopId: string;
}

/**
 * ActionResponse — รูปแบบ Response มาตรฐานจาก Server Action
 * ทุก Action ต้อง return ในรูปแบบนี้เท่านั้น
 */
export type ActionResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]> | string;
};

/**
 * ServiceError — Business Logic error ที่มี context ชัดเจน
 * ใช้ throw ใน Service Layer เพื่อให้ Action Layer จับและแปลงเป็น ActionResponse
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// ============================================================================
// DOCUMENT SEQUENCE (SSOT: เลขที่เอกสาร)
// ============================================================================

/**
 * DocumentType — ประเภทเอกสารที่ระบบรันเลขให้
 * ใช้เป็น key สำหรับ DocSequence Service
 */
export const DocumentType = {
  SALE_INVOICE:      'INV',          // ใบกำกับภาษี / ใบเสร็จ
  PURCHASE_ORDER:    'PO',           // ใบสั่งซื้อ
  PURCHASE_REQUEST:  'PR',           // ใบขอซื้อ
  SHIPMENT:          'SHP',          // ใบจัดส่ง
  RETURN:            'RET',          // ใบคืนสินค้า
  CREDIT_NOTE:       'CN',           // ใบลดหนี้
  QUOTATION:         'QT',           // ใบเสนอราคา
  BILLING:           'BIL',          // ใบวางบิล
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

/**
 * SequenceFormat — รูปแบบการรันเลข
 * ใช้กำหนดว่าเอกสารแต่ละชนิดจะแสดงเลขในรูปแบบไหน
 *
 * ตัวอย่าง:
 * - 'STANDARD'       → INV-2604-00001
 * - 'WITH_DEPT'      → K-INV-2604-00001  (แผนก K)
 * - 'THAI_YEAR'      → INV-6904-00001    (ปีไทย 2569)
 */
export const SequenceFormat = {
  STANDARD:   'STANDARD',
  WITH_DEPT:  'WITH_DEPT',
  THAI_YEAR:  'THAI_YEAR',
} as const;

export type SequenceFormat = (typeof SequenceFormat)[keyof typeof SequenceFormat];

/**
 * SequenceConfig — การตั้งค่าเลขเอกสารสำหรับแต่ละ Shop
 */
export interface SequenceConfig {
  documentType: DocumentType;
  format: SequenceFormat;
  prefix?: string;           // Custom prefix (เช่น "IMP" สำหรับ journal พิเศษ)
  departmentCode?: string;   // รหัสแผนก (เช่น "K", "BKK")
  resetCycle: 'MONTHLY' | 'YEARLY' | 'NEVER';
  padLength: number;         // จำนวนหลักของตัวเลข (default: 5 → 00001)
  useBuddhistYear: boolean;  // ใช้ปีไทย +543
}

// ============================================================================
// SALES MODULE
// ============================================================================

/**
 * BookingStatus — สถานะการจองสต็อกบนใบขาย
 *
 * Flow: NONE → RESERVED → DEDUCTED
 * - NONE:     ยังไม่จองสต็อก (Draft / Quotation)
 * - RESERVED: จองสต็อกแล้ว (ยืนยันคำสั่งซื้อ)
 * - DEDUCTED: ตัดสต็อกแล้ว (ส่งของ / Delivery validated)
 */
export const BookingStatus = {
  NONE:     'NONE',
  RESERVED: 'RESERVED',
  DEDUCTED: 'DEDUCTED',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/**
 * SaleStatus — สถานะของใบขาย (ขยายจาก ACTIVE/CANCELLED เดิม)
 *
 * Flow: DRAFT → CONFIRMED → INVOICED → COMPLETED
 *                                ↘ CANCELLED
 */
export const SaleStatus = {
  DRAFT:      'DRAFT',
  CONFIRMED:  'CONFIRMED',
  INVOICED:   'INVOICED',
  COMPLETED:  'COMPLETED',
  CANCELLED:  'CANCELLED',
} as const;

export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

/**
 * Sale Status Transition Map — กำหนดว่าสถานะไหนเปลี่ยนไปสถานะไหนได้
 * ใช้ validate ใน Service ก่อนทำการเปลี่ยนสถานะ
 */
export const SALE_STATUS_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  DRAFT:      ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['INVOICED', 'CANCELLED'],
  INVOICED:   ['COMPLETED', 'CANCELLED'],
  COMPLETED:  [],  // Final state
  CANCELLED:  [],  // Final state
};

/**
 * SaleStatus Labels — ป้ายกำกับภาษาไทย
 */
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT:      'ร่าง',
  CONFIRMED:  'ยืนยันแล้ว',
  INVOICED:   'ออกใบกำกับแล้ว',
  COMPLETED:  'เสร็จสมบูรณ์',
  CANCELLED:  'ยกเลิก',
};

/**
 * Locked Fields — ฟิลด์ที่ถูกล็อกตามสถานะ
 * ใช้ใน UI เพื่อกำหนด readonly fields
 */
export const SALE_LOCKED_AFTER: Record<string, SaleStatus[]> = {
  items:         ['INVOICED', 'COMPLETED'],
  customerId:    ['INVOICED', 'COMPLETED'],
  paymentMethod: ['COMPLETED'],
  discountType:  ['INVOICED', 'COMPLETED'],
  discountValue: ['INVOICED', 'COMPLETED'],
};

// ============================================================================
// PURCHASE MODULE
// ============================================================================

/**
 * PurchaseType — ประเภทการจัดซื้อ
 * - LOCAL:   ซื้อในประเทศ → ใช้ VAT ปกติ
 * - FOREIGN: ซื้อต่างประเทศ → Default No Tax
 */
export const PurchaseType = {
  LOCAL:   'LOCAL',
  FOREIGN: 'FOREIGN',
} as const;

export type PurchaseType = (typeof PurchaseType)[keyof typeof PurchaseType];

/**
 * PurchaseDocType — แยกประเภทเอกสารจัดซื้อ
 * - REQUEST: ใบขอซื้อ (PR) — ต้อง Approve ก่อน
 * - ORDER:   ใบสั่งซื้อ (PO) — พร้อมส่งให้ Vendor
 */
export const PurchaseDocType = {
  REQUEST: 'REQUEST',
  ORDER:   'ORDER',
} as const;

export type PurchaseDocType = (typeof PurchaseDocType)[keyof typeof PurchaseDocType];

/**
 * PurchaseStatus — สถานะของเอกสารจัดซื้อ
 */
export const PurchaseStatus = {
  DRAFT:     'DRAFT',
  PENDING:   'PENDING',      // PR: รออนุมัติ
  APPROVED:  'APPROVED',     // PR: อนุมัติแล้ว → พร้อม Convert เป็น PO
  ORDERED:   'ORDERED',      // PO: สั่งซื้อแล้ว
  RECEIVED:  'RECEIVED',     // PO: รับของแล้ว
  CANCELLED: 'CANCELLED',
  ACTIVE:    'ACTIVE',       // Legacy compat — เท่ากับ RECEIVED
} as const;

export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

export const PURCHASE_STATUS_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  DRAFT:     ['PENDING', 'CANCELLED'],
  PENDING:   ['APPROVED', 'CANCELLED'],
  APPROVED:  ['ORDERED', 'CANCELLED'],
  ORDERED:   ['RECEIVED', 'CANCELLED'],
  RECEIVED:  [],                         // Final state
  CANCELLED: [],                         // Final state
  ACTIVE:    ['CANCELLED'],              // Legacy compat
};

/**
 * Purchase Prefix โดยอัตโนมัติตาม PurchaseType
 */
export const PURCHASE_TYPE_PREFIX: Record<PurchaseType, string> = {
  LOCAL:   'T',   // Thai purchase
  FOREIGN: 'C',   // Foreign (China/Global) purchase
};

// ============================================================================
// SHIPPING MODULE
// ============================================================================

/**
 * ShippingStatus — สถานะการจัดส่ง (ขยายจาก ShipmentStatus enum เดิม)
 */
export const ShippingStatus = {
  PENDING:    'PENDING',
  PROCESSING: 'PROCESSING',  // ★ NEW: กำลังเตรียมของ
  SHIPPED:    'SHIPPED',
  DELIVERED:  'DELIVERED',
  RETURNED:   'RETURNED',
  CANCELLED:  'CANCELLED',
} as const;

export type ShippingStatus = (typeof ShippingStatus)[keyof typeof ShippingStatus];

export const SHIPPING_STATUS_TRANSITIONS: Record<ShippingStatus, ShippingStatus[]> = {
  PENDING:    ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED:    ['DELIVERED', 'RETURNED', 'CANCELLED'],
  DELIVERED:  [],
  RETURNED:   ['PENDING'],
  CANCELLED:  [],
};

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  PENDING:    'รอจัดส่ง',
  PROCESSING: 'กำลังเตรียมของ',
  SHIPPED:    'ส่งแล้ว',
  DELIVERED:  'ส่งถึงแล้ว',
  RETURNED:   'ส่งคืน',
  CANCELLED:  'ยกเลิก',
};

/**
 * ShippingSaleStatusSync — เมื่อ Shipping เปลี่ยนสถานะ ให้ Sync กลับไปที่ Sale เป็นอะไร
 * ใช้ใน ShipmentService.updateStatus() เพื่อ auto-sync ไปยัง SaleService
 */
export const SHIPPING_SALE_SYNC: Partial<Record<ShippingStatus, BookingStatus>> = {
  PROCESSING: BookingStatus.RESERVED,
  SHIPPED:    BookingStatus.DEDUCTED,
  DELIVERED:  BookingStatus.DEDUCTED,
};

// ============================================================================
// FINANCE MODULE
// ============================================================================

/**
 * TaxType — ประเภทภาษีหัก ณ ที่จ่าย
 */
export const TaxType = {
  NONE:   'NONE',
  VAT7:   'VAT7',       // 7% VAT
  WHT1:   'WHT1',       // หัก 1% (ภงด 53)
  WHT3:   'WHT3',       // หัก 3% (ภงด 3)
  WHT5:   'WHT5',       // หัก 5% (บริการ)
} as const;

export type TaxType = (typeof TaxType)[keyof typeof TaxType];

export const TAX_RATE: Record<TaxType, number> = {
  NONE: 0,
  VAT7: 0.07,
  WHT1: 0.01,
  WHT3: 0.03,
  WHT5: 0.05,
};

/**
 * BillingStatus — สถานะของ Invoice ในกระบวนการวางบิล
 */
export const BillingStatus = {
  UNBILLED:  'UNBILLED',    // ยังไม่ถูกวางบิล
  BILLED:    'BILLED',      // ถูกดึงเข้าสู่ Billing Statement แล้ว (ห้ามดึงซ้ำ)
  PAID:      'PAID',        // ชำระเงินแล้ว
  OVERDUE:   'OVERDUE',     // เกินกำหนดชำระ
} as const;

export type BillingStatus = (typeof BillingStatus)[keyof typeof BillingStatus];

// ============================================================================
// CRM / CONTACT MODULE
// ============================================================================

/**
 * Region — ภูมิภาคการขาย
 * ใช้ในระบบ Region-Salesperson Mapping
 */
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

export const REGION_LABELS: Record<Region, string> = {
  CENTRAL:   'ภาคกลาง',
  NORTH:     'ภาคเหนือ',
  NORTHEAST: 'ภาคตะวันออกเฉียงเหนือ',
  EAST:      'ภาคตะวันออก',
  WEST:      'ภาคตะวันตก',
  SOUTH:     'ภาคใต้',
  BANGKOK:   'กรุงเทพมหานคร',
};

// ============================================================================
// INVENTORY MODULE
// ============================================================================

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

/**
 * StockMovementType — ประเภทการเคลื่อนไหวของสต็อก
 * ขยายจาก enum StockMovementType เดิมใน Prisma
 */
export const StockMovement = {
  SALE:            'SALE',
  PURCHASE:        'PURCHASE',
  ADJUSTMENT:      'ADJUSTMENT',
  RETURN:          'RETURN',
  WASTE:           'WASTE',
  CANCEL:          'CANCEL',
  SALE_CANCEL:     'SALE_CANCEL',
  PURCHASE_CANCEL: 'PURCHASE_CANCEL',
  RESERVATION:     'RESERVATION',      // ★ NEW: จองสต็อก
  RELEASE:         'RELEASE',          // ★ NEW: ปลดจอง
} as const;

export type StockMovement = (typeof StockMovement)[keyof typeof StockMovement];

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * FieldLockRule — กฎการล็อกฟิลด์ตาม Status
 * ใช้ตรวจสอบทั้งฝั่ง Backend (Service) และ Frontend (UI readonly)
 */
export interface FieldLockRule {
  field: string;
  lockedAfter: string[];   // สถานะที่ทำให้ Field ถูกล็อก
  reason: string;          // เหตุผลแสดงให้ User เข้าใจ
}

/**
 * StatusTransitionValidator — Helper function สำหรับตรวจสอบว่าเปลี่ยนสถานะได้หรือไม่
 * ใช้ได้กับทุก Module (Sale, Purchase, Shipping)
 */
export function validateStatusTransition<T extends string>(
  current: T,
  target: T,
  transitions: Record<T, T[]>,
  labels: Record<T, string>
): void {
  const allowed = transitions[current];
  if (!allowed || !allowed.includes(target)) {
    const allowedStr = allowed?.map(s => labels[s]).join(', ') || 'ไม่มี';
    throw new ServiceError(
      `ไม่สามารถเปลี่ยนสถานะจาก "${labels[current]}" เป็น "${labels[target]}" ได้ ` +
      `(เปลี่ยนได้: ${allowedStr})`
    );
  }
}

/**
 * isFieldLocked — ตรวจสอบว่า field ถูกล็อกจากสถานะปัจจุบันหรือไม่
 */
export function isFieldLocked(
  field: string,
  currentStatus: string,
  lockRules: Record<string, string[]>
): boolean {
  const lockedStatuses = lockRules[field];
  return lockedStatuses ? lockedStatuses.includes(currentStatus) : false;
}
