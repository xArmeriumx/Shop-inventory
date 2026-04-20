# ERP System Architecture & Context

> เอกสารนี้เป็นการสรุป “สิ่งที่ทราบจากบริบทของระบบ ERP นี้” จากการคุยและการออกแบบที่ผ่านมา ไม่ใช่ dump จาก source code จริงทั้งหมด
> 
> เป้าหมายคือทำให้ agent / developer คนใหม่เข้าใจระบบเร็วที่สุด และสามารถนำไปวางโครงสร้างใหม่แบบ **clean code + TypeScript-first** ได้ทันที

---

## 1) เป้าหมายของระบบ

ระบบ ERP นี้เป็นระบบบริหารงานธุรกิจที่ต่อยอดจากแนวคิดของ Odoo แต่มีการ customize หนักในระดับธุรกิจจริง โดยเน้นงานหลักดังนี้

- จัดการข้อมูลลูกค้า / ผู้ขาย / ผู้ติดต่อ
- รองรับกระบวนการขายตั้งแต่ Quotation → Sales Order → Delivery → Invoice
- รองรับกระบวนการจัดซื้อจากคำขอภายใน → PR → PO → รับสินค้า / Shipping / Billing
- รองรับการติดตามสถานะงาน, เอกสาร, เอกสารแนบ, approval และ audit trail
- รองรับการพิมพ์เอกสารธุรกิจ เช่น Quotation, Commercial Invoice, Packing List, Tax Invoice
- รองรับเลขเอกสารแบบมี business rule ซับซ้อน เช่น แยกตามแผนก, ประเภทเอกสาร, เดือน, ปี, journal
- รองรับการอัปเดตสถานะข้ามเอกสาร เช่น สถานะจาก PR กลับไปยัง Order Request หรือสถานะ Delivery กลับไปยัง SO
- เน้นความสอดคล้องของข้อมูลทุกจุด: หน้าจอ, export, report, PDF และ workflow จริง

ระบบนี้จึงไม่ใช่แค่ CRUD ทั่วไป แต่เป็น **workflow-driven business system** ที่กฎธุรกิจสำคัญกว่าหน้าจอ

---

## 2) แนวคิดสำคัญของระบบ

### 2.1 Single Source of Truth
ข้อมูลคำนวณสำคัญ เช่น จำนวน, stock status, packaging qty, carton count, tax, discount, exchange rate, delivery status ต้องมีต้นทางชัดเจน และห้ามแต่ละหน้าคิดคนละแบบ

### 2.2 Document Chain Integrity
เอกสารแต่ละตัวไม่ควรลอยเดี่ยว แต่ต้อง trace กลับได้ เช่น

- Order Request → PR → PO
- SO → Delivery → Invoice
- PO → Shipping / Import Docs / Commercial Invoice

### 2.3 Status Synchronization
สถานะของเอกสารหนึ่งต้องสะท้อนกลับไปยังเอกสารต้นทางหรืองานที่เกี่ยวข้องได้ เช่น

- PR confirmed แล้ว Order Request ต้องเห็นว่า “ยืนยัน PR แล้ว”
- SO กลายเป็น Sale Order แล้ว status stock ต้องเปลี่ยนเป็น “จองสต็อคแล้ว”
- Delivery validate แล้วต้องกลายเป็น “ตัดสต็อคแล้ว”

### 2.4 Business-first Numbering
เลขเอกสารไม่ใช่ auto-increment ธรรมดา แต่เป็น business identity เช่น

- prefix ตาม department
- prefix ตาม type (เช่น de → OD)
- reset รายเดือน / รายปี
- ใช้ปี พ.ศ. หรือรูปแบบ YYMM

### 2.5 UI-level Customization Friendly
ระบบต้นทางเคยมีข้อจำกัดว่าแก้ backend ตรง ๆ ไม่ได้ จึงต้องออกแบบ logic ที่ย้ายไป service layer ได้ และถ้าจำเป็นต้องลง low-code / rule engine ก็ยังแยกได้ง่าย

---

## 3) ภาพรวมโดเมนหลักของระบบ

ระบบนี้แบ่งโดเมนได้ประมาณนี้

1. **Master Data**
   - Partner / Contact
   - Product / Product Category / Product Group
   - UOM / Packaging / MOQ
   - Employee / Salesperson / Department / Region
   - Tax / Currency / Credit Term
   - Shipping Company / Factory / Document Type

2. **Sales Domain**
   - Quotation
   - Sales Order
   - Delivery status tracking
   - Invoice generation / tax invoice / billing relation

3. **Purchase Domain**
   - Order Request / Internal request
   - Purchase Request / approval request
   - Purchase Order
   - Vendor / import purchase / domestic purchase logic

4. **Inventory Domain**
   - Reservation state
   - Delivery validation
   - Receive / issue / transfer / return
   - Batch / serial / stock movement

5. **Shipping & Logistics Domain**
   - Shipping record
   - Shipping sequence
   - Container capacity / shipping mode / FCL-LCL / sea-air
   - Create Bill from Shipping
   - รับเข้า / ส่งต่อฝ่ายรับเข้า

6. **Document & Report Domain**
   - QWeb / PDF templates
   - Export CSV / Excel
   - Attachments / document register
   - Commercial invoice / packing list / quotation reports

7. **Approval Domain**
   - Multi-level approval
   - ผู้ขอ / ผู้อนุมัติ / ลำดับอนุมัติ / เวลา / เหตุผลไม่อนุมัติ

8. **Platform / Cross-cutting**
   - Sequence generation
   - Audit log
   - Permission / role
   - Validation / workflow transitions
   - Status sync / automation engine

---

## 4) โครงสร้างเชิงสถาปัตยกรรมที่แนะนำสำหรับ TypeScript

แม้ระบบต้นทางคือ Odoo customization แต่ถ้าจะ clone ระบบนี้ใหม่ใน TypeScript ควรแยกชั้นประมาณนี้

```text
src/
  app/
    (route groups)
  modules/
    partner/
    product/
    sales/
    purchase/
    inventory/
    shipping/
    approval/
    report/
    sequence/
    auth/
  lib/
    db/
    validation/
    money/
    tax/
    date/
    permissions/
    errors/
  shared/
    types/
    constants/
    interfaces/
    enums/
```

### 4.1 Recommended Layering

```text
UI / Route Layer
  -> use cases / actions
  -> services (business logic)
  -> repositories (DB access)
  -> database
```

### 4.2 Suggested Folder Structure per Module

```text
modules/sales/
  domain/
    sales-order.types.ts
    sales-order.interfaces.ts
    sales-order.enums.ts
  services/
    create-quotation.service.ts
    confirm-sales-order.service.ts
    sync-stock-status.service.ts
    generate-invoice-from-so.service.ts
  repositories/
    sales-order.repository.ts
    quotation.repository.ts
  validators/
    sales-order.schema.ts
  mappers/
    sales-order.mapper.ts
  queries/
    get-sales-order-detail.query.ts
    list-sales-orders.query.ts
```

### 4.3 Recommended Design Principles

- 1 service = 1 งานหลัก
- แยก command กับ query
- ห้ามใส่ business rule ไว้ใน component
- repository ห้ามคำนวณธุรกิจ
- validation ต้องอยู่ก่อน business action
- shared enum / interface ต้องประกาศต้นทางชัด
- state transition ต้องมี guard เสมอ

---

## 5) Core Entities ที่ระบบนี้ควรมี

ด้านล่างคือ entity หลักที่ตีความได้จากระบบ

### 5.1 Partner / Contact
ใช้เก็บลูกค้า, vendor, both, ผู้ติดต่อ, ข้อมูลภาษี, เครดิต, ทีมขาย, ภาค, เขต

```ts
export interface Partner {
  id: string;
  code: string;
  name: string;
  type: 'customer' | 'vendor' | 'both';
  taxId?: string;
  creditDays?: number;
  rating?: number;
  province?: string;
  regionId?: string;
  address?: Address;
  phone?: string;
  email?: string;
  salespersonIds: string[];
  departmentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  line1?: string;
  line2?: string;
  district?: string;
  subDistrict?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}
```

#### ความสามารถหลัก
- สร้างลูกค้า / ผู้ขาย
- ผูกทีมขายหลายคนได้
- ผูกภาค / region เพื่อเด้ง sales ที่รับผิดชอบ
- เก็บเลขภาษี, เครดิต, เขตการขาย, กลุ่มลูกค้า
- ใช้เป็นต้นทางของเอกสารขาย/ซื้อ/ส่งของ/วางบิล

---

### 5.2 Employee / Salesperson / Department

```ts
export interface Employee {
  id: string;
  code: string;
  name: string;
  departmentCode?: string;
  regionIds: string[];
  email?: string;
  phone?: string;
  userId?: string;
  isActive: boolean;
}
```

#### ความสามารถหลัก
- เป็นคนเปิดเอกสาร
- ใช้ determine prefix เอกสาร
- ใช้ map ลูกค้าตาม region
- ใช้ derive requester / position / department

---

### 5.3 Product

```ts
export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId?: string;
  groupId?: string;
  uomId: string;
  saleOk: boolean;
  purchaseOk: boolean;
  activeState: 'active' | 'inactive';
  minQuantity?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  packagingOptions: ProductPackaging[];
}

export interface ProductPackaging {
  id: string;
  name: string;
  qtyPerPack: number;
  uomId: string;
}
```

#### ความสามารถหลัก
- เก็บ SKU, ชื่อ, group/category
- รองรับ UOM และ packaging แยกกัน
- ใช้คำนวณ CTN / packaging qty
- ใช้เช็ก min quantity / stock / reservation
- สามารถมีสถานะ active แล้ว auto sale_ok = true

---

### 5.4 Sales Document

```ts
export interface SalesOrder {
  id: string;
  docNo: string;
  type: 'quotation' | 'sales_order';
  customerId: string;
  salespersonId?: string;
  departmentCode?: string;
  lines: SalesOrderLine[];
  status: SalesOrderStatus;
  stockStatus?: SalesStockStatus;
  deliveryStatus?: DeliveryStatus;
  currencyCode: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  billingState?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderLine {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  uomId: string;
  unitPrice: number;
  discountPercent?: number;
  taxIds: string[];
  lineTotal: number;
  displayType?: 'section' | 'note';
  sortOrder: number;
}

export type SalesOrderStatus =
  | 'draft'
  | 'sent'
  | 'confirmed'
  | 'cancelled';

export type SalesStockStatus =
  | 'ยังไม่จองสต็อค'
  | 'จองสต็อคแล้ว'
  | 'ตัดสต็อคแล้ว';

export type DeliveryStatus =
  | 'new'
  | 'waiting'
  | 'process'
  | 'confirm'
  | 'done';
```

#### ความสามารถหลัก
- ออกใบเสนอราคา
- confirm เป็น Sales Order
- ติดตาม stock status
- ติดตาม delivery status
- ใช้เป็นต้นทางออก invoice
- คุมการแก้ไขบาง field หลังมี invoice หรือ billing แล้ว

---

### 5.5 Purchase Flow Entities

```ts
export interface OrderRequest {
  id: string;
  docNo: string;
  requesterId: string;
  departmentCode?: string;
  lines: OrderRequestLine[];
  requestStatusText?: string;
  status: 'draft' | 'submitted' | 'approved' | 'in_progress' | 'done' | 'cancelled';
}

export interface PurchaseRequest {
  id: string;
  docNo: string;
  orderRequestId?: string;
  vendorId?: string;
  stateBlanketOrder?: string;
  status: 'draft' | 'submitted' | 'approved' | 'cancelled';
}

export interface PurchaseOrder {
  id: string;
  docNo: string;
  purchaseType: 'domestic' | 'foreign';
  vendorId: string;
  originRequestId?: string;
  shippingId?: string;
  currencyCode: string;
  lines: PurchaseOrderLine[];
  status: 'draft' | 'sent' | 'purchase' | 'done' | 'cancelled';
}

export interface PurchaseOrderLine {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  uomId: string;
  unitPrice: number;
  packagingQty?: number;
  cartonQty?: number;
  moq?: number;
}
```

#### ความสามารถหลัก
- รับคำขอซื้อจากฝั่งงานภายใน
- ผ่าน approval ก่อนสร้าง PO
- แยก domestic / foreign
- default tax ต่างกันตามประเภท
- แสดง MOQ จาก vendor ลง PO line
- เชื่อมไป shipping และเอกสารนำเข้า

---

### 5.6 Shipping Entity

```ts
export interface ShippingRecord {
  id: string;
  docNo: string;
  poIds: string[];
  partnerId?: string;
  shippingMode?: 'sea' | 'air';
  containerLoadType?: 'FCL' | 'LCL';
  status: 'new' | 'process' | 'confirm' | 'done' | 'cancelled';
  etd?: string;
  eta?: string;
  internalNote?: string;
  billId?: string;
}
```

#### ความสามารถหลัก
- เก็บการขนส่งของ PO
- แยก mode ขนส่ง
- คำนวณ / บันทึกการจุตู้
- สร้าง bill จาก shipping
- ทำเอกสาร INV / PL / PI / CI ใน shipping flow

---

### 5.7 Approval Entity

```ts
export interface ApprovalRecord {
  id: string;
  sourceType: 'order_request' | 'purchase_request' | 'purchase_order' | 'sales_order' | 'stock_adjustment';
  sourceId: string;
  requesterId: string;
  approverId: string;
  level: number;
  status: 'pending' | 'approved' | 'rejected';
  actedAt?: string;
  rejectionReason?: string;
}
```

#### ความสามารถหลัก
- รองรับอนุมัติหลายลำดับ
- ผูกกับเอกสารต้นทาง
- เก็บ timestamp และเหตุผล reject

---

### 5.8 Sequence Entity

```ts
export interface SequencePolicy {
  id: string;
  code: string;
  prefixTemplate: string;
  resetPolicy: 'monthly' | 'yearly' | 'never';
  byDepartment?: boolean;
  byType?: boolean;
  byJournal?: boolean;
  buddhistYear?: boolean;
}
```

#### ความสามารถหลัก
- กำหนด prefix ตามเงื่อนไขธุรกิจ
- reset รายเดือน/ปี
- แยก counter ตาม department / type / journal
- ใช้ generate เลขเอกสารทุก domain

---

## 6) ฟังก์ชันเชิงระบบที่ควรมี

ด้านล่างคือ “catalog ระดับ service” ที่ agent ใหม่ควรรู้ แม้ชื่อจริงใน source อาจไม่ตรงนี้

### 6.1 Partner Services

```ts
interface PartnerService {
  createPartner(input: CreatePartnerInput): Promise<Partner>;
  updatePartner(id: string, input: UpdatePartnerInput): Promise<Partner>;
  assignSalespeopleByRegion(partnerId: string): Promise<void>;
  validatePartnerTaxInfo(partnerId: string): Promise<void>;
  archivePartner(id: string): Promise<void>;
}
```

#### ทำอะไรได้บ้าง
- สร้างและแก้ข้อมูล partner
- ผูก salesperson ตาม region อัตโนมัติ
- ตรวจความครบของเลขภาษี / เครดิต / ที่อยู่
- archive แทน delete ถ้ามี transaction แล้ว

---

### 6.2 Product Services

```ts
interface ProductService {
  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(id: string, input: UpdateProductInput): Promise<Product>;
  syncSaleAvailability(id: string): Promise<void>;
  calculatePackaging(productId: string, qty: number): Promise<PackagingResult>;
  getStockSnapshot(productId: string): Promise<StockSnapshot>;
}
```

#### ทำอะไรได้บ้าง
- จัดการ master สินค้า
- ถ้า active แล้ว auto เปิด sale_ok
- แปลงจำนวนสินค้าเป็นจำนวน pack / CTN
- อ่าน stock ทั้ง available / reserved / total

---

### 6.3 Sales Services

```ts
interface SalesService {
  createQuotation(input: CreateQuotationInput): Promise<SalesOrder>;
  updateQuotation(id: string, input: UpdateQuotationInput): Promise<SalesOrder>;
  confirmSalesOrder(id: string): Promise<SalesOrder>;
  syncStockStatus(id: string): Promise<void>;
  syncDeliveryStatus(id: string): Promise<void>;
  generateInvoiceFromSalesOrder(id: string): Promise<string>;
  preventDuplicateBilling(id: string): Promise<void>;
}
```

#### ทำอะไรได้บ้าง
- เปิดใบเสนอราคา
- confirm เป็น SO
- เปลี่ยนสถานะ stock/delivery ตาม flow จริง
- กันการดึงบิลซ้ำ
- ออก invoice จาก SO

---

### 6.4 Purchase Services

```ts
interface PurchaseService {
  createOrderRequest(input: CreateOrderRequestInput): Promise<OrderRequest>;
  submitOrderRequest(id: string): Promise<void>;
  createPurchaseRequestFromOrderRequest(orderRequestId: string): Promise<PurchaseRequest>;
  approvePurchaseRequest(id: string): Promise<void>;
  createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder>;
  applyVendorDefaults(poId: string): Promise<void>;
  syncOrderRequestStatus(orderRequestId: string): Promise<void>;
}
```

#### ทำอะไรได้บ้าง
- เปิดคำขอซื้อภายใน
- ส่งอนุมัติ / สร้าง PR
- สร้าง PO จากผลอนุมัติ
- ดึงค่า default vendor เช่น MOQ / tax / purchase note
- อัปเดตสถานะกลับไปยังเอกสารต้นทาง

---

### 6.5 Shipping Services

```ts
interface ShippingService {
  createShipping(input: CreateShippingInput): Promise<ShippingRecord>;
  attachPurchaseOrders(shippingId: string, poIds: string[]): Promise<void>;
  calculateContainerUtilization(shippingId: string): Promise<ContainerUtilization>;
  createBillFromShipping(shippingId: string): Promise<string>;
  generateShippingDocuments(shippingId: string): Promise<void>;
  updateShippingStatus(shippingId: string, status: ShippingRecord['status']): Promise<void>;
}
```

#### ทำอะไรได้บ้าง
- สร้าง shipping record
- ผูก PO หลายใบเข้าด้วยกัน
- คำนวณการจุตู้ / capacity
- สร้างเอกสาร shipping / invoice / packing / CI
- อัปเดตสถานะขนส่ง

---

### 6.6 Sequence Services

```ts
interface SequenceService {
  next(sequenceCode: string, context?: SequenceContext): Promise<string>;
  preview(sequenceCode: string, context?: SequenceContext): Promise<string>;
  ensurePolicy(sequenceCode: string, context?: SequenceContext): Promise<void>;
}

interface SequenceContext {
  departmentCode?: string;
  typeCode?: string;
  journalCode?: string;
  date?: string;
}
```

#### ทำอะไรได้บ้าง
- สร้างเลขเอกสารใหม่ตาม policy
- รองรับ context-based numbering
- รองรับ auto-create counter แยกตาม department / เดือน / ปี

---

### 6.7 Report Services

```ts
interface ReportService {
  generateQuotationPdf(id: string): Promise<Buffer>;
  generateCommercialInvoicePdf(id: string): Promise<Buffer>;
  exportPurchaseOrders(params: ExportParams): Promise<Buffer>;
  exportSalesOrders(params: ExportParams): Promise<Buffer>;
}
```

#### ทำอะไรได้บ้าง
- render report ตาม template
- export CSV / Excel
- รับรองว่าคอลัมน์ที่ผู้ใช้เห็นตรงกับเอกสาร

---

## 7) Business Rules ที่รู้จากระบบนี้

### 7.1 เรื่องสินค้าและ UOM
- บาง logic ต้องย้ายจาก packaging มาใช้ UOM เป็นตัวหลัก
- packaging ยังสำคัญสำหรับคำนวณ CTN / pack count
- หนึ่งหน้ารายงานอาจจำกัดจำนวนบรรทัด เช่น 15 rows ต่อหน้า

### 7.2 เรื่อง stock status บน SO
- ถ้า SO ยังไม่ confirm → `ยังไม่จองสต็อค`
- ถ้า SO confirm แล้ว → `จองสต็อคแล้ว`
- ถ้า Delivery validate แล้ว → `ตัดสต็อคแล้ว`

### 7.3 เรื่อง delivery status
ตัวอย่าง mapping ที่เคยใช้
- มี DO แต่ยัง new → `รอการจัดส่ง`
- state = process → `อยู่ระหว่างการจัดส่ง`
- state = confirm → `จัดส่งสำเร็จ`

### 7.4 เรื่อง sequence
เคสที่เคยมี
- INV ตาม department code
- ถ้า `x_type = de` ให้ใช้ OD แทน prefix ปกติ
- แยกเลขตาม journal
- reset รายเดือน
- บางเอกสารใช้ปี พ.ศ.

### 7.5 เรื่อง PR / Order Request sync
- ถ้า `state_blanket_order = in_progress` ให้ต้นทางเห็นข้อความ เช่น `ยืนยัน PR แล้ว`
- การ sync ต้องทำจาก event ที่ถูกจุด ไม่ใช่ไปเขียนทับกันมั่ว

### 7.6 เรื่อง duplicate prevention
- ถ้ามี invoice ถูกดึงเข้า billing แล้ว ต้องกันไม่ให้ถูกดึงซ้ำ
- ถ้ามี transaction อ้างถึงอยู่ ไม่ควรลบ record ทิ้ง

### 7.7 เรื่อง tax / VAT
- บาง flow ต้องมีปุ่มหรือ automation เพื่อลบ VAT ออกจาก SO/Invoice ทั้งชุด
- ต่างประเทศอาจ default เป็น No Tax
- ต้องระวังไม่ให้ UI แสดงจำนวนทศนิยมเกิน business format ที่ต้องการ

### 7.8 เรื่อง region → salesperson mapping
- Partner เลือก region แล้วระบบควรหา employee ที่รับผิดชอบ region นั้นแล้วเติม salesperson ให้
- mapping อาจเป็น many-to-many

---

## 8) Permission & Role แนวคิดที่ระบบควรรองรับ

ถึงแม้บทสนทนาจะไม่ได้ให้ role matrix ครบทุก role แต่จากพฤติกรรมระบบ ควรมีอย่างน้อย

- Admin
- ERP Functional / Backoffice
- Sales
- Purchase
- Warehouse / Inventory
- Shipping / Import
- Finance / Billing
- Labstaff (ในอีกโปรเจกต์มี role พิเศษลักษณะนี้)

### หลักการคุมสิทธิ์
- สิทธิ์ดู ≠ สิทธิ์แก้ไข ≠ สิทธิ์อนุมัติ
- เอกสาร draft กับ confirmed ต้อง edit ได้ไม่เท่ากัน
- บาง field lock หลัง downstream document ถูกสร้างแล้ว
- ปุ่ม action ต้องขึ้นตามสถานะและ role

---

## 9) Reporting / Document Design ที่ระบบนี้ให้ความสำคัญ

ระบบนี้ให้ความสำคัญกับ report มากกว่าระบบทั่วไป เพราะเอกสารธุรกิจถูกใช้งานจริง

### เอกสารที่มีความสำคัญ
- Quotation
- Commercial Invoice
- Packing List
- Proforma Invoice
- Tax Invoice / Receipt
- Shipping documents

### ความต้องการเฉพาะที่เคยเกิดขึ้น
- ใส่คอลัมน์ Pack / CTN ใน report
- แสดงข้อมูล bank details แบบละเอียด
- แสดง amount in words ตาม currency/language
- จำกัดแถวต่อหน้าและตัดหน้าให้สวย
- summary block อยู่เฉพาะหน้าสุดท้าย
- ลายเซ็น 2-3 ช่อง และ stamp/logo ต้องวางแม่น

### บทเรียนด้าน implementation
- report layer ต้องไม่คิดเลขเองซ้ำ ถ้าคิดให้คิดจาก snapshot ที่สร้างจาก service
- ต้องแยก renderer ออกจาก data preparation

---

## 10) Clean Code Standards ที่ควรใช้กับ ERP clone นี้

นี่คือมาตรฐานสำคัญที่ควรยึดตั้งแต่เริ่ม

### 10.1 Type-first
ประกาศ type, enum, interface ก่อนเขียน service

```ts
export enum PurchaseType {
  DOMESTIC = 'domestic',
  FOREIGN = 'foreign',
}

export interface Money {
  currency: string;
  amount: number;
}
```

### 10.2 ห้ามใช้ any ถ้าไม่จำเป็น
- ใช้ `unknown` เมื่อยังไม่แน่ใจ
- แปลง type ด้วย parser หรือ schema

### 10.3 Service ต้องชื่อสื่อ action ชัด
- `createPurchaseOrder.service.ts`
- `syncOrderRequestStatus.service.ts`
- `generateInvoiceNumber.service.ts`

### 10.4 แยก input/output type

```ts
export interface CreatePurchaseOrderInput {
  vendorId: string;
  purchaseType: 'domestic' | 'foreign';
  lines: CreatePurchaseOrderLineInput[];
}

export interface CreatePurchaseOrderResult {
  purchaseOrderId: string;
  docNo: string;
}
```

### 10.5 Validation ก่อนเข้าธุรกิจ
ใช้ Zod หรือ validator layer

```ts
const createPartnerSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['customer', 'vendor', 'both']),
  taxId: z.string().optional(),
});
```

### 10.6 ใช้ Repository แยกจาก Business Logic
service ไม่ควรเขียน SQL/Prisma query ตรงหลายที่

### 10.7 Transition Rules ต้องรวมศูนย์

```ts
function canConfirmSalesOrder(status: SalesOrderStatus): boolean {
  return status === 'draft' || status === 'sent';
}
```

### 10.8 Event / Automation ต้อง trace ได้
ทุก automation ควรบอกได้ว่า
- trigger จากอะไร
- เปลี่ยนอะไร
- เขียนลง record ไหน
- มี side effect อะไร

### 10.9 Money / Tax / Exchange Rate ต้องเป็น utility กลาง
ห้ามกระจายสูตรไว้หลายจุด

### 10.10 Report DTO ควรแยกจาก Domain Entity
เพราะ report ต้องการ field flatten / formatted มากกว่า entity ปกติ

---

## 11) Suggested Shared Interfaces

```ts
export interface AuditFields {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface BaseDocument extends AuditFields {
  id: string;
  docNo: string;
  status: string;
  remarks?: string;
}

export interface LineItemBase {
  id: string;
  description: string;
  quantity: number;
  uomId: string;
  sortOrder: number;
}

export interface StatusHistoryItem {
  fromStatus?: string;
  toStatus: string;
  changedAt: string;
  changedBy: string;
  note?: string;
}
```

---

## 12) ควรแยก constant / enum อะไรไว้กลาง

- document type
- sales status
- purchase status
- shipping status
- delivery status
- stock reservation status
- approval status
- tax mode
- shipping mode
- container type
- partner type
- sequence reset policy

ตัวอย่าง

```ts
export const DELIVERY_STATUS_LABELS = {
  new: 'ใหม่',
  waiting: 'รอการจัดส่ง',
  process: 'อยู่ระหว่างการจัดส่ง',
  confirm: 'จัดส่งสำเร็จ',
  done: 'เสร็จสิ้น',
} as const;
```

---

## 13) Invariants ที่ agent ใหม่ต้องเข้าใจ

สิ่งนี้สำคัญมาก เพราะเป็นกฎที่ห้ามแตก

1. เลขเอกสารต้องไม่ซ้ำ
2. เอกสารที่ confirm แล้วต้องไม่แก้ field สำคัญมั่ว
3. ถ้ามี downstream document แล้ว ต้องไม่ย้อนทำให้ chain พัง
4. export / UI / PDF ต้องเห็นยอดตรงกัน
5. สถานะต้อง sync จาก event จริง ไม่ใช่ cron มั่ว ๆ
6. รายงานต้องใช้ snapshot เดียวกับ transaction
7. partner / product / employee master ต้องมี relation ที่ trace ได้
8. automation ต้อง idempotent เท่าที่ทำได้

---

## 14) Known Constraints จากระบบต้นทาง

จากบริบทที่เคยคุย มีข้อจำกัดสำคัญดังนี้

- มีหลายส่วนที่เคยทำผ่าน Odoo Studio / Automated Action
- ใน automated action บางแบบห้ามใช้ `return`
- ห้ามใช้ `import`
- การ assign แบบ `record.field = value` อาจโดน safe_eval block
- มักต้องใช้ `record.write({...})`
- บางจุดต้องระวัง concurrent update
- บางจุด model relation ทำให้ลบ record ตรง ๆ ไม่ได้

ถ้าทำระบบใหม่ใน TypeScript ควรใช้ประสบการณ์นี้ออกแบบให้ rule ชัดตั้งแต่แรก ไม่ต้องพึ่ง hack จาก low-code

---

## 15) Proposed Engineering Rules for the New TS Implementation

### Naming
- ไฟล์ใช้ kebab-case
- interface ใช้ PascalCase
- service function ใช้ verb-first
- enum ใช้ UPPER_SNAKE / Pascal enum ตาม convention เดียวกัน

### File Size
- service file ไม่ควรยาวเกิน ~200-300 บรรทัด
- component ไม่ควรแบก business rule

### Testing
ทุก service สำคัญต้องมีอย่างน้อย
- success case
- validation fail case
- invalid state transition case
- duplicate prevention case
- permission case

### Logging
- log action ที่เปลี่ยนสถานะ
- log sequence generation
- log approval action
- log failed integration/report render

---

## 16) สิ่งที่ยังไม่ชัด และควรถือเป็น Assumption

เอกสารนี้จงใจสรุปจากสิ่งที่ “รู้” และ “อนุมานได้จากการใช้งาน” ดังนั้นบางเรื่องยังไม่ชัด เช่น

- database schema จริงทั้งหมด
- field จริงทุกตัวของทุก model
- permission matrix จริงทุก role
- integration ภายนอกจริงทั้งหมด
- form layout จริงทุกหน้า

ดังนั้น agent ใหม่ควรใช้เอกสารนี้เป็น

- **Business context map**
- **Module breakdown**
- **Implementation direction**
- **Coding standard foundation**

ไม่ใช่ถือเป็น database contract ฉบับสุดท้าย

---

## 17) สรุปสั้นสำหรับ agent ใหม่

ถ้าต้องเข้าใจระบบนี้เร็วที่สุด ให้จำ 7 ข้อนี้ก่อน

1. ระบบนี้คือ ERP แบบ workflow หนัก ไม่ใช่ CRUD ธรรมดา
2. เอกสารทุกใบมี chain และต้อง trace กลับได้
3. status sync และ sequence คือหัวใจของระบบ
4. sales / purchase / shipping / inventory เชื่อมกันตลอด
5. report/PDF/export สำคัญเท่าหน้าจอ
6. clean code ต้องแยก domain, service, repository, report DTO ชัด
7. TypeScript implementation ต้องเริ่มจาก interface, enum, state transition, และ business rule กลางก่อนเสมอ

