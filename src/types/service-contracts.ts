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
 * @module Shop-Inventory Service Contracts
 */

import type { Prisma, Product, Customer } from '@prisma/client';
import type {
  RequestContext,
  ActionResponse,
  SaleListDTO,
  SaleDetailDTO,
  DocumentType,
  SequenceFormat,
  BatchCreateResult,
  BatchProductInput,
  GetProductsParams,
  GetSalesParams,
  GetPurchasesParams,
  GetCustomersParams,
  GetQuotationsParams,
  GetOrderRequestsParams,
  GetIncompletePurchasesParams,
  GetFinanceParams,
  PaginatedResult,
  SerializedProduct,
  SerializedSale,
  SerializedSaleWithItems,
  SerializedSaleListItem,
  SerializedPurchase,
  SerializedPurchaseWithItems,
  SerializedCustomer,
  SerializedSupplier,
  SerializedIncome,
  SerializedExpense,
  InventoryHealthMetrics,
  ReorderSuggestion,
  ShipmentStatus,
  StockAvailability,
  PurchaseType,
  TaxType,
  BillingStatus,
  Region,
  SequenceConfig,
  MutationResult,
  SerializedShipment,
  AdjustStockInput,
} from './domain';

import type { IncomeInput } from '@/schemas/accounting/income.schema';
import type { ExpenseInput } from '@/schemas/accounting/expense.schema';
import type { SaleInput } from '@/schemas/sales/sale.schema';

// ============================================================================
// PRODUCT SERVICE
// ============================================================================

export interface IProductService {
  create(ctx: RequestContext, payload: any, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedProduct>>;
  update(id: string, ctx: RequestContext, payload: any, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedProduct>>;
  getById(id: string, ctx: RequestContext): Promise<SerializedProduct>;
  getList(params: GetProductsParams, ctx: RequestContext): Promise<PaginatedResult<SerializedProduct>>;
  delete(id: string, ctx: RequestContext): Promise<MutationResult<void>>;
  getForSelect(ctx: RequestContext): Promise<Array<{ id: string; name: string; sku: string | null }>>;
  getForPurchase(ctx: RequestContext): Promise<Array<{ id: string; name: string; sku: string | null; costPrice: number }>>;
  getLowStock(limit: number, ctx: RequestContext): Promise<SerializedProduct[]>;
  getLowStockPaginated(params: GetProductsParams, ctx: RequestContext): Promise<PaginatedResult<SerializedProduct>>;
  adjustStockManual(productId: string, input: AdjustStockInput, ctx: RequestContext): Promise<MutationResult<void>>;
  batchCreate(inputs: BatchProductInput[], ctx: RequestContext): Promise<MutationResult<BatchCreateResult>>;
  getAvailability(productId: string, ctx: RequestContext): Promise<StockAvailability>;
}

// ============================================================================
// CUSTOMER SERVICE
// ============================================================================

export interface ICustomerService {
  // Existing CRUD
  create(ctx: RequestContext, payload: any): Promise<MutationResult<SerializedCustomer>>;
  update(id: string, ctx: RequestContext, payload: any): Promise<MutationResult<SerializedCustomer>>;
  getById(id: string, ctx: RequestContext): Promise<SerializedCustomer | null>;
  getList(params: GetCustomersParams, ctx: RequestContext): Promise<PaginatedResult<SerializedCustomer>>;
  delete(id: string, ctx: RequestContext): Promise<MutationResult<{ message: string; type: 'delete' | 'archive' }>>;

  // UI Support & CRM Intelligence
  getDeletionImpact(id: string, ctx: RequestContext): Promise<{
    canHardDelete: boolean;
    transactionCount: number;
    impacts: Array<{ label: string; count: number }>;
  }>;
  getForSelect(ctx: RequestContext): Promise<any[]>;
  getProfile(id: string, ctx: RequestContext): Promise<any>;
  getSalespersonsByRegion(region: string, ctx: RequestContext): Promise<any[]>;
  batchCreate(inputs: any[], ctx: RequestContext): Promise<MutationResult<any>>;

  /**
   * ตรวจสอบสถานะเครดิตของลูกค้า
   */
  checkCreditLimit(
    customerId: string,
    requestedAmount: number,
    ctx: RequestContext,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    creditLimit: number;
    currentOutstanding: number;
    availableCredit: number;
    isWithinLimit: boolean;
  }>;

  // Address Management
  getAddresses(customerId: string, ctx: RequestContext): Promise<any[]>;
  getAddressById(id: string, ctx: RequestContext): Promise<any>;
  createAddress(customerId: string, ctx: RequestContext, payload: any): Promise<MutationResult<any>>;
  updateAddress(id: string, ctx: RequestContext, payload: any): Promise<MutationResult<void>>;
  deleteAddress(id: string, ctx: RequestContext): Promise<MutationResult<void>>;
}

// ============================================================================
// SUPPLIER SERVICE
// ============================================================================

export interface ISupplierService {
  create(ctx: RequestContext, payload: any): Promise<SerializedSupplier>;
  update(id: string, ctx: RequestContext, payload: any): Promise<SerializedSupplier>;
  getById(id: string, ctx: RequestContext): Promise<SerializedSupplier>;
  getList(params: any, ctx: RequestContext): Promise<PaginatedResult<SerializedSupplier>>;
  delete(id: string, ctx: RequestContext): Promise<void>;

  // UI Support
  getForSelect(ctx: RequestContext): Promise<any[]>;
  getProfile(id: string, ctx: RequestContext): Promise<any>;

  // Supplier info management (Rule 4.4)
  getProducts(supplierId: string, ctx: RequestContext): Promise<any[]>;
  upsertProduct(supplierId: string, productId: string, data: any, ctx: RequestContext): Promise<any>;
  removeProduct(supplierId: string, productId: string, ctx: RequestContext): Promise<any>;

  // Address Management
  getAddresses(supplierId: string, ctx: RequestContext): Promise<any[]>;
  getAddressById(id: string, ctx: RequestContext): Promise<any>;
  createAddress(supplierId: string, ctx: RequestContext, payload: any): Promise<any>;
  updateAddress(id: string, ctx: RequestContext, payload: any): Promise<any>;
  deleteAddress(id: string, ctx: RequestContext): Promise<void>;
}

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
    warehouseId?: string | null
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
    tx?: Prisma.TransactionClient,
    docRef?: {
      saleId?: string;
      deliveryOrderId?: string;
      validation?: 'STRICT' | 'WARN' | 'ALLOW_NEGATIVE'
    },
    warehouseId?: string | null
  ): Promise<any>;

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
    warehouseId?: string | null
  ): Promise<void>;

  /**
   * จองสต็อกสินค้าแบบกลุ่ม (Bulk Reservation)
   * - ป้องกัน Deadlock ด้วยการ Sort productId
   * - ทำงานภายใน Transaction เดียว
   */
  bulkReserveStock(
    items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>,
    ctx: RequestContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * ตัดสต็อกจริงแบบกลุ่ม (Bulk Deduction)
   */
  bulkDeductStock(
    items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>,
    ctx: RequestContext,
    tx: Prisma.TransactionClient,
    docRef?: {
      saleId?: string;
      deliveryOrderId?: string;
      validation?: 'STRICT' | 'WARN' | 'ALLOW_NEGATIVE'
    }
  ): Promise<void>;

  /**
   * ปล่อยการจองแบบกลุ่ม (Bulk Release)
   */
  bulkReleaseStock(
    items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>,
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

  /**
   * ตรวจสอบสต็อกทุก Item ใน 1 Query (O(n) product lookup)
   * ใช้ใน DeliveryOrderService.create() และ POSSaleService
   */
  checkBulkAvailability(
    items: Array<{ productId: string; quantity: number }>,
    shopId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ allAvailable: boolean; shortages: Array<{ productId: string; required: number; available: number }> }>;

  /**
   * บันทึกการเคลื่อนไหวสต็อก (Stock Movement) และปรับยอดคงเหลือจริง
   * ใช้สำหรับการปรับปรุงยอด (Adjustment), การเคลื่อนย้าย (Transfer), หรือการรับสินค้า
   */
  recordMovement(
    ctx: RequestContext,
    params: any,
  ): Promise<MutationResult<any>>;

  /**
   * บันทึกการเคลื่อนไหวสต็อกแบบกลุ่ม
   */
  recordMovements(
    ctx: RequestContext,
    movements: any[],
    tx: Prisma.TransactionClient,
  ): Promise<MutationResult<void>>;

  /**
   * ดึงประวัติการเคลื่อนไหวสต็อกของสินค้า (Stock Logs) แบบแบ่งหน้า
   */
  getProductHistory(
    ctx: RequestContext,
    productId: string,
    page?: number,
    limit?: number,
  ): Promise<any>;
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
  // Existing CRUD & Utils
  getList(params: GetSalesParams, ctx: RequestContext, options?: { canViewProfit?: boolean }): Promise<PaginatedResult<SaleListDTO>>;
  getById(id: string, ctx: RequestContext, options?: { canViewProfit?: boolean }): Promise<SaleDetailDTO>;
  create(ctx: RequestContext, payload: SaleInput): Promise<MutationResult<SaleDetailDTO>>;
  update(id: string, ctx: RequestContext, payload: any): Promise<MutationResult<SaleDetailDTO>>;
  delete(id: string, ctx: RequestContext): Promise<MutationResult<void>>;
  cancel(input: any, ctx: RequestContext): Promise<MutationResult<void>>;

  // Aggregates & Dashboard
  getTodayAggregate(ctx: RequestContext, options?: { canViewProfit?: boolean }): Promise<{
    totalSales: number;
    saleCount: number;
    profit?: number;
  }>;
  getRecentList(limit: number, ctx: RequestContext, options?: { canViewProfit?: boolean }): Promise<SerializedSale[]>;

  // Payment Workflow
  verifyPayment(id: string, status: 'VERIFIED' | 'REJECTED', note: string | undefined, ctx: RequestContext): Promise<MutationResult<void>>;
  uploadPaymentProof(id: string, proofUrl: string, ctx: RequestContext): Promise<MutationResult<void>>;

  /**
   * ยืนยันคำสั่งซื้อ → จองสต็อกอัตโนมัติ
   * Business: Sale.status = CONFIRMED, BookingStatus = RESERVED
   */
  confirmOrder(
    saleId: string,
    ctx: RequestContext,
  ): Promise<MutationResult<void>>;

  /**
   * ออกใบกำกับภาษี → ล็อก fields สำคัญ
   * Business: Sale.status = INVOICED, เรียก SequenceService.generate()
   */
  generateInvoice(
    saleId: string,
    ctx: RequestContext,
    overrides?: Partial<SequenceConfig>,
  ): Promise<MutationResult<{ invoiceNumber: string }>>;

  /**
   * ปล่อยการจอง (ใช้เมื่อยกเลิกการขายที่มีการจองไว้)
   */
  releaseStock(
    saleId: string,
    ctx: RequestContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * ปิดรายการขาย (เมื่อ Delivery สำเร็จและชำระเงินครบ)
   * Business: Sale.status = COMPLETED, ทุก field ถูก readonly
   */
  completeSale(
    saleId: string,
    ctx: RequestContext,
    tx?: Prisma.TransactionClient,
  ): Promise<MutationResult<void>>;

  /**
   * ตรวจสอบว่า field นั้นๆ ถูกล็อกหรือไม่ (ใช้กับ UI)
   */
  getLockedFields(
    saleId: string,
    ctx: RequestContext,
  ): Promise<string[]>;
}

// ============================================================================
// QUOTATION SERVICE
// ============================================================================

export interface IQuotationService {
  list(ctx: RequestContext, params: GetQuotationsParams): Promise<PaginatedResult<any>>;
  getById(ctx: RequestContext, id: string): Promise<any>;
  create(ctx: RequestContext, input: any): Promise<MutationResult<any>>;
  confirm(ctx: RequestContext, id: string): Promise<MutationResult<any>>;
  cancel(ctx: RequestContext, id: string): Promise<MutationResult<any>>;
}

// ============================================================================
// ORDER REQUEST SERVICE
// ============================================================================

export interface IOrderRequestService {
  list(ctx: RequestContext, params: GetOrderRequestsParams): Promise<PaginatedResult<any>>;
  getById(ctx: RequestContext, id: string): Promise<any>;
  create(ctx: RequestContext, input: any): Promise<MutationResult<any>>;
  submit(ctx: RequestContext, id: string): Promise<MutationResult<any>>;
  syncStatus(ctx: RequestContext, id: string, status: any, tx?: Prisma.TransactionClient): Promise<MutationResult<any>>;
}

// ============================================================================
// POS SALE SERVICE
// ============================================================================

export interface IPOSSaleService {
  checkout(ctx: RequestContext, cart: any): Promise<MutationResult<any>>;
}

// ============================================================================
// PURCHASE SERVICE (PR/PO Workflow)
// ============================================================================

/**
 * IPurchaseService — ระบบจัดซื้อพร้อม PR → PO Workflow
 */
export interface IPurchaseService {
  // Existing CRUD
  getList(params: GetPurchasesParams, ctx: RequestContext): Promise<PaginatedResult<any>>;
  getById(id: string, ctx: RequestContext): Promise<SerializedPurchaseWithItems>;
  create(ctx: RequestContext, payload: any, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedPurchase>>;
  cancel(input: any, ctx: RequestContext): Promise<MutationResult<void>>;

  /**
   * สร้างใบขอซื้อ (Purchase Request)
   * Business: docType = 'REQUEST', status = DRAFT
   */
  createRequest(
    payload: PurchaseRequestInput,
    ctx: RequestContext,
  ): Promise<MutationResult<{ id: string; requestNumber: string }>>;

  /**
   * อนุมัติใบขอซื้อ
   * Business: PR.status = APPROVED
   */
  approveRequest(
    prId: string,
    ctx: RequestContext,
  ): Promise<MutationResult<any>>;

  /**
   * แปลง PR → PO (ดึงข้อมูลจาก PR มาสร้าง PO อัตโนมัติ)
   * Business: สร้าง PO ใหม่ + ลิงก์กลับไปยัง PR ต้นทาง
   */
  convertToPO(
    prId: string,
    ctx: RequestContext,
  ): Promise<MutationResult<{ id: string; poNumber: string }>>;

  /**
   * ตรวจสอบ MOQ ของ Vendor ก่อนบันทึก
   * Return: รายการสินค้าที่ qty < MOQ (แจ้งเตือน ไม่ Block)
   */
  checkMOQ(
    items: Array<{ productId: string; quantity: number }>,
    ctx: RequestContext,
    supplierId?: string,
  ): Promise<Array<{
    productId: string;
    productName: string;
    requestedQty: number;
    moq: number;
  }>>;

  /**
   * แบ่งสรรปันส่วนค่าใช้จ่าย (Rule 10.3)
   */
  allocateCharges(
    purchaseId: string,
    ctx: RequestContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * รับสินค้าจากการสั่งซื้อ (ORDERED -> RECEIVED) 
   * Business: เพิ่มสินค้าเข้าสต็อกจริง
   */
  receivePurchase(
    purchaseId: string,
    ctx: RequestContext,
    warehouseId?: string,
  ): Promise<MutationResult<any>>;

  /**
   * ดึงข้อมูลเงื่อนไขการสั่งซื้อจากผู้จำหน่าย (MOQ, Note)
   */
  getSupplierPurchaseInfo(
    supplierId: string,
    ctx: RequestContext
  ): Promise<{ purchaseNote: string | null; moq: number | null }>;

  /**
   * ดึงรายการ PR ที่ข้อมูลไม่ครบ (Logistics Gaps)
   */
  getIncompleteRequests(
    params: GetIncompletePurchasesParams,
    ctx: RequestContext
  ): Promise<any>;

  /**
   * มอบหมายผู้ขายแบบกลุ่ม (Admin Tool)
   */
  quickAssignSupplier(
    ids: string[],
    supplierId: string,
    ctx: RequestContext
  ): Promise<MutationResult<{ count: number }>>;

  /**
   * สร้างใบขอซื้อแบบกลุ่ม (Bulk PR Generation)
   */
  createBulkDraftPRs(
    entries: Array<{ productId: string, quantity: number, supplierId?: string }>,
    ctx: RequestContext
  ): Promise<MutationResult<{ createdCount: number }>>;
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
  // Existing CRUD & Utils
  getList(params: any, ctx: RequestContext): Promise<PaginatedResult<SerializedShipment>>;
  getById(id: string, ctx: RequestContext): Promise<any>;
  create(payload: any, ctx: RequestContext): Promise<MutationResult<SerializedShipment>>;
  update(payload: any, ctx: RequestContext): Promise<MutationResult<SerializedShipment>>;
  updateStatus(payload: any, ctx: RequestContext): Promise<MutationResult<SerializedShipment>>;
  delete(id: string, ctx: RequestContext): Promise<MutationResult<void>>;
  cancel(id: string, reason: string | undefined, ctx: RequestContext): Promise<MutationResult<SerializedShipment>>;

  // Logistics Logic
  getStats(ctx: RequestContext): Promise<Record<string, number>>;
  matchParcelsToSales(parcels: any[], ctx: RequestContext): Promise<any[]>;
  getSalesWithoutShipment(ctx: RequestContext): Promise<any[]>;
  getLogisticsGaps(ctx: RequestContext): Promise<any[]>;

  /**
   * อัปเดตสถานะจัดส่ง + Auto-Sync กลับไปยัง Sale
   * Business:
   *   SHIPPED  → Sale.bookingStatus = DEDUCTED (ตัดสต็อก)
   *   DELIVERED → Sale.status = COMPLETED
   */
  updateStatusWithSync(
    shipmentId: string,
    newStatus: ShipmentStatus,
    ctx: RequestContext,
  ): Promise<MutationResult<any>>;

  /**
   * จัดลำดับการจัดส่ง (Dispatch Sequence)
   * อัปเดต dispatchSeq ให้แต่ละ Shipment ในวันนั้น
   */
  updateDispatchSequence(
    shipmentIds: string[],
    ctx: RequestContext,
  ): Promise<MutationResult<any>>;

  /**
   * UC 11: Route Processing (Sort by Distance)
   */
  processRoute(
    ids: string[],
    type: 'OUTBOUND' | 'INBOUND',
    ctx: RequestContext,
  ): Promise<MutationResult<SerializedShipment[]>>;

  /**
   * คำนวณปริมาตรและน้ำหนักบรรทุก (Container Load Calculation)
   */
  calculateLoad(
    id: string,
    ctx: RequestContext
  ): Promise<any>;

  /**
   * ดึงรายชื่อลูกค้าที่พิกัดไม่ครบ (Logistics Gaps)
   */
  getLogisticsGaps(ctx: RequestContext): Promise<any[]>;
}

// ============================================================================
// FINANCE SERVICE (WHT + Billing Prevention)
// ============================================================================

/**
 * IFinanceService — การเงินพร้อม WHT และ Billing Prevention
 */
export interface IFinanceService {
  // --- QUERIES ---
  getIncomes(params: GetFinanceParams, ctx: RequestContext): Promise<PaginatedResult<SerializedIncome>>;
  getIncomeById(id: string, ctx: RequestContext): Promise<SerializedIncome>;
  getMonthlyIncomes(ctx: RequestContext): Promise<{ total: number; count: number }>;
  getExpenses(params: GetFinanceParams, ctx: RequestContext): Promise<PaginatedResult<SerializedExpense>>;
  getExpenseById(id: string, ctx: RequestContext): Promise<SerializedExpense>;
  getMonthlyExpenses(ctx: RequestContext): Promise<{ total: number; count: number }>;
  generateTaxReport(params: { startDate: string; endDate: string }, ctx: RequestContext): Promise<any>;

  // --- COMMANDS ---
  createIncome(data: IncomeInput, ctx: RequestContext): Promise<MutationResult<SerializedIncome>>;
  updateIncome(id: string, data: IncomeInput, ctx: RequestContext): Promise<MutationResult<SerializedIncome>>;
  deleteIncome(id: string, ctx: RequestContext): Promise<MutationResult<void>>;
  createExpense(data: ExpenseInput, ctx: RequestContext): Promise<MutationResult<SerializedExpense>>;
  updateExpense(id: string, data: ExpenseInput, ctx: RequestContext): Promise<MutationResult<SerializedExpense>>;
  deleteExpense(id: string, ctx: RequestContext): Promise<MutationResult<void>>;
  markAsBilled(saleId: string, ctx: RequestContext): Promise<MutationResult<void>>;
}

// ============================================================================
// CRM SERVICE (Region-Salesperson Mapping)
// ============================================================================

/**
 * ICRMService — ระบบ Contact Intelligence
 */
export interface ICRMService {
  // --- QUERIES ---
  getSalespersonsByRegion(region: Region, ctx: RequestContext): Promise<Array<{ userId: string; name: string; email: string | null }>>;
  suggestSalesperson(customerId: string, ctx: RequestContext): Promise<{ suggested: Array<{ userId: string; name: string }>; region: Region | null }>;
  checkCreditLimit(customerId: string, requestedAmount: number, ctx: RequestContext): Promise<{ creditLimit: number; currentOutstanding: number; availableCredit: number; isWithinLimit: boolean }>;
}

// ============================================================================
// IAM SERVICE (Identity & Access Management)
// ============================================================================

export interface IIamService {
  // --- QUERIES ---
  getRoles(ctx: RequestContext): Promise<any[]>;
  getRole(id: string, ctx: RequestContext): Promise<any>;
  getTeamMembers(ctx: RequestContext): Promise<any[]>;
  getShopTeamInfo(ctx: RequestContext): Promise<any>;
  getPermissionVersion(userId: string, shopId?: string): Promise<{ version: number } | null>;
  getMyPermissions(userId: string): Promise<any>;
  getProfile(userId: string): Promise<any>;

  // --- COMMANDS ---
  createRole(input: any, ctx: RequestContext): Promise<{ id: string }>;
  updateRole(id: string, input: any, ctx: RequestContext): Promise<void>;
  deleteRole(id: string, ctx: RequestContext): Promise<void>;
  updateMemberRole(memberId: string, roleId: string, ctx: RequestContext): Promise<void>;
  removeMember(memberId: string, ctx: RequestContext): Promise<void>;
  inviteMember(input: any, ctx: RequestContext): Promise<void>;
  updateUserActivity(userId: string): Promise<void>;
  registerUser(data: any): Promise<any>;
  revokeSessions(targetUserId: string, ctx: RequestContext): Promise<void>;
  updatePassword(ctx: RequestContext, input: any): Promise<void>;
}

// ============================================================================
// ANALYTICS & INTELLIGENCE
// ============================================================================

export interface IInventoryAnalyticsService {
  /**
   * ดึงข้อมูลสุขภาพสต็อกของสินค้า (Velocity, Lead Time, ROP)
   */
  getProductMetrics(productId: string, ctx: RequestContext): Promise<InventoryHealthMetrics>;

  /**
   * รวมรายการสินค้าที่ควรสั่งซื้อใหม่ (Suggestions)
   */
  getSuggestions(ctx: RequestContext): Promise<ReorderSuggestion[]>;
}
// ============================================================================
// WAREHOUSE SERVICE
// ============================================================================

export interface IWarehouseService {
  /**
   *ดึงรายชื่อคลังสินค้าทั้งหมด
   */
  getWarehouses(ctx: RequestContext): Promise<any[]>;

  /**
   * สร้างคลังสินค้าใหม่
   */
  createWarehouse(
    ctx: RequestContext,
    data: { name: string; code: string; address?: string; isDefault?: boolean }
  ): Promise<MutationResult<any>>;

  /**
   * ดึงข้อมูลสต็อกแยกตามคลังสินค้า
   */
  getProductStockBreakdown(ctx: RequestContext, productId: string): Promise<any[]>;

  /**
   * ปรับปรุงสต็อกในคลังสินค้าที่ระบุ
   */
  adjustWarehouseStock(
    ctx: RequestContext,
    params: { warehouseId: string; productId: string; delta: number },
    tx?: any
  ): Promise<MutationResult<any>>;

  /**
   * ซิงค์ยอดสต็อกรวมของสินค้าจากสต็อกย่อยในคลัง
   */
  syncGlobalProductStock(ctx: RequestContext, productId: string, tx?: any): Promise<number>;

  /**
   * ค้นหาคลังสินค้าหลัก
   */
  getDefaultWarehouse(ctx: RequestContext): Promise<any>;

  /**
   * ตรวจสอบและสร้างคลังสินค้าหลักหากยังไม่มี (Auto-provision)
   */
  ensureDefaultWarehouse(ctx: RequestContext, tx?: any): Promise<any>;

  /**
   * โอนย้ายสินค้าระหว่างคลังสินค้า
   */
  transferStock(
    ctx: RequestContext,
    input: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; notes?: string }
  ): Promise<MutationResult<void>>;
}

// ============================================================================
// STOCK TAKE SERVICE
// ============================================================================

export interface IStockTakeService {
  /**
   * สร้าง Session การตรวจนับใหม่
   */
  createSession(
    productIds: string[],
    notes: string | undefined,
    ctx: RequestContext,
    warehouseId?: string
  ): Promise<MutationResult<any>>;

  /**
   * อัปเดตปริมาณที่นับได้จริงใน Session
   */
  updateActualCount(
    sessionId: string,
    productId: string,
    countedQty: number,
    note: string | undefined,
    ctx: RequestContext
  ): Promise<MutationResult<any>>;

  /**
   * ส่งตรวจ (SUBMIT)
   */
  submitSession(sessionId: string, ctx: RequestContext): Promise<MutationResult<any>>;

  /**
   * อนุมัติและปรับปรุงสต็อก (COMPLETE)
   */
  completeSession(sessionId: string, ctx: RequestContext): Promise<MutationResult<any>>;

  /**
   * ยกเลิก Session
   */
  cancelSession(sessionId: string, reason: string, ctx: RequestContext): Promise<MutationResult<any>>;

  /**
   * ดึงข้อมูลรายละเอียด Session
   */
  getSessionDetails(sessionId: string, ctx: RequestContext): Promise<any>;
}

// ============================================================================
// STOCK TRANSFER SERVICE
// ============================================================================

export interface IStockTransferService {
  createTransfer(
    ctx: RequestContext,
    data: {
      fromWarehouseId: string;
      toWarehouseId: string;
      lines: Array<{ productId: string; quantity: number }>;
      notes?: string;
    }
  ): Promise<MutationResult<any>>;

  completeTransfer(ctx: RequestContext, transferId: string): Promise<MutationResult<any>>;

  getTransfers(ctx: RequestContext): Promise<any[]>;
}

// ============================================================================
// JOURNAL SERVICE
// ============================================================================

export interface IJournalService {
  createEntry(
    ctx: RequestContext,
    input: {
      journalDate: Date;
      description?: string;
      lines: Array<{
        accountId: string;
        description?: string;
        debitAmount: number;
        creditAmount: number;
        partnerId?: string;
        partnerType?: string;
      }>;
      status?: 'DRAFT' | 'POSTED';
      sourceType?: string;
      sourceId?: string;
      sourceNo?: string;
      postingPurpose?: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<MutationResult<any>>;

  postEntry(id: string, ctx: RequestContext): Promise<MutationResult<any>>;

  voidEntry(id: string, ctx: RequestContext): Promise<MutationResult<any>>;

  getEntries(
    ctx: RequestContext,
    params: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedResult<any>>;

  getEntryBySource(ctx: RequestContext, sourceType: string, sourceId: string): Promise<any>;

  reverseEntry(
    ctx: RequestContext,
    originalEntryId: string,
    tx?: Prisma.TransactionClient
  ): Promise<MutationResult<any>>;
}

// ============================================================================
// BANK SERVICE
// ============================================================================

export interface IBankService {
  createBankAccount(data: {
    shopId: string;
    userId: string;
    name: string;
    bankName: string;
    accountNo: string;
    glAccountId: string;
    currency?: string;
  }): Promise<MutationResult<any>>;

  importStatement(data: {
    shopId: string;
    memberId: string;
    bankAccountId: string;
    statementDate: Date;
    openingBalance: number;
    closingBalance: number;
    lines: Array<{
      bookingDate: Date;
      valueDate?: Date;
      description: string;
      referenceNo?: string;
      debitAmount: number;
      creditAmount: number;
    }>;
  }): Promise<MutationResult<{ statement: any; linesImported: number }>>;

  getMatchCandidates(bankLineId: string): Promise<any[]>;

  matchLine(
    bankLineId: string,
    journalLineIds: string[],
    memberId: string
  ): Promise<MutationResult<any>>;
}

// ============================================================================
// PURCHASE TAX SERVICE
// ============================================================================

export interface IPurchaseTaxService {
  registerFromPurchase(purchaseId: string, ctx: RequestContext): Promise<MutationResult<any>>;

  post(
    id: string,
    input: { vendorDocNo: string; vendorDocDate: Date; claimStatus: string },
    ctx: RequestContext
  ): Promise<MutationResult<any>>;

  void(id: string, ctx: RequestContext): Promise<MutationResult<any>>;

  getList(params: any, ctx: RequestContext): Promise<PaginatedResult<any>>;

  getById(id: string, ctx: RequestContext): Promise<any>;
}

// ============================================================================
// WHT SERVICE
// ============================================================================

export interface IWhtService {
  calculate(params: {
    amount: number | Prisma.Decimal;
    rate: number | Prisma.Decimal;
    isGrossUp?: boolean;
  }): {
    grossPayableAmount: number;
    whtBaseAmount: number;
    whtAmount: number;
    netPaidAmount: number;
    rate: number;
  };

  createEntry(ctx: RequestContext, params: any, tx?: any): Promise<MutationResult<any>>;

  getReportData(
    ctx: RequestContext,
    params: { year: number; month: number; formType: any }
  ): Promise<{ data: any[]; totals: { base: Prisma.Decimal; tax: Prisma.Decimal } }>;

  getCodes(ctx: RequestContext): Promise<any[]>;

  getEntryById(id: string, ctx: RequestContext): Promise<any>;

  issueCertificate(ctx: RequestContext, entryId: string): Promise<MutationResult<any>>;

  voidCertificate(ctx: RequestContext, certId: string): Promise<MutationResult<any>>;
}

// ============================================================================
// TAX SETTINGS SERVICE
// ============================================================================

export interface ITaxSettingsService {
  getCompanyTaxProfile(ctx: RequestContext): Promise<any>;

  upsertCompanyTaxProfile(input: any, ctx: RequestContext): Promise<MutationResult<any>>;

  listTaxCodes(ctx: RequestContext): Promise<any[]>;

  listActiveTaxCodes(ctx: RequestContext, direction?: 'OUTPUT' | 'INPUT'): Promise<any[]>;

  getTaxCodeByCode(code: string, ctx: RequestContext): Promise<any>;

  createTaxCode(input: any, ctx: RequestContext): Promise<MutationResult<any>>;

  updateTaxCode(code: string, input: any, ctx: RequestContext): Promise<MutationResult<any>>;

  toggleTaxCode(code: string, isActive: boolean, ctx: RequestContext): Promise<MutationResult<any>>;

  getPartnerTaxProfile(
    partnerId: string,
    partnerType: 'customer' | 'supplier',
    ctx: RequestContext
  ): Promise<any>;

  upsertPartnerTaxProfile(input: any, ctx: RequestContext): Promise<MutationResult<any>>;

  getProductTaxProfile(productId: string, ctx: RequestContext): Promise<any>;

  upsertProductTaxProfile(productId: string, input: any, ctx: RequestContext): Promise<MutationResult<any>>;

  getSalesTaxReport(month: number, year: number, ctx: RequestContext): Promise<any>;

  getPurchaseTaxReport(month: number, year: number, ctx: RequestContext): Promise<any>;

  postSalesTaxEntry(input: any, ctx: RequestContext, tx?: any): Promise<MutationResult<any>>;

  postPurchaseTaxEntry(input: any, ctx: RequestContext, tx?: any): Promise<MutationResult<any>>;

  voidTaxEntries(sourceType: string, sourceId: string, ctx: RequestContext): Promise<MutationResult<void>>;
}
