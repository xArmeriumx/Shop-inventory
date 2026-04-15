/**
 * ============================================================================
 * ERP-Namfon: Service Interface Contracts
 * ============================================================================
 *
 * ไฟล์นี้กำหนด "สัญญา" (Contract) ของทุก Service ในระบบ ERP
 * ทุกคนที่จะเขียน Service ใหม่ หรือแก้ไข Service เดิม ต้องทำตาม Interface นี้
 *
 * ใช้เป็นคู่มือสำหรับ:
 * 1. นักพัฒนาใหม่ — อ่านแล้วรู้ว่า Service แต่ละตัวมีฟังก์ชันอะไรบ้าง
 * 2. Code Review — ตรวจสอบว่า Implementation ตรงกับ Contract หรือไม่
 * 3. Testing — Mock Service ตาม Interface นี้ได้ทันที
 *
 * @module ERP Service Contracts
 */

import type { Prisma } from '@prisma/client';
import type {
  RequestContext,
  ActionResponse,
  DocumentType,
  SequenceFormat,
  SequenceConfig,
  BookingStatus,
  SaleStatus,
  PurchaseType,
  PurchaseDocType,
  PurchaseStatus,
  ShippingStatus,
  TaxType,
  BillingStatus,
  Region,
  StockAvailability,
  StockMovement,
} from './erp';

// ============================================================================
// SEQUENCE SERVICE (SSOT: เลขที่เอกสาร)
// ============================================================================

/**
 * ISequenceService — ศูนย์กลางการรันเลขที่เอกสาร
 *
 * Rules:
 * - ทุก Service ที่ต้องการเลขเอกสารต้องเรียกผ่านตัวนี้เท่านั้น
 * - ห้ามสร้าง Logic รันเลขแยกในแต่ละ Service
 * - ต้องรองรับ Concurrent access (ใช้ upsert + atomic increment)
 *
 * @example
 * // ใน SaleService.create()
 * const invoiceNumber = await SequenceService.generate(ctx, 'INV', tx);
 *
 * // ใน PurchaseService.create() - ใบสั่งซื้อต่างประเทศ
 * const poNumber = await SequenceService.generate(ctx, 'PO', tx, { prefix: 'C' });
 */
export interface ISequenceService {
  /**
   * สร้างเลขเอกสารใหม่ (Atomic, Race-safe)
   *
   * @param ctx       - User context (userId, shopId)
   * @param docType   - ประเภทเอกสาร (INV, PO, PR, SHP, RET, ...)
   * @param tx        - Prisma Transaction Client (บังคับ — ต้องเรียกภายใน $transaction เท่านั้น)
   * @param overrides - ค่าที่ต้องการ override จาก Shop config
   * @returns         - เลขเอกสาร เช่น "INV-2604-00001", "K-PO-2604-00003"
   */
  generate(
    ctx: RequestContext,
    docType: DocumentType,
    tx: Prisma.TransactionClient,
    overrides?: Partial<SequenceConfig>,
  ): Promise<string>;

  /**
   * ดึง Counter ปัจจุบัน (สำหรับแสดงใน Dashboard/Reports)
   */
  getCurrentCounter(
    ctx: RequestContext,
    docType: DocumentType,
  ): Promise<number>;

  /**
   * Preview เลขถัดไป (ไม่บันทึก — สำหรับแสดงใน UI ก่อน Confirm)
   */
  preview(
    ctx: RequestContext,
    docType: DocumentType,
    overrides?: Partial<SequenceConfig>,
  ): Promise<string>;
}

// ============================================================================
// STOCK SERVICE (Enhanced with Reservation)
// ============================================================================

/**
 * IStockService — การจัดการสต็อกแบบมี Reservation
 *
 * Rules:
 * - `reserve`: เพิ่ม reservedStock อย่างเดียว ไม่ลด onHand
 * - `deduct`:  ลด onHand + ลด reservedStock พร้อมกัน
 * - `release`: ลด reservedStock (เมื่อยกเลิก Sale ที่จองไว้)
 * - ทุกการดำเนินการต้องอยู่ภายใน Transaction
 */
export interface IStockService {
  /**
   * จองสต็อกสินค้า (เมื่อ Sale เปลี่ยนสถานะเป็น CONFIRMED)
   * - เพิ่ม reservedStock
   * - ตรวจสอบ available (onHand - reserved) >= quantity
   */
  reserveStock(
    productId: string,
    quantity: number,
    ctx: RequestContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * ตัดสต็อกจริง (เมื่อ Delivery confirmed หรือ Shipment = DELIVERED)
   * - ลด onHand
   * - ลด reservedStock ที่จองไว้
   */
  deductStock(
    productId: string,
    quantity: number,
    ctx: RequestContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * ปล่อยการจอง (เมื่อ Sale ถูก Cancel ก่อนส่งของ)
   * - ลด reservedStock
   * - ไม่กระทบ onHand
   */
  releaseStock(
    productId: string,
    quantity: number,
    ctx: RequestContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * ดึงสถานะสต็อกแบบ Business-Ready
   * (onHand, reserved, available, isLowStock)
   */
  getAvailability(
    productId: string,
    ctx: RequestContext,
  ): Promise<StockAvailability>;
}

// ============================================================================
// SALE SERVICE (Enhanced with Status Machine)
// ============================================================================

/**
 * ISaleService — ระบบการขายพร้อม Status Machine
 *
 * New Methods (เพิ่มจากเดิม):
 * - confirmOrder:  Draft → Confirmed (จองสต็อก)
 * - generateInvoice: Confirmed → Invoiced (ออกเลข Invoice)
 * - completeSale:  Invoiced → Completed (ปิดรายการ)
 */
export interface ISaleService {
  /**
   * ยืนยันคำสั่งซื้อ → จองสต็อกอัตโนมัติ
   * Business: Sale.status = CONFIRMED, BookingStatus = RESERVED
   */
  confirmOrder(
    saleId: string,
    ctx: RequestContext,
  ): Promise<void>;

  /**
   * ออกใบกำกับภาษี → ล็อก fields สำคัญ
   * Business: Sale.status = INVOICED, เรียก SequenceService.generate()
   */
  generateInvoice(
    saleId: string,
    ctx: RequestContext,
    overrides?: Partial<SequenceConfig>,
  ): Promise<{ invoiceNumber: string }>;

  /**
   * ปิดรายการขาย (เมื่อ Delivery สำเร็จและชำระเงินครบ)
   * Business: Sale.status = COMPLETED, ทุก field ถูก readonly
   */
  completeSale(
    saleId: string,
    ctx: RequestContext,
  ): Promise<void>;

  /**
   * ตรวจสอบว่า field นั้นๆ ถูกล็อกหรือไม่ (ใช้กับ UI)
   */
  getLockedFields(
    saleId: string,
    ctx: RequestContext,
  ): Promise<string[]>;
}

// ============================================================================
// PURCHASE SERVICE (PR/PO Workflow)
// ============================================================================

/**
 * IPurchaseService — ระบบจัดซื้อพร้อม PR → PO Workflow
 */
export interface IPurchaseService {
  /**
   * สร้างใบขอซื้อ (Purchase Request)
   * Business: docType = 'REQUEST', status = DRAFT
   */
  createRequest(
    payload: PurchaseRequestInput,
    ctx: RequestContext,
  ): Promise<{ id: string; requestNumber: string }>;

  /**
   * อนุมัติใบขอซื้อ
   * Business: PR.status = APPROVED
   */
  approveRequest(
    prId: string,
    ctx: RequestContext,
  ): Promise<void>;

  /**
   * แปลง PR → PO (ดึงข้อมูลจาก PR มาสร้าง PO อัตโนมัติ)
   * Business: สร้าง PO ใหม่ + ลิงก์กลับไปยัง PR ต้นทาง
   */
  convertToPO(
    prId: string,
    ctx: RequestContext,
  ): Promise<{ id: string; poNumber: string }>;

  /**
   * ตรวจสอบ MOQ ของ Vendor ก่อนบันทึก
   * Return: รายการสินค้าที่ qty < MOQ (แจ้งเตือน ไม่ Block)
   */
  checkMOQ(
    items: Array<{ productId: string; quantity: number }>,
    ctx: RequestContext,
  ): Promise<Array<{
    productId: string;
    productName: string;
    requestedQty: number;
    moq: number;
  }>>;
}

/** Input สำหรับสร้างใบขอซื้อ */
export interface PurchaseRequestInput {
  supplierId?: string | null;
  purchaseType: PurchaseType;
  notes?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    costPrice: number;
  }>;
}

// ============================================================================
// SHIPPING SERVICE (Enhanced with Auto-Sync)
// ============================================================================

/**
 * IShippingService — การจัดส่งพร้อม Auto-Sync กลับไปยัง Sale
 */
export interface IShippingService {
  /**
   * อัปเดตสถานะจัดส่ง + Auto-Sync กลับไปยัง Sale
   * Business:
   *   SHIPPED  → Sale.bookingStatus = DEDUCTED (ตัดสต็อก)
   *   DELIVERED → Sale.status = COMPLETED
   */
  updateStatusWithSync(
    shipmentId: string,
    newStatus: ShippingStatus,
    ctx: RequestContext,
  ): Promise<void>;

  /**
   * จัดลำดับการจัดส่ง (Dispatch Sequence)
   * อัปเดต dispatchSeq ให้แต่ละ Shipment ในวันนั้น
   */
  updateDispatchSequence(
    shipmentIds: string[],
    ctx: RequestContext,
  ): Promise<void>;
}

// ============================================================================
// FINANCE SERVICE (WHT + Billing Prevention)
// ============================================================================

/**
 * IFinanceService — การเงินพร้อม WHT และ Billing Prevention
 */
export interface IFinanceService {
  /**
   * คำนวณภาษีหัก ณ ที่จ่าย
   */
  calculateWHT(
    amount: number,
    taxType: TaxType,
  ): { taxAmount: number; netAmount: number };

  /**
   * คำนวณ VAT
   */
  calculateVAT(
    amount: number,
    isVatInclusive: boolean,
  ): { vatAmount: number; baseAmount: number; totalAmount: number };

  /**
   * เช็คว่า Invoice ถูกดึงเข้าสู่ Billing Statement แล้วหรือยัง
   * ใช้ป้องกันการดึงบิลซ้ำ
   */
  checkBillingStatus(
    invoiceIds: string[],
    ctx: RequestContext,
  ): Promise<Array<{
    invoiceId: string;
    invoiceNumber: string;
    billingStatus: BillingStatus;
    billingStatementNumber?: string;
  }>>;

  /**
   * สร้าง Billing Statement (วางบิล)
   * Business: ดึง Invoice หลายใบรวมกัน + ป้องกันซ้ำ
   */
  createBillingStatement(
    invoiceIds: string[],
    dueDate: Date,
    ctx: RequestContext,
  ): Promise<{ id: string; billingNumber: string; totalAmount: number }>;
}

// ============================================================================
// CRM SERVICE (Region-Salesperson Mapping)
// ============================================================================

/**
 * ICRMService — ระบบ Contact Intelligence
 */
export interface ICRMService {
  /**
   * ดึงเซลที่ดูแลภูมิภาคนั้นๆ (Many-to-Many)
   * ใช้เมื่อ User เลือก Region ในหน้า Contact
   */
  getSalespersonsByRegion(
    region: Region,
    ctx: RequestContext,
  ): Promise<Array<{
    userId: string;
    name: string;
    email: string | null;
  }>>;

  /**
   * แนะนำเซลสำหรับลูกค้า (Smart Default)
   * Logic: Customer.region → ดึงเซลที่ดูแลภาคนั้น
   */
  suggestSalesperson(
    customerId: string,
    ctx: RequestContext,
  ): Promise<{
    suggested: Array<{ userId: string; name: string }>;
    region: Region | null;
  }>;

  /**
   * ตรวจสอบวงเงินเครดิต
   * Return: เหลือวงเงินเท่าไหร่ + ยอดค้างชำระทั้งหมด
   */
  checkCreditLimit(
    customerId: string,
    requestedAmount: number,
    ctx: RequestContext,
  ): Promise<{
    creditLimit: number;
    currentOutstanding: number;
    availableCredit: number;
    isWithinLimit: boolean;
  }>;
}
