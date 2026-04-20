# ERP System Workflows, Function Map, and End-to-End Flow

> เอกสารนี้อธิบาย “การไหลของงานทั้งระบบ” แบบละเอียด เพื่อให้ agent ใหม่เข้าใจว่าเริ่มจากตรงไหน ไปจบตรงไหน และแต่ละฟังก์ชันในเชิงระบบควรรับผิดชอบอะไร

---

## 1) ภาพรวมการไหลของระบบ

ระบบ ERP นี้มี flow หลัก 6 สาย

1. Master Data Setup Flow
2. Sales Flow
3. Purchase & Internal Request Flow
4. Inventory & Delivery Flow
5. Shipping / Import Document Flow
6. Reporting / Export / Document Printing Flow

ทั้งหมดนี้เชื่อมกันผ่านหลักร่วมคือ

- document link
- status transition
- approval
- sequence
- audit trail

---

## 2) Flow เริ่มต้นของระบบตั้งแต่วันแรก

ก่อนใช้งาน transaction จริง ระบบต้องมีการตั้งค่าพื้นฐานก่อน

### 2.1 Setup Master Data

#### ต้องมีอะไรบ้าง
- company profile
- employee / user / salesperson
- department / region / sales team
- partner / vendor / customer
- product / category / group
- uom / packaging
- tax / currency / exchange rate
- shipping company
- document type
- sequence policies

#### ทำไมต้องเริ่มจากตรงนี้
เพราะ transaction ทั้งหมดจะดึง default จาก master data เช่น
- ลูกค้าคนนี้เครดิตกี่วัน
- vendor นี้ MOQ เท่าไร
- sale คนนี้แผนกอะไร
- เอกสารนี้ต้องใช้ prefix ไหน
- product นี้ขายได้ไหม ซื้อได้ไหม ใช้ UOM อะไร

#### Recommended functions
```ts
setupCompanyProfile()
createDepartment()
createRegion()
createEmployee()
createPartner()
createProduct()
createTaxPolicy()
createSequencePolicy()
```

---

## 3) Contact / Partner Flow

Partner เป็นฐานสำคัญของระบบ เพราะเกือบทุกเอกสารจะอ้างถึง partner เสมอ

### 3.1 การสร้าง Partner

#### Input ที่สำคัญ
- รหัสลูกค้า / supplier code
- ชื่อ
- ประเภท customer/vendor/both
- ที่อยู่
- ภาษี
- เครดิต
- จังหวัด / ภาค / เขต
- sales team / salesperson

#### Flow
1. ผู้ใช้กรอกข้อมูล partner
2. ระบบ validate ข้อมูลจำเป็น
3. ระบบ map region ถ้ามี
4. ระบบอาจเติม salesperson ตาม region อัตโนมัติ
5. บันทึก partner
6. partner พร้อมใช้งานใน sales / purchase / shipping / billing

#### Recommended functions
```ts
createPartner(input)
updatePartner(input)
validatePartner(input)
assignSalespeopleByRegion(partnerId)
archivePartner(partnerId)
```

#### สิ่งที่ต้องระวัง
- ถ้า partner มี transaction แล้ว ไม่ควรลบ hard delete
- ข้อมูลภาษีต้องใช้ซ้ำใน invoice/report ได้
- บาง partner อาจมี sales หลายคนแบบ many-to-many

---

## 4) Product Flow

สินค้าเป็นศูนย์กลางของยอดขาย, ซื้อเข้า, stock, shipping และรายงาน

### 4.1 การสร้างสินค้า

#### Input สำคัญ
- SKU
- ชื่อสินค้า
- category / group
- UOM หลัก
- sale_ok / purchase_ok
- min qty
- packaging
- vendor MOQ (ในบางบริบท)

#### Flow
1. ผู้ใช้สร้างสินค้า
2. เลือก UOM
3. กำหนดได้ว่าจะขายได้ / ซื้อได้
4. ถ้า active ระบบอาจตั้ง sale_ok = true
5. ผูก packaging เพื่อใช้คำนวณ pack/CTN

#### Recommended functions
```ts
createProduct(input)
updateProduct(input)
activateProduct(productId)
syncSaleAvailability(productId)
addPackaging(productId, packaging)
calculatePackaging(productId, quantity)
```

### 4.2 การใช้สินค้าในเอกสาร
- Sales Order line ใช้ product + uom + quantity + unit price
- Purchase Order line ใช้ product + uom + quantity + MOQ + packaging
- Shipping ใช้ aggregate จำนวนสินค้าเพื่อคำนวณการจัดส่ง
- Report ใช้ข้อมูลสินค้าในการแสดงตารางสินค้าและจำนวน CTN/Pack

---

## 5) Sales Flow แบบละเอียด

นี่คือ flow หลักตั้งแต่เริ่มขายจนถึงเอกสารปลายทาง

### 5.1 สร้าง Quotation

#### Input
- customer
- salesperson
- line items
- ราคา
- discount
- tax
- remark / note / section

#### Flow
1. ผู้ใช้เลือก customer
2. ระบบดึง default เช่น salesperson, payment term, tax profile ถ้ามี
3. ผู้ใช้เพิ่มสินค้า
4. line item อาจเป็น product line หรือ section/note
5. ระบบคำนวณ subtotal / discount / tax / total
6. บันทึกเป็น `draft quotation`

#### Recommended functions
```ts
createQuotation(input)
addQuotationLine(orderId, line)
reorderQuotationLines(orderId, lines)
calculateQuotationTotals(orderId)
validateQuotation(orderId)
```

### 5.2 การจัดการ section / note
ระบบนี้เคยมีโจทย์เรื่อง line order และ section ถูก sort ผิดที่หลัง save

#### สิ่งที่ระบบต้องทำ
- รักษา `sortOrder` ของ line ให้ตรงกับที่ผู้ใช้จัด
- section / note ต้องไม่ถูกย้ายไปบนสุดเอง
- การ reorder หลัง save ต้อง deterministic

#### Recommended functions
```ts
normalizeLineSortOrder(orderId)
moveLine(orderId, lineId, targetIndex)
preserveSectionPlacement(orderId)
```

### 5.3 Confirm เป็น Sales Order

#### Flow
1. ตรวจว่ามี line ที่ valid
2. ตรวจสิทธิ์การ confirm
3. เปลี่ยนสถานะ quotation → sales order
4. trigger stock reservation logic
5. trigger document chain / delivery preparation

#### Recommended functions
```ts
confirmSalesOrder(orderId)
validateSalesOrderBeforeConfirm(orderId)
reserveStockForSalesOrder(orderId)
syncStockStatus(orderId)
```

### 5.4 Stock Status บน SO

จาก business rule ที่ทราบ

- Draft / quotation → `ยังไม่จองสต็อค`
- Confirmed SO → `จองสต็อคแล้ว`
- Delivery validated → `ตัดสต็อคแล้ว`

#### Recommended function
```ts
syncStockStatus(orderId)
```

#### ตัวอย่าง logic
```ts
if (!isConfirmed(order)) return 'ยังไม่จองสต็อค';
if (hasValidatedDelivery(order)) return 'ตัดสต็อคแล้ว';
return 'จองสต็อคแล้ว';
```

### 5.5 Delivery Status บน SO

SO ต้องสะท้อนฝั่งจัดส่งด้วย

ตัวอย่าง mapping ที่เคยใช้
- มี DO แล้วแต่ยังไม่เริ่ม → `รอการจัดส่ง`
- process → `อยู่ระหว่างการจัดส่ง`
- confirm → `จัดส่งสำเร็จ`

#### Recommended functions
```ts
syncDeliveryStatus(orderId)
getDeliveryStateBySalesOrder(orderId)
```

### 5.6 ออก Invoice จาก SO

#### Flow
1. ผู้ใช้เลือก SO
2. ระบบเช็กว่าออก invoice ได้หรือยัง
3. สร้าง invoice lines จาก SO lines
4. ดึง tax / discount / totals ตาม snapshot
5. กันการดึงซ้ำไป billing ถ้ามีแล้ว

#### Recommended functions
```ts
generateInvoiceFromSalesOrder(orderId)
validateInvoiceGeneration(orderId)
preventDuplicateBilling(orderId)
```

### 5.7 Lock ฟิลด์บางตัวหลังมี downstream doc
ตัวอย่างเช่น
- ถ้า SO ถูกออก INV แล้ว ห้ามแก้บาง field เช่น department code
- ถ้ามี billing แล้ว ห้ามดึง invoice ซ้ำ

#### Recommended functions
```ts
canEditSalesOrderField(orderId, fieldName)
hasGeneratedInvoice(orderId)
hasBillingReference(invoiceId)
```

---

## 6) Purchase Flow แบบละเอียด

Purchase ของระบบนี้ไม่ได้เริ่มจาก PO เสมอ แต่เริ่มจาก “ความต้องการภายใน” ก่อน

### 6.1 Order Request

ใช้เป็นเอกสารเริ่มต้นจากฝ่ายภายใน

#### Input
- requester
- department
- รายการสินค้า / ของที่ต้องซื้อ
- เหตุผล / note

#### Flow
1. ผู้ใช้เปิดคำขอซื้อ
2. ระบุรายการที่ต้องการ
3. บันทึกเป็น draft
4. submit เพื่อขออนุมัติ / ส่งต่อ PR

#### Recommended functions
```ts
createOrderRequest(input)
updateOrderRequest(id, input)
submitOrderRequest(id)
cancelOrderRequest(id)
```

### 6.2 Purchase Request / Approval Stage

เอกสารนี้เป็นสะพานระหว่าง requirement ภายในกับการซื้อจริง

#### Flow
1. สร้าง PR จาก Order Request
2. ระบุ vendor (ถ้ารู้)
3. ส่งอนุมัติหลายลำดับได้
4. เมื่อสถานะขยับ ต้องสะท้อนกลับ Order Request

#### Business Rule ที่เคยใช้
ถ้า `state_blanket_order = in_progress`
→ Order Request แสดงข้อความ `ยืนยัน PR แล้ว`

#### Recommended functions
```ts
createPurchaseRequestFromOrderRequest(orderRequestId)
submitPurchaseRequest(prId)
approvePurchaseRequest(prId)
rejectPurchaseRequest(prId)
syncOrderRequestStatusFromPurchaseRequest(prId)
```

### 6.3 Purchase Order

#### Input สำคัญ
- vendor
- purchase type (domestic / foreign)
- currency
- lines
- shipping info ถ้ามี

#### Flow
1. สร้าง PO จาก PR หรือสร้างตรง
2. ดึงค่า default จาก vendor
3. ถ้าเป็น foreign purchase อาจ default no tax
4. ระบบเติม MOQ ลง PO line
5. ผู้ใช้ confirm PO
6. เชื่อมต่อไป shipping / receiving / billing

#### Recommended functions
```ts
createPurchaseOrder(input)
applyVendorDefaults(poId)
fillVendorMOQ(poId)
applyTaxPolicy(poId)
confirmPurchaseOrder(poId)
linkPurchaseOrderToShipping(poId, shippingId)
```

### 6.4 MOQ Logic
โจทย์ที่เคยเกิดขึ้นคืออยากให้ PO line แสดง MOQ จาก vendor อัตโนมัติ

#### Recommended functions
```ts
getVendorMOQ(vendorId, productId)
applyMOQToPurchaseOrderLine(poLineId)
```

### 6.5 Purchase Note / Internal Note
ระบบมีแนวคิดว่าจะมี internal purchase note และ note ที่แสดงใน report หรือ shipping

#### Recommended functions
```ts
setPurchaseInternalNote(poId, note)
setPurchaseDocumentNote(poId, note)
```

---

## 7) Inventory & Delivery Flow

### 7.1 แนวคิดหลัก
Inventory ไม่ได้ทำงานเดี่ยว แต่ผูกกับ Sales และ Purchase ตลอด

- sales order ทำให้เกิด reservation / delivery
- purchase order ทำให้เกิด receiving
- delivery validate มีผลต่อ stock status

### 7.2 Sales-side Inventory Flow

#### Flow
1. SO confirm
2. สินค้าถูก reserve
3. เกิด delivery order
4. ระหว่างจัดส่งมีสถานะ
5. เมื่อ validate delivery แล้ว stock ถูกตัดจริง

#### Recommended functions
```ts
reserveStockForSalesOrder(orderId)
createDeliveryOrderFromSalesOrder(orderId)
validateDeliveryOrder(deliveryId)
releaseReservation(orderId)
```

### 7.3 Purchase-side Inventory Flow

#### Flow
1. PO confirm
2. รอสินค้าเข้า
3. เมื่อรับของเข้าระบบ stock เพิ่ม
4. อาจเชื่อม lot/batch/serial

#### Recommended functions
```ts
createReceiptFromPurchaseOrder(poId)
receivePurchasedItems(receiptId)
updateStockAfterReceipt(receiptId)
```

### 7.4 คำถามสำคัญที่ระบบต้องตอบได้
- จำนวนคงเหลือจริงคืออะไร
- จำนวนที่จองอยู่คืออะไร
- จำนวนขายได้คืออะไร
- min quantity เทียบกับ total หรือ sellable stock

#### Recommended utility
```ts
getStockSnapshot(productId): {
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
}
```

---

## 8) Shipping / Import Flow แบบละเอียด

Shipping เป็นอีกโดเมนที่สำคัญมาก โดยเฉพาะ PO ต่างประเทศและเอกสาร import/export

### 8.1 เริ่มต้น Shipping

#### จุดเริ่ม
- มี PO ที่ต้องจัดส่ง
- เลือก shipping company / shipping mode
- อาจรวมหลาย PO ใน shipment เดียวกัน

#### Recommended functions
```ts
createShipping(input)
addPurchaseOrdersToShipping(shippingId, poIds)
setShippingMode(shippingId, mode)
setContainerLoadType(shippingId, type)
```

### 8.2 การคำนวณการจุตู้
เป็น requirement ที่เคยถูกขอเพิ่ม

#### Flow
1. รวมรายการสินค้าทั้ง shipment
2. ดู dimension/packaging/volume ถ้ามี
3. คำนวณว่าเต็มตู้หรือไม่
4. สรุปเป็น utilization

#### Recommended functions
```ts
calculateContainerUtilization(shippingId)
```

### 8.3 Shipping Status
- new
- process
- confirm
- done
- cancelled

สถานะนี้อาจต้อง sync กลับเอกสารอื่นหรือหน้าติดตามงาน

#### Recommended functions
```ts
updateShippingStatus(shippingId, status)
syncRelatedDocumentStatuses(shippingId)
```

### 8.4 Create Bill from Shipping
มี requirement ชัดว่าต้องการสร้าง bill จากหน้า shipping

#### Recommended functions
```ts
createBillFromShipping(shippingId)
validateBillCreationFromShipping(shippingId)
```

### 8.5 เอกสารที่เกี่ยวกับ Shipping
- INV
- PL
- PI
- CI

ควรเกิดจาก data source กลางเดียวกัน ไม่ใช่แต่ละ report คิดเอง

#### Recommended functions
```ts
buildShippingDocumentSnapshot(shippingId)
generatePackingList(shippingId)
generateCommercialInvoice(shippingId)
generateProformaInvoice(shippingId)
```

---

## 9) Billing / Invoice / Finance-lite Flow

แม้บริบทที่มีไม่ใช่ระบบบัญชีเต็มรูปแบบ แต่มี logic ด้าน invoice และ billing สำคัญ

### 9.1 Sales Invoice Flow
1. สร้างจาก SO
2. ใช้เลขเอกสารตาม sequence policy
3. คุมการแก้ไขชื่อเอกสารเมื่อยัง draft
4. ถ้ามี billing relation แล้วกันการดึงซ้ำ

#### Recommended functions
```ts
createInvoiceFromSalesOrder(orderId)
assignInvoiceNumber(invoiceId)
recomputeDraftInvoiceNumber(invoiceId)
markInvoiceAsBilled(invoiceId, billingId)
```

### 9.2 Sequence Logic สำหรับ Invoice
เคสที่เคยเกิด
- ใช้ prefix ตามแผนกของ sale ที่เปิด SO
- ถ้า `x_type = de` ให้ใช้ `OD`
- บาง journal ใช้ prefix พิเศษ เช่น IMP
- reset รายเดือน

#### Recommended functions
```ts
resolveInvoicePrefix(context)
getNextInvoiceNumber(context)
reassignDraftInvoiceNumber(invoiceId, newContext)
```

### 9.3 VAT / Tax Logic
เคยมีโจทย์ทั้งลบ VAT ออกจากเอกสาร และจัดการ default tax ตามประเภท purchase

#### Recommended functions
```ts
applyTaxSetToDocument(documentId, taxSetId)
removeAllTaxesFromDocument(documentId)
getDefaultTaxPolicyByPurchaseType(type)
```

### 9.4 Display Formatting
ระบบมี requirement เรื่องแสดงแค่ 2 ตำแหน่งแต่เก็บ precision จริงมากกว่า

#### Recommended utility
```ts
formatMoney(value: number, digits = 2)
formatPercentage(value: number, digits = 2)
```

---

## 10) Approval Flow แบบละเอียด

Approval เป็น flow กลางที่อาจใช้ได้หลายโมดูล

### 10.1 จุดที่ควรใช้ approval
- Purchase Request
- Purchase Order
- Discount approval
- Stock adjustment
- อาจรวมเอกสารที่มูลค่าสูง

### 10.2 Flow
1. เอกสารถูก submit
2. ระบบหาผู้อนุมัติตาม rule
3. สร้าง approval records ทีละ level
4. current level approve/reject
5. ถ้า approve ครบ → เอกสารขยับสถานะ
6. ถ้า reject → เก็บเหตุผลและหยุด flow

#### Recommended functions
```ts
submitForApproval(sourceType, sourceId)
resolveApprovers(sourceType, sourceId)
approveStep(approvalId)
rejectStep(approvalId, reason)
finalizeApprovalResult(sourceType, sourceId)
```

### 10.3 สิ่งที่ต้องเก็บ
- ใครขอ
- ใครอนุมัติ
- ลำดับเท่าไร
- อนุมัติเมื่อไร
- reject เพราะอะไร

---

## 11) Sequence Flow แบบละเอียด

เลขเอกสารคือหนึ่งในจุดที่ซับซ้อนที่สุดของระบบนี้

### 11.1 หลักคิด
เลขเอกสารต้องสะท้อนธุรกิจ เช่น
- department
- type
- journal
- month/year
- พ.ศ. หรือ ค.ศ.

### 11.2 ตัวอย่าง use case
- Sales invoice ของแผนก K → K-xxxx
- เอกสาร type de → ODxxxx
- เอกสาร import journal → IMPxxxx
- reset รายเดือน

### 11.3 Flow การ generate
1. รับ context ของเอกสาร
2. resolve ว่าต้องใช้ policy ไหน
3. resolve prefix
4. หา counter ของ period/current group
5. increment
6. lock result
7. คืนเลขเอกสาร

#### Recommended functions
```ts
resolveSequencePolicy(documentType, context)
resolveSequencePrefix(policy, context)
getCurrentCounter(policy, context)
incrementCounter(policy, context)
generateDocumentNumber(policy, context)
```

### 11.4 กรณีแก้ context ตอน draft
ระบบเคยมี requirement ว่า ถ้าเปลี่ยน type หรือ department ตอนยัง draft เลขต้องเปลี่ยนตาม

#### Recommended functions
```ts
canRecomputeDraftNumber(documentId)
recomputeDocumentNumber(documentId)
```

---

## 12) Report / Export / PDF Flow แบบละเอียด

ระบบนี้ report สำคัญระดับ production document จริง

### 12.1 Flow การสร้างรายงาน
1. ผู้ใช้เลือกเอกสาร
2. ระบบ build snapshot สำหรับ report
3. formatter แปลงข้อมูลเป็น display format
4. renderer สร้าง PDF/Excel/CSV
5. เก็บ / ส่งออกไฟล์

#### Recommended functions
```ts
buildQuotationReportSnapshot(quotationId)
buildCommercialInvoiceSnapshot(invoiceId)
renderPdf(templateName, snapshot)
renderExcel(exportType, rows)
```

### 12.2 หลักที่สำคัญมาก
- report ต้องใช้ snapshot
- UI กับ export ต้องใช้ data contract เดียวกัน
- คอลัมน์ Pack / CTN / Packaging Qty ต้องตรงกันทุกช่องทาง

### 12.3 Pagination Logic
จาก requirement ที่เคยมี เช่น หน้าละ 15 รายการ

#### Recommended functions
```ts
paginateLineItems(lines, maxRowsPerPage)
appendFillerRows(lines, maxRows)
isLastPage(pageIndex, totalPages)
```

### 12.4 Amount in Words / Currency Conversion
เคยมี requirement เช่น
- amount in words ตามภาษา
- exchange rate จาก system rate หรือ custom rate
- Freight USD ไม่ต้อง convert ซ้ำถ้าเป็น USD อยู่แล้ว

#### Recommended functions
```ts
convertCurrency(amount, from, to, rate)
resolveExchangeRate(context)
amountToText(amount, currency, locale)
```

---

## 13) Document Attachment / Custom Document Flow

จากบริบทระบบมี model เอกสารแยก เช่น document type + attachment

### 13.1 Flow
1. ผู้ใช้เลือก document type
2. ระบบ generate sequence ตามประเภทเอกสาร
3. อัปโหลด attachments
4. ผูกกับ partner / project / record ที่เกี่ยวข้อง

#### Recommended functions
```ts
createDocumentRecord(input)
assignDocumentNumberByType(documentTypeId)
uploadDocumentAttachment(documentId, file)
linkDocumentToEntity(documentId, entityType, entityId)
```

---

## 14) UI / Form Behavior ที่ระบบนี้ให้ความสำคัญ

แม้เอกสารนี้เน้น backend/domain แต่ UI behavior หลายอย่างถือเป็น business rule ด้วย

### ตัวอย่างสำคัญ
- field บางตัว invisible ตาม x_type
- many2many tags ใช้เลือกข้อมูลหลายตัว
- field บางตัว readonly หลังออก invoice แล้ว
- section/note ใน line table ต้องไม่โดนจัดใหม่ผิด
- kanban ต้องแสดงข้อมูลที่พอดี ไม่ล้น
- summary page อาจซ่อนข้อมูลที่ไม่จำเป็นแต่เก็บข้อมูลเต็มไว้

#### Recommended UI helper functions
```ts
getFieldVisibility(fieldName, context)
getFieldReadonly(fieldName, context)
getAvailableActions(record)
mapStatusToBadge(status)
```

---

## 15) Testing Map ที่ควรมีสำหรับระบบนี้

ถ้าจะทำระบบ clone ให้เสถียร ต้อง test ตาม flow ธุรกิจ ไม่ใช่ test แค่ CRUD

### 15.1 Master Data Tests
- สร้าง partner ได้
- เลือก region แล้ว salesperson เด้งได้
- product active แล้ว sale_ok เปิดถูกต้อง
- packaging คำนวณถูก

### 15.2 Sales Tests
- quotation คำนวณยอดถูก
- section ไม่ reorder ผิด
- confirm แล้ว stock status เปลี่ยน
- delivery validate แล้ว stock status = ตัดสต็อคแล้ว
- ออก invoice แล้ว lock field ที่ต้อง lock

### 15.3 Purchase Tests
- order request สร้างได้
- PR approve แล้ว order request status sync กลับ
- PO ต่างประเทศ default no tax
- MOQ จาก vendor เด้งได้

### 15.4 Shipping Tests
- สร้าง shipping ได้
- ผูกหลาย PO ได้
- create bill from shipping ได้
- shipping document render ถูก

### 15.5 Sequence Tests
- แยกเลขตาม department ถูก
- แยกเลขตาม journal ถูก
- reset รายเดือนถูก
- draft recompute ทำงานเฉพาะตอนที่ควรทำ

### 15.6 Report Tests
- PDF ตรงกับ UI totals
- export มี Pack/CTN ครบ
- pagination 15 rows ต่อหน้าถูก
- summary อยู่หน้าสุดท้ายเท่านั้น

---

## 16) Suggested Use Case Inventory

ด้านล่างคือรายการ use case ที่ agent ใหม่ควรเห็นเป็น backlog เชิงระบบ

### Master Data
- Create Partner
- Assign Salesperson by Region
- Create Product
- Manage Packaging
- Manage Department / Region / Employee

### Sales
- Create Quotation
- Reorder Sales Lines
- Confirm Sales Order
- Sync Stock Status
- Sync Delivery Status
- Generate Invoice
- Prevent Duplicate Billing

### Purchase
- Create Order Request
- Submit Purchase Request
- Approve Purchase Request
- Create Purchase Order
- Auto-fill MOQ
- Apply Purchase Tax Policy

### Inventory
- Reserve Stock
- Create Delivery Order
- Validate Delivery
- Receive Goods from PO

### Shipping
- Create Shipping Record
- Attach POs to Shipping
- Calculate Container Utilization
- Create Bill from Shipping
- Generate Shipping Documents

### Report / Document
- Generate Quotation PDF
- Generate Commercial Invoice PDF
- Export Sales Data
- Export Purchase Data
- Register Document Attachment

### Cross-cutting
- Generate Sequence Number
- Recompute Draft Number
- Submit for Approval
- Sync Upstream/Downstream Status

---

## 17) ตัวอย่าง Function Responsibility Matrix

| Function | หน้าที่ | ห้ามทำอะไร |
|---|---|---|
| `createQuotation` | สร้าง quotation และ line item | ห้าม render PDF |
| `confirmSalesOrder` | เปลี่ยนสถานะและ trigger stock reservation | ห้าม query UI config |
| `syncStockStatus` | คำนวณและอัปเดตสถานะ stock | ห้ามเปลี่ยนราคาหรือ tax |
| `createPurchaseOrder` | สร้าง PO จาก input/PR | ห้าม generate report |
| `applyVendorDefaults` | เติม tax/MOQ/note จาก vendor | ห้าม confirm PO เอง |
| `generateDocumentNumber` | คืนเลขเอกสารตาม policy | ห้ามแก้ business status |
| `renderPdf` | render เอกสารจาก snapshot | ห้ามคำนวณยอดธุรกิจใหม่ |
| `submitForApproval` | เปิด approval chain | ห้าม skip policy โดยไม่มีเหตุผล |

---

## 18) Recommended Flow by Event

ระบบนี้เหมาะกับการคิดแบบ event-driven บางส่วน

### Event ตัวอย่าง
- quotation.created
- sales_order.confirmed
- delivery.validated
- purchase_request.approved
- purchase_order.confirmed
- shipping.status_changed
- invoice.generated

### Example reaction map

```ts
onSalesOrderConfirmed() => {
  reserveStock();
  syncStockStatus();
  maybeCreateDeliveryDraft();
}

onDeliveryValidated() => {
  syncStockStatus();
  syncDeliveryStatusToSalesOrder();
}

onPurchaseRequestApproved() => {
  syncOrderRequestStatus();
  maybeAllowPurchaseOrderCreation();
}
```

---

## 19) Clean Code Checklist สำหรับ agent ที่จะมารับงานต่อ

ก่อนเขียน module ใหม่ทุกครั้ง ให้เช็ก

### Domain
- entity ชัดหรือยัง
- enum/status ชัดหรือยัง
- relation ระหว่างเอกสารชัดหรือยัง

### Service
- function นี้ทำแค่เรื่องเดียวหรือยัง
- validation แยกแล้วหรือยัง
- side effect ชัดหรือยัง

### Data
- ใช้ interface กลางหรือยัง
- report snapshot แยกหรือยัง
- sequence context ถูก normalize หรือยัง

### Testing
- test happy path แล้วหรือยัง
- test invalid transition แล้วหรือยัง
- test duplicate prevention แล้วหรือยัง
- test permission แล้วหรือยัง

---

## 20) สรุปสุดท้าย

ถ้าจะให้เข้าใจ flow ของระบบนี้แบบสั้นแต่ครบ ให้มองเป็นลำดับนี้

1. ตั้ง master data ให้ครบ
2. ใช้ partner/product/employee เป็นฐานของ transaction
3. ฝั่งขายเริ่มจาก Quotation → SO → Delivery → Invoice
4. ฝั่งซื้อเริ่มจาก Order Request → PR/Approval → PO → Receive / Shipping / Billing
5. Shipping เป็นโดเมนเฉพาะที่เชื่อมกับ PO และเอกสารนำเข้า/ส่งออก
6. ทุก flow ต้องมี sequence, status sync, approval, และ report snapshot
7. ถ้าจะเขียนใหม่ใน TypeScript ให้เริ่มจาก type/interface, service boundaries, state transition rules, และ shared utilities ก่อนเสมอ

เอกสารนี้จึงไม่ใช่แค่บอก “ระบบมีอะไร” แต่บอกด้วยว่า “ควรจัดโค้ดยังไงเพื่อให้ระบบนี้โตได้โดยไม่พังในอนาคต”

