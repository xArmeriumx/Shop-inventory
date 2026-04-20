# 03 ERP Data Model

> เอกสารนี้ออกแบบ **Data Model เชิงระบบ** เพื่อให้ agent / developer คนอื่นสามารถนำไป implement ระบบ ERP นี้ต่อได้อย่างเป็นระเบียบ  
> แนวทางทั้งหมดตั้งใจให้เป็น **TypeScript-first, Clean Code, Interface-driven, and Workflow-aware**

---

## 1) เป้าหมายของเอกสารนี้

เอกสารนี้ตอบ 5 เรื่องหลัก

1. ระบบควรมี entity อะไรบ้าง
2. แต่ละ entity ควรมี field อะไร
3. entity เหล่านั้นสัมพันธ์กันอย่างไร
4. field ไหนเป็น source of truth และ field ไหนเป็น derived / snapshot
5. ถ้าจะ implement ใหม่ด้วย TypeScript ควรตั้ง interface, enum, service boundary และ schema อย่างไร

---

## 2) หลักการออกแบบ Data Model ของระบบนี้

ระบบ ERP นี้ไม่ใช่ CRUD ธรรมดา แต่เป็นระบบที่มี **document chain**, **status transition**, **sequence policy**, และ **report snapshot** เข้ามาเกี่ยวข้อง  
ดังนั้น data model ต้องออกแบบด้วยหลักเหล่านี้

### 2.1 Transaction ต้อง trace ได้
เอกสารทุกตัวต้องย้อนกลับได้ว่าเกิดจากอะไร เช่น

- Purchase Request มาจาก Order Request ไหน
- Purchase Order มาจาก PR ไหน
- Invoice มาจาก Sales Order ไหน
- Shipping เกี่ยวกับ PO / Bill / Commercial Invoice ใดบ้าง

### 2.2 Snapshot สำคัญกว่าการ join สดทุกครั้ง
ข้อมูลบางอย่างห้ามดึงสดตลอดเวลา เช่น

- ชื่อลูกค้าในเอกสาร
- ที่อยู่ใบกำกับ
- ราคา ณ วันที่ออกเอกสาร
- อัตราแลกเปลี่ยน ณ วันที่ยืนยัน
- ภาษี / discount / packaging summary

เพราะ master data อาจถูกแก้ภายหลัง

### 2.3 Derived field ต้องคำนวณซ้ำได้
field จำพวก

- subtotal
- amount tax
- amount total
- stock status text
- delivery status text
- carton count
- amount in words

ควรมีสูตรชัด และควรมี service ที่คำนวณซ้ำได้จาก source field

### 2.4 Sequence ต้องแยกเป็น domain ชัดเจน
เลขเอกสารเป็น business rule ไม่ใช่ id ของฐานข้อมูล

### 2.5 Status ต้องใช้ enum ชัดเจน
ห้ามปล่อย string กระจัดกระจายหลายรูปแบบ เช่น `done`, `confirm`, `completed`, `finish` ปนกัน

### 2.6 Permission และ workflow guard ต้องสัมพันธ์กับสถานะ
เช่น invoice draft แก้ได้ แต่ posted แก้ไม่ได้  
หรือ SO ที่ถูกดึงไป invoice แล้วห้ามแก้บาง field

---

## 3) แนวสถาปัตยกรรม TypeScript ที่แนะนำ

```text
src/
  modules/
    shared/
    partner/
    employee/
    product/
    sales/
    purchase/
    inventory/
    shipping/
    document/
    report/
    approval/
    sequence/
    audit/
```

ในแต่ละ module ควรมีอย่างน้อย

```text
domain/
  *.types.ts
  *.interfaces.ts
  *.enums.ts
  *.constants.ts

services/
  *.service.ts

repositories/
  *.repository.ts

validators/
  *.schema.ts

mappers/
  *.mapper.ts
```

---

## 4) Shared Types และ Value Objects

## 4.1 Base Entity

```ts
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isActive: boolean;
}
```

## 4.2 Address

```ts
export interface Address {
  line1?: string;
  line2?: string;
  district?: string;
  subDistrict?: string;
  province?: string;
  postalCode?: string;
  countryCode?: string;
}
```

## 4.3 Money

```ts
export interface Money {
  currencyCode: string;
  amount: number;
}
```

## 4.4 Contact Info

```ts
export interface ContactInfo {
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  lineId?: string;
}
```

## 4.5 Audit Meta

```ts
export interface AuditMeta {
  sourceModule?: string;
  sourceId?: string;
  changeReason?: string;
  note?: string;
}
```

---

## 5) Shared Enums

```ts
export enum PartnerType {
  CUSTOMER = 'customer',
  VENDOR = 'vendor',
  BOTH = 'both',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum SalesOrderStatus {
  DRAFT = 'draft',
  QUOTATION = 'quotation',
  SALE_ORDER = 'sale_order',
  CANCELLED = 'cancelled',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum StockStatusText {
  NOT_RESERVED = 'ยังไม่จองสต็อค',
  RESERVED = 'จองสต็อคแล้ว',
  CUT_STOCK = 'ตัดสต็อคแล้ว',
}

export enum DeliveryStatusText {
  WAITING = 'รอการจัดส่ง',
  PROCESSING = 'อยู่ระหว่างการจัดส่ง',
  DONE = 'จัดส่งสำเร็จ',
}

export enum ShippingMode {
  SEA = 'sea',
  AIR = 'air',
  LAND = 'land',
}

export enum ContainerLoadType {
  FCL = 'fcl',
  LCL = 'lcl',
}

export enum ApprovalStatus {
  NOT_REQUIRED = 'not_required',
  WAITING = 'waiting',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
```

---

## 6) Master Data Domain

## 6.1 Company

Company คือ root ของการตั้งค่าธุรกิจ

```ts
export interface Company extends BaseEntity {
  code: string;
  name: string;
  registeredName?: string;
  taxId?: string;
  address?: Address;
  contact?: ContactInfo;
  defaultCurrencyCode: string;
  localCurrencyCode?: string;
  defaultLanguage?: string;
  logoUrl?: string;
}
```

### หน้าที่
- เก็บข้อมูลบริษัทที่ใช้ในเอกสาร
- เป็นฐานของ report header/footer
- ใช้เป็น default currency และ locale

---

## 6.2 Department

```ts
export interface Department extends BaseEntity {
  code: string;
  name: string;
  shortCode?: string;
  description?: string;
}
```

### หน้าที่
- ผูกกับ employee
- ใช้สร้าง prefix เอกสาร
- ใช้แยกยอดขาย / ต้นทุน / ownership

---

## 6.3 Region

```ts
export interface Region extends BaseEntity {
  code: string;
  name: string;
  shortName?: string;
}
```

### หน้าที่
- map ลูกค้ากับ sales team
- ใช้ auto assign salesperson ตาม region

---

## 6.4 Employee / Salesperson

```ts
export interface Employee extends BaseEntity {
  code: string;
  fullName: string;
  nickname?: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  userId?: string;
  salesRegionIds: string[];
  productDepartmentCode?: string;
  positionName?: string;
}
```

### จุดสำคัญ
- `productDepartmentCode` ใช้ใน sequence เช่น INV prefix
- `salesRegionIds` ใช้ assign ลูกค้าตามภาค
- employee 1 คนอาจเกี่ยวทั้ง sales และ approval

---

## 6.5 Partner

```ts
export interface Partner extends BaseEntity {
  code: string;
  name: string;
  displayName?: string;
  type: PartnerType;
  taxId?: string;
  address?: Address;
  contact?: ContactInfo;
  creditDays?: number;
  rating?: number;
  province?: string;
  regionId?: string;
  salespersonIds: string[];
  departmentId?: string;
  internalNote?: string;
}
```

### จุดสำคัญ
- ใช้ได้ทั้ง customer/vendor/both
- `salespersonIds` เป็น many-to-many
- ข้อมูลภาษี / ที่อยู่ ต้อง snapshot ไปยังเอกสาร transaction

### Derived / helper
```ts
export interface PartnerSnapshot {
  partnerId: string;
  code?: string;
  name: string;
  taxId?: string;
  address?: Address;
  phone?: string;
  email?: string;
}
```

---

## 6.6 Product Category / Group

```ts
export interface ProductCategory extends BaseEntity {
  code: string;
  name: string;
  parentCategoryId?: string;
}

export interface ProductGroup extends BaseEntity {
  code: string;
  name: string;
}
```

### หน้าที่
- ใช้ filter / group by
- ใช้ report และ purchase logic

---

## 6.7 UOM

```ts
export interface Uom extends BaseEntity {
  code: string;
  name: string;
  category: string;
  ratio: number;
}
```

### หน้าที่
- เป็นหน่วยหลักของ quantity
- เป็น source of truth แทนการ hardcode pack/unit ในหลายที่

---

## 6.8 Product Packaging

```ts
export interface ProductPackaging extends BaseEntity {
  productId: string;
  name: string;
  qtyPerPackage: number;
  packageType?: string;
  isDefault?: boolean;
}
```

### หน้าที่
- ใช้คำนวณ pack / carton / CTN
- ใช้ใน report และ purchase/shipping summary

---

## 6.9 Product

```ts
export interface Product extends BaseEntity {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  groupId?: string;
  defaultUomId: string;
  saleOk: boolean;
  purchaseOk: boolean;
  minQty?: number;
  vendorMoq?: number;
  defaultPackagingId?: string;
  internalPurchaseNote?: string;
  internalSalesNote?: string;
  productDepartmentCode?: string;
}
```

### Derived Fields ที่ควรคำนวณจาก service
- availableForSale
- packagingSummary
- defaultCartonSize
- stockBalance summary

---

## 6.10 Currency / Exchange Rate

```ts
export interface Currency extends BaseEntity {
  code: string;
  name: string;
  symbol?: string;
  decimalPlaces: number;
}

export interface ExchangeRate extends BaseEntity {
  baseCurrencyCode: string;
  targetCurrencyCode: string;
  rate: number;
  effectiveDate: string;
}
```

### จุดสำคัญ
- report บางเอกสารต้องแปลงเงินข้ามสกุล
- ต้องเก็บ rate ตามวันที่ใช้งานจริง
- บางเอกสารอาจใช้ custom exchange rate

---

## 6.11 Tax Policy

```ts
export interface TaxPolicy extends BaseEntity {
  code: string;
  name: string;
  ratePercent: number;
  includedInPrice: boolean;
  taxType: 'vat' | 'withholding' | 'none';
}
```

---

## 7) Approval Domain

## 7.1 Approval Definition

```ts
export interface ApprovalDefinition extends BaseEntity {
  documentType: string;
  departmentId?: string;
  minAmount?: number;
  maxAmount?: number;
  approverEmployeeIds: string[];
  sequence: number;
}
```

## 7.2 Approval Instance

```ts
export interface ApprovalInstance extends BaseEntity {
  documentType: string;
  documentId: string;
  status: ApprovalStatus;
  requestedByEmployeeId?: string;
  currentStep: number;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}
```

## 7.3 Approval Step Log

```ts
export interface ApprovalStepLog extends BaseEntity {
  approvalInstanceId: string;
  step: number;
  approverEmployeeId: string;
  status: ApprovalStatus;
  actionAt?: string;
  reason?: string;
}
```

### จุดสำคัญ
- approval ไม่ควรเก็บแค่ status text ตัวเดียว
- ต้องมี history เพื่อ audit

---

## 8) Sales Domain

## 8.1 Sales Order Header

```ts
export interface SalesOrder extends BaseEntity {
  orderNo: string;
  quotationNo?: string;
  customerId: string;
  customerSnapshot: PartnerSnapshot;
  salespersonId?: string;
  departmentId?: string;
  status: SalesOrderStatus;
  stockStatusText: StockStatusText;
  deliveryStatusText?: DeliveryStatusText;
  currencyCode: string;
  paymentTermDays?: number;
  quotationDate?: string;
  confirmedAt?: string;
  note?: string;
  internalNote?: string;
  amountUntaxed: number;
  amountDiscount: number;
  amountTax: number;
  amountTotal: number;
  approvalStatus?: ApprovalStatus;
}
```

## 8.2 Sales Order Line

```ts
export type SalesLineType = 'product' | 'section' | 'note';

export interface SalesOrderLine extends BaseEntity {
  orderId: string;
  sortOrder: number;
  lineType: SalesLineType;
  productId?: string;
  productSnapshot?: {
    sku?: string;
    name?: string;
    uomName?: string;
  };
  description?: string;
  uomId?: string;
  quantity?: number;
  unitPrice?: number;
  discountPercent?: number;
  taxPolicyIds?: string[];
  subtotal?: number;
  total?: number;
  packagingId?: string;
  packagingQty?: number;
  cartonCount?: number;
  isDeliveryLine?: boolean;
}
```

### จุดสำคัญ
- section/note ต้องเก็บอยู่ใน table เดียวกับ product line เพื่อรักษาลำดับ
- `sortOrder` เป็น source of truth เรื่องตำแหน่งบรรทัด
- `productSnapshot` ช่วยกันชื่อสินค้าถูกเปลี่ยนภายหลัง

### Rules
- lineType = section/note ห้ามมี quantity/price
- lineType = product ต้อง validate productId, quantity, unitPrice

---

## 9) Purchase Domain

## 9.1 Order Request

```ts
export interface OrderRequest extends BaseEntity {
  requestNo: string;
  requestedByEmployeeId?: string;
  departmentId?: string;
  status: DocumentStatus;
  requestStatusText?: string;
  note?: string;
}
```

## 9.2 Order Request Line

```ts
export interface OrderRequestLine extends BaseEntity {
  orderRequestId: string;
  sortOrder: number;
  productId?: string;
  description?: string;
  uomId?: string;
  quantity: number;
  note?: string;
}
```

## 9.3 Purchase Request

```ts
export interface PurchaseRequest extends BaseEntity {
  prNo: string;
  sourceOrderRequestId?: string;
  vendorId?: string;
  status: DocumentStatus;
  requestedByEmployeeId?: string;
  approvalStatus?: ApprovalStatus;
  note?: string;
}
```

## 9.4 Purchase Request Line

```ts
export interface PurchaseRequestLine extends BaseEntity {
  purchaseRequestId: string;
  sourceOrderRequestLineId?: string;
  productId?: string;
  description?: string;
  uomId?: string;
  quantity: number;
}
```

## 9.5 Purchase Order

```ts
export interface PurchaseOrder extends BaseEntity {
  poNo: string;
  poType?: 'domestic' | 'import';
  vendorId: string;
  vendorSnapshot: PartnerSnapshot;
  sourcePurchaseRequestId?: string;
  status: DocumentStatus;
  currencyCode: string;
  exchangeRate?: number;
  taxMode?: 'default' | 'no_tax';
  shippingMode?: ShippingMode;
  containerLoadType?: ContainerLoadType;
  expectedDate?: string;
  internalPurchaseNote?: string;
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
}
```

## 9.6 Purchase Order Line

```ts
export interface PurchaseOrderLine extends BaseEntity {
  purchaseOrderId: string;
  sortOrder: number;
  productId?: string;
  description?: string;
  uomId?: string;
  quantity: number;
  unitPrice: number;
  vendorMoq?: number;
  packagingId?: string;
  packagingQty?: number;
  cartonCount?: number;
  subtotal: number;
  total: number;
}
```

### จุดสำคัญ
- import PO อาจ default no tax
- MOQ ต้องดึงจาก vendor/product relation หรือ field ที่ตกลง
- package / carton ใช้ในรายงานและ shipping

---

## 10) Inventory Domain

## 10.1 Inventory Item Snapshot

```ts
export interface InventoryBalance extends BaseEntity {
  productId: string;
  uomId: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  warehouseId?: string;
  locationId?: string;
}
```

## 10.2 Stock Reservation

```ts
export interface StockReservation extends BaseEntity {
  salesOrderId?: string;
  salesOrderLineId?: string;
  productId: string;
  reservedQty: number;
  uomId: string;
  status: 'reserved' | 'released' | 'consumed';
}
```

## 10.3 Delivery Order

```ts
export interface DeliveryOrder extends BaseEntity {
  deliveryNo: string;
  salesOrderId: string;
  customerId?: string;
  status: 'new' | 'process' | 'confirm' | 'cancel';
  scheduledDate?: string;
  deliveredAt?: string;
  note?: string;
}
```

## 10.4 Delivery Order Line

```ts
export interface DeliveryOrderLine extends BaseEntity {
  deliveryOrderId: string;
  salesOrderLineId?: string;
  productId: string;
  uomId: string;
  quantity: number;
  deliveredQty?: number;
}
```

### จุดสำคัญ
- สถานะ delivery ต้องไป sync กลับ SO
- validate delivery แล้ว stock status บน SO ต้องกลายเป็นตัดสต็อคแล้ว

---

## 11) Invoice / Billing Domain

## 11.1 Invoice Header

```ts
export interface Invoice extends BaseEntity {
  invoiceNo: string;
  moveType: 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund';
  salesOrderId?: string;
  purchaseOrderId?: string;
  billingGroupId?: string;
  customerId?: string;
  vendorId?: string;
  partnerSnapshot?: PartnerSnapshot;
  status: InvoiceStatus;
  departmentCode?: string;
  xType?: string;
  sequencePrefix?: string;
  invoiceDate?: string;
  dueDate?: string;
  currencyCode: string;
  exchangeRate?: number;
  amountUntaxed: number;
  amountDiscount: number;
  amountTax: number;
  amountTotal: number;
  amountResidual?: number;
}
```

## 11.2 Invoice Line

```ts
export interface InvoiceLine extends BaseEntity {
  invoiceId: string;
  sortOrder: number;
  lineType: 'product' | 'section' | 'note';
  sourceSalesOrderLineId?: string;
  productId?: string;
  description?: string;
  uomId?: string;
  quantity?: number;
  unitPrice?: number;
  discountPercent?: number;
  subtotal?: number;
  total?: number;
  packagingQty?: number;
  cartonCount?: number;
}
```

### จุดสำคัญ
- `sequencePrefix` แยกจาก `invoiceNo` เพื่อ debug ง่าย
- invoice ที่ถูกโพสต์แล้วต้องถือเป็น snapshot document
- ห้ามดึง SO เข้า billing ซ้ำถ้ามี relation ไปแล้ว

---

## 12) Shipping Domain

## 12.1 Shipping Header

```ts
export interface ShippingRecord extends BaseEntity {
  shippingNo: string;
  sourcePurchaseOrderId?: string;
  sourceInvoiceId?: string;
  vendorId?: string;
  shippingCompanyId?: string;
  mode?: ShippingMode;
  containerLoadType?: ContainerLoadType;
  etd?: string;
  eta?: string;
  status: 'new' | 'process' | 'confirm' | 'cancel';
  note?: string;
}
```

## 12.2 Shipping Line

```ts
export interface ShippingLine extends BaseEntity {
  shippingRecordId: string;
  productId?: string;
  description?: string;
  uomId?: string;
  quantity: number;
  packagingId?: string;
  packagingQty?: number;
  cartonCount?: number;
  cbm?: number;
}
```

## 12.3 Shipping Company

```ts
export interface ShippingCompany extends BaseEntity {
  code: string;
  name: string;
  accountType?: 'shipping' | 'other';
  address?: Address;
  contact?: ContactInfo;
}
```

### จุดสำคัญ
- shipping record มักเป็นจุดกลางของ PI / CI / PL / INV บางแบบ
- ควรมี relation ไปยังเอกสารปลายทางได้หลายตัว

---

## 13) Document Register / Attachments

## 13.1 Document Type

```ts
export interface DocumentType extends BaseEntity {
  code: string;
  name: string;
  prefix?: string;
  resetPolicy?: 'monthly' | 'yearly' | 'never';
}
```

## 13.2 Document Register

```ts
export interface DocumentRegister extends BaseEntity {
  documentNo: string;
  documentTypeId: string;
  relatedModel: string;
  relatedId: string;
  partnerId?: string;
  projectId?: string;
  remark?: string;
}
```

## 13.3 Attachment

```ts
export interface Attachment extends BaseEntity {
  ownerModel: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  url: string;
  sizeBytes?: number;
}
```

---

## 14) Sequence Domain

```ts
export interface SequencePolicy extends BaseEntity {
  code: string;
  documentType: string;
  prefixPattern: string;
  padding: number;
  resetPolicy: 'monthly' | 'yearly' | 'never';
  useBuddhistYear?: boolean;
  departmentField?: string;
  journalField?: string;
  typeField?: string;
}
```

```ts
export interface SequenceCounter extends BaseEntity {
  policyCode: string;
  periodKey: string;
  scopeKey?: string;
  currentValue: number;
}
```

### ตัวอย่าง scopeKey
- `INV|K`
- `INV|OD`
- `PR|IMPORT`
- `CI|2026-04`

### จุดสำคัญ
- counter แยกจาก policy
- การสร้างเลขเอกสารต้อง atomic
- ต้องรองรับ prefix ตาม department / journal / xType

---

## 15) Audit / History Domain

```ts
export interface AuditLog extends BaseEntity {
  model: string;
  recordId: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'approve' | 'reject';
  actorId?: string;
  beforeJson?: string;
  afterJson?: string;
  remark?: string;
}
```

### หน้าที่
- ตรวจย้อนหลังว่าใครเปลี่ยนอะไร
- สำคัญมากกับ status, amount, invoice number, approval

---

## 16) ความสัมพันธ์ระหว่าง Entity

## 16.1 Sales Chain

```text
Partner 1---n SalesOrder
SalesOrder 1---n SalesOrderLine
SalesOrder 1---n DeliveryOrder
SalesOrder 1---n Invoice
SalesOrderLine 1---n DeliveryOrderLine
SalesOrderLine 1---n InvoiceLine
```

## 16.2 Purchase Chain

```text
OrderRequest 1---n OrderRequestLine
OrderRequest 1---n PurchaseRequest
PurchaseRequest 1---n PurchaseRequestLine
PurchaseRequest 1---n PurchaseOrder
PurchaseOrder 1---n PurchaseOrderLine
PurchaseOrder 1---n ShippingRecord
```

## 16.3 Master Data Relations

```text
Region 1---n Partner
Region n---m Employee
Department 1---n Employee
Department 1---n SalesOrder
ProductCategory 1---n Product
ProductGroup 1---n Product
Product 1---n ProductPackaging
```

---

## 17) Source of Truth vs Snapshot vs Derived

| Field Type | ตัวอย่าง | หลักการ |
|---|---|---|
| Source of Truth | partnerId, productId, uomId, quantity, unitPrice | ต้องเก็บตรงจาก transaction |
| Snapshot | customerSnapshot, vendorSnapshot, productSnapshot, exchangeRate | เก็บค่าตอนเอกสารถูกสร้าง/ยืนยัน |
| Derived | subtotal, cartonCount, stockStatusText, deliveryStatusText | คำนวณจาก source+rule และควรคำนวณซ้ำได้ |

### ข้อแนะนำ
- อย่าคิด derived field ใน UI อย่างเดียว
- ต้องมี service กลาง เช่น `calculateOrderTotals()` และ `calculateCartonCount()`

---

## 18) Index และ Constraint ที่ควรมี

## 18.1 Unique
- partner.code
- product.sku
- sequenceCounter(policyCode, periodKey, scopeKey)
- documentNo ตามเอกสารแต่ละ domain
- company.code
- department.code
- region.code

## 18.2 Recommended Index
- salesOrder.customerId
- salesOrder.status
- invoice.salesOrderId
- invoice.status
- purchaseOrder.vendorId
- shippingRecord.sourcePurchaseOrderId
- approvalInstance(documentType, documentId)
- auditLog(model, recordId)

## 18.3 Foreign Key Rules
- transaction document ควรใช้ soft delete / archive แทน hard delete
- เอกสารที่ posted/done แล้วไม่ควร cascade delete line โดยไม่ตั้งใจ

---

## 19) Validation Rules สำคัญ

### Partner
- code ต้องไม่ซ้ำ
- customer/vendor type ต้องชัด
- taxId ถ้ามี ต้องผ่าน format validation ตามประเทศที่ใช้

### Product
- defaultUomId ต้องมี
- ถ้า saleOk = false ห้ามเพิ่มใน sales line
- ถ้า purchaseOk = false ห้ามเพิ่มใน purchase line

### Sales Order
- ต้องมี customer
- product line ทุกบรรทัดต้องมี quantity > 0
- section/note ห้ามคำนวณยอด

### Purchase Order
- ต้องมี vendor
- quantity > 0
- import PO อาจบังคับ shipping mode

### Invoice
- draft เท่านั้นที่แก้เลข prefix/relation ได้
- posted แล้วล็อก amount / partner snapshot / line snapshot

---

## 20) DTO และ Interface ที่ควรแยกจาก Entity

### ตัวอย่าง Create DTO

```ts
export interface CreateSalesOrderInput {
  customerId: string;
  salespersonId?: string;
  currencyCode: string;
  note?: string;
  lines: CreateSalesOrderLineInput[];
}

export interface CreateSalesOrderLineInput {
  lineType: 'product' | 'section' | 'note';
  productId?: string;
  description?: string;
  uomId?: string;
  quantity?: number;
  unitPrice?: number;
  discountPercent?: number;
}
```

### ตัวอย่าง View Model

```ts
export interface SalesOrderDetailView {
  id: string;
  orderNo: string;
  customerName: string;
  status: string;
  stockStatusText: string;
  deliveryStatusText?: string;
  totals: {
    untaxed: number;
    tax: number;
    total: number;
  };
  lines: Array<{
    sortOrder: number;
    lineType: string;
    description: string;
    quantity?: number;
    uomName?: string;
    unitPrice?: number;
    total?: number;
  }>;
}
```

### หลักการ
- Entity = schema persistence
- DTO = input/output ของ use case
- ViewModel = สิ่งที่หน้าจอใช้

---

## 21) Suggested Services ที่สัมพันธ์กับ Data Model

```ts
createPartner()
assignSalespeopleByRegion()

createProduct()
calculatePackagingSummary()

createQuotation()
confirmSalesOrder()
syncStockStatus()
syncDeliveryStatus()

createOrderRequest()
createPurchaseRequestFromOrderRequest()
createPurchaseOrderFromPurchaseRequest()

reserveStockForSalesOrder()
validateDeliveryOrder()

generateInvoiceFromSalesOrder()
preventDuplicateBillingPull()

createShippingRecord()
generateCommercialInvoiceSnapshot()

generateSequenceNumber()
rebuildDocumentSnapshot()
```

---

## 22) Clean Code Guidelines สำหรับการลงมือ implement

## 22.1 ห้ามเอา business rule ไปซ่อนใน UI
ผิด:
- component คำนวณ tax เอง
- component ตัดสินใจเองว่า invoice ดึงซ้ำได้ไหม

ถูก:
- ใช้ service เช่น `validateInvoiceGeneration()`

## 22.2 ห้ามใช้ any กับ entity หลัก
ควรประกาศ interface ตั้งแต่แรก

## 22.3 แยก enum กลาง
เช่น `sales-order.enums.ts`, `invoice.enums.ts`, `approval.enums.ts`

## 22.4 ใช้ naming ที่สื่อความหมาย
- `sourcePurchaseRequestId`
- `customerSnapshot`
- `deliveryStatusText`

ดีกว่า
- `refId`
- `tempData`
- `status2`

## 22.5 ใช้ service เล็กแต่ชัด
- `calculateOrderLineSubtotal`
- `calculateOrderTotals`
- `applyDiscountPolicy`
- `generateScopedSequenceNumber`

---

## 23) Suggested Database Migration Order

1. shared tables
2. company / department / region
3. employee / partner
4. product / category / group / uom / packaging
5. tax / currency / exchange rate
6. sequence policy / counter
7. approval tables
8. sales tables
9. purchase tables
10. inventory tables
11. invoice tables
12. shipping tables
13. document register / attachment / audit logs

---

## 24) สิ่งที่ agent ตัวอื่นควรเข้าใจก่อนลงมือ

1. ระบบนี้มีหัวใจที่ **document chain**
2. field จำนวนมากเป็น **snapshot** ไม่ใช่ join สด
3. **sequence policy** เป็น business rule ใหญ่
4. **status sync** ระหว่าง document เป็น requirement สำคัญ
5. `section/note` line เป็นของจริง ต้อง model รองรับ
6. report, export, UI ต้องยึด source of truth เดียวกัน
7. clean code ที่ดีในระบบนี้คือแยก **Entity / DTO / Service / ViewModel** ให้ชัด

---

## 25) สรุปสุดท้าย

ถ้าจะ clone ระบบนี้ใหม่ให้ maintainable:

- เริ่มจาก entity และ enum ให้ถูกก่อน
- เก็บ snapshot ตั้งแต่ transaction แรก
- วาง service กลางสำหรับ totals / status / sequence
- แยก relation และ source document ให้ครบ
- เขียน test ตั้งแต่ระดับ data model และ use case

เอกสารนี้จึงเป็นฐานสำหรับไฟล์ถัดไป เช่น test cases, repository contracts และ API contract ของแต่ละ module
