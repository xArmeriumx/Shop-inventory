# 04 ERP Test Cases

> เอกสารนี้เป็นชุด **Test Strategy + Test Case Catalog** สำหรับระบบ ERP นี้  
> เป้าหมายคือให้ agent / developer / QA สามารถใช้เอกสารนี้เป็นฐานในการสร้าง test จริงได้ทั้งระดับ unit, integration, workflow, และ UAT

---

## 1) เป้าหมายของการทดสอบ

ระบบ ERP นี้มีความเสี่ยงสูงใน 5 จุด

1. ข้อมูลคำนวณผิด
2. สถานะเอกสาร sync ไม่ตรงกัน
3. sequence ผิด format หรือชนกัน
4. ดึงเอกสารซ้ำ / link ข้าม document ผิด
5. report / export / UI แสดงข้อมูลไม่ตรงกัน

ดังนั้น test cases ต้องไม่ได้ทดสอบแค่ CRUD แต่ต้องทดสอบ

- business rule
- workflow transition
- cross-document consistency
- data snapshot correctness
- permission และ approval

---

## 2) แนวทางการทดสอบที่แนะนำ

## 2.1 Test Pyramid

### Unit Test
ทดสอบ function เล็ก เช่น
- คำนวณ subtotal
- คำนวณ tax
- แปลง exchange rate
- คำนวณ carton count
- สร้าง prefix sequence

### Integration Test
ทดสอบ service ที่แตะหลาย repository เช่น
- confirm sales order
- generate invoice from sales order
- create purchase order from purchase request
- sync delivery status

### Workflow / E2E Test
ทดสอบ flow end-to-end เช่น
- สร้าง quotation → confirm → delivery → invoice
- order request → PR → PO → shipping
- approval request → approve → unlock next step

### UAT / Scenario Test
ทดสอบตาม use case ธุรกิจจริง เช่น
- ฝ่ายขายเปิด SO แล้ว stock status เปลี่ยน
- ฝั่งบัญชีดึง invoice เข้าบิลแล้วดึงซ้ำไม่ได้
- ฝั่งจัดซื้อ import PO แล้ว no tax ถูก default

---

## 3) โครงสร้าง test suite ที่แนะนำ

```text
tests/
  unit/
    shared/
    sequence/
    money/
    packaging/
    status/
  integration/
    partner/
    sales/
    purchase/
    inventory/
    invoice/
    shipping/
    approval/
  workflows/
    sales-flow.test.ts
    purchase-flow.test.ts
    shipping-flow.test.ts
    report-flow.test.ts
```

---

## 4) Test Data Fixture ที่ควรมี

ก่อนทดสอบควรมี fixture กลาง

### 4.1 Company Fixture
- บริษัทหลัก 1 บริษัท
- default currency = THB
- additional currency = USD, CNY

### 4.2 Employee Fixture
- sales employee department K
- sales employee department T
- approver 1, approver 2
- warehouse / purchasing role

### 4.3 Partner Fixture
- customer A มี credit 30 วัน
- vendor B สำหรับ domestic
- vendor C สำหรับ import

### 4.4 Product Fixture
- product ปกติ 2 ตัว
- product ที่ saleOk = false
- product ที่ purchaseOk = false
- product ที่มี packaging 12 ชิ้นต่อกล่อง
- product ที่มี MOQ

### 4.5 Tax / Currency Fixture
- VAT 7%
- No Tax
- USD/THB rate
- CNY/USD rate

---

## 5) รูปแบบ Test Case ที่แนะนำ

```md
### TC-SALES-001
**Title:** Confirm quotation changes stock status to reserved
**Precondition:** Sales order in quotation state with valid product lines
**Steps:**
1. Open quotation
2. Confirm sales order
**Expected Result:**
- status = sale_order
- stockStatusText = จองสต็อคแล้ว
- audit log created
```

หรือในเชิง Given/When/Then

```md
Given a quotation with valid product lines
When the user confirms the quotation
Then the document becomes sales order
And stock status text becomes "จองสต็อคแล้ว"
```

---

## 6) Master Data Test Cases

## 6.1 Partner Tests

### TC-MASTER-PARTNER-001
**Title:** Create customer partner successfully  
**Precondition:** ไม่มี partner code ซ้ำ  
**Steps:**
1. กรอก partner type = customer
2. กรอก code, name, taxId, region
3. บันทึก  
**Expected Result:**
- partner ถูกสร้าง
- status active
- salesperson ถูก assign ตาม region ถ้ามี rule

### TC-MASTER-PARTNER-002
**Title:** Reject duplicate partner code  
**Expected Result:**
- ระบบไม่อนุญาตให้บันทึก
- แจ้งข้อความว่า code ซ้ำ

### TC-MASTER-PARTNER-003
**Title:** Update partner does not break existing transaction snapshot  
**Precondition:** partner ถูกใช้ใน invoice แล้ว  
**Steps:**
1. แก้ชื่อ partner
2. เปิด invoice เก่า  
**Expected Result:**
- invoice เก่าแสดง snapshot เดิม
- รายการใหม่ใช้ชื่อใหม่ได้

---

## 6.2 Product Tests

### TC-MASTER-PRODUCT-001
**Title:** Create product with valid UOM  
**Expected Result:**
- product บันทึกได้
- defaultUomId ถูกเก็บ

### TC-MASTER-PRODUCT-002
**Title:** Product with saleOk = false cannot be used in sales line  
**Expected Result:**
- add line ไม่ผ่าน validation

### TC-MASTER-PRODUCT-003
**Title:** Product with purchaseOk = false cannot be used in purchase line  
**Expected Result:**
- add PO line ไม่ผ่าน validation

### TC-MASTER-PRODUCT-004
**Title:** Packaging summary calculates correctly  
**Precondition:** qty = 24, package = 12 ต่อกล่อง  
**Expected Result:**
- cartonCount = 2

---

## 7) Sequence Test Cases

## 7.1 General

### TC-SEQ-001
**Title:** Generate document number with correct prefix by department  
**Precondition:** employee department code = K  
**Expected Result:**
- invoiceNo เริ่มด้วย K หรือ format ที่ policy กำหนด

### TC-SEQ-002
**Title:** Generate document number with OD prefix when xType = de  
**Expected Result:**
- prefix = OD
- ใช้ counter แยก scope

### TC-SEQ-003
**Title:** Monthly reset works correctly  
**Precondition:** มีเลขเดือนก่อนหน้าแล้ว  
**Steps:**
1. สร้างเอกสารเดือนใหม่  
**Expected Result:**
- counter เริ่มใหม่จาก 1 ของเดือนนั้น

### TC-SEQ-004
**Title:** Buddhist year format is applied correctly  
**Expected Result:**
- ปีในเลขเอกสารถูก offset +543 ตาม policy

### TC-SEQ-005
**Title:** Concurrent sequence generation does not create duplicate number  
**Expected Result:**
- ไม่มีเลขซ้ำ
- transaction ที่ชนกันต้องถูก retry หรือ lock อย่างถูกต้อง

---

## 8) Sales Module Test Cases

## 8.1 Quotation Creation

### TC-SALES-001
**Title:** Create quotation with section, note, and product lines  
**Expected Result:**
- lines ถูกบันทึกครบ
- section/note อยู่ร่วมกับ product line ได้
- total คำนวณจาก product line เท่านั้น

### TC-SALES-002
**Title:** Preserve line order after save  
**Precondition:** มี section, product, note หลายบรรทัด  
**Expected Result:**
- sortOrder หลัง save ตรงกับหน้าจอ
- section ไม่ถูกย้ายขึ้นบนสุดเอง

### TC-SALES-003
**Title:** Recalculate totals after line edit  
**Expected Result:**
- subtotal/tax/total อัปเดตถูกต้อง

### TC-SALES-004
**Title:** Product line requires quantity > 0  
**Expected Result:**
- ถ้า quantity <= 0 บันทึกไม่ได้

---

## 8.2 Confirm Sales Order

### TC-SALES-005
**Title:** Confirm quotation to sales order  
**Expected Result:**
- status เปลี่ยนเป็น sale_order
- confirmedAt ถูกบันทึก
- stock reservation ถูกสร้างถ้าจำเป็น

### TC-SALES-006
**Title:** Stock status becomes reserved after confirm  
**Expected Result:**
- stockStatusText = จองสต็อคแล้ว

### TC-SALES-007
**Title:** Delivery status defaults correctly after DO exists  
**Precondition:** สร้าง DO แล้ว status = new  
**Expected Result:**
- deliveryStatusText = รอการจัดส่ง

---

## 8.3 Delivery Sync with SO

### TC-SALES-008
**Title:** SO delivery status becomes processing when DO status is process  
**Expected Result:**
- deliveryStatusText = อยู่ระหว่างการจัดส่ง

### TC-SALES-009
**Title:** SO stock status becomes cut stock after delivery validation  
**Expected Result:**
- stockStatusText = ตัดสต็อคแล้ว
- deliveryStatusText = จัดส่งสำเร็จ

---

## 8.4 Invoice from SO

### TC-SALES-010
**Title:** Generate invoice from sales order  
**Expected Result:**
- invoice ถูกสร้าง
- invoice lines map มาจาก sales lines
- totals ตรงกับ source

### TC-SALES-011
**Title:** Prevent duplicate pull to billing  
**Precondition:** SO ถูกดึงเข้า billing แล้ว  
**Expected Result:**
- ระบบไม่อนุญาตให้ดึงซ้ำ

### TC-SALES-012
**Title:** Snapshot partner data on invoice generation  
**Expected Result:**
- invoice เก็บ customerSnapshot ณ เวลาสร้าง

---

## 9) Purchase Module Test Cases

## 9.1 Order Request

### TC-PUR-001
**Title:** Create order request successfully  
**Expected Result:**
- requestNo ถูกสร้าง
- line ถูกบันทึกครบ

### TC-PUR-002
**Title:** Order request line requires valid quantity  
**Expected Result:**
- quantity <= 0 ไม่ผ่าน

---

## 9.2 Purchase Request from Order Request

### TC-PUR-003
**Title:** Create purchase request from order request  
**Expected Result:**
- PR header สร้างได้
- PR lines mapping มาจาก OR lines
- sourceOrderRequestId ถูกเก็บ

### TC-PUR-004
**Title:** PR status sync updates Order Request text  
**Precondition:** PR state = in progress / confirmed  
**Expected Result:**
- order request requestStatusText เปลี่ยนตาม rule

---

## 9.3 Purchase Order

### TC-PUR-005
**Title:** Create purchase order from PR  
**Expected Result:**
- PO สร้างได้
- sourcePurchaseRequestId ถูกเก็บ

### TC-PUR-006
**Title:** Import PO defaults to no tax  
**Precondition:** poType = import  
**Expected Result:**
- taxMode = no_tax โดยอัตโนมัติ

### TC-PUR-007
**Title:** Vendor MOQ displays on PO line  
**Expected Result:**
- vendorMoq ถูกเติมจาก master rule

### TC-PUR-008
**Title:** Packaging and CTN summary are calculated on PO line  
**Expected Result:**
- packagingQty และ cartonCount ถูกต้อง

---

## 10) Inventory & Delivery Test Cases

### TC-INV-001
**Title:** Reserve stock on confirmed sales order  
**Expected Result:**
- stock reservation record ถูกสร้าง
- availableQty ถูกคำนวณถูกต้อง

### TC-INV-002
**Title:** Release reservation when sales order is cancelled  
**Expected Result:**
- reservation status = released
- stock กลับมาพร้อมขาย

### TC-INV-003
**Title:** Validate delivery consumes reserved quantity  
**Expected Result:**
- reservation status = consumed
- deliveredQty ถูกบันทึก

### TC-INV-004
**Title:** Delivery validation updates SO statuses  
**Expected Result:**
- stockStatusText = ตัดสต็อคแล้ว
- deliveryStatusText = จัดส่งสำเร็จ

---

## 11) Invoice & Billing Test Cases

### TC-BILL-001
**Title:** Draft invoice can still be edited  
**Expected Result:**
- แก้ข้อมูลได้ตาม policy

### TC-BILL-002
**Title:** Posted invoice locks critical fields  
**Expected Result:**
- แก้ partner snapshot, totals, relation ไม่ได้

### TC-BILL-003
**Title:** Invoice numbering depends on department code  
**Expected Result:**
- prefix ถูกต้องตาม employee / SO context

### TC-BILL-004
**Title:** Credit note uses correct prefix by tax condition  
**Expected Result:**
- VCN หรือ NCN ตาม business rule

### TC-BILL-005
**Title:** Amount residual is calculated correctly  
**Expected Result:**
- amountResidual = amountTotal - amountPaid

---

## 12) Shipping Test Cases

### TC-SHIP-001
**Title:** Create shipping record from purchase order  
**Expected Result:**
- shippingNo ถูกสร้าง
- sourcePurchaseOrderId ถูกเก็บ

### TC-SHIP-002
**Title:** Shipping company filter only shows shipping account type  
**Expected Result:**
- เลือกได้เฉพาะ partner/accountType = shipping

### TC-SHIP-003
**Title:** Shipping line calculates carton and CBM summary correctly  
**Expected Result:**
- cartonCount ถูกต้อง
- cbm สรุปรวมถูกต้องถ้ามีสูตร

### TC-SHIP-004
**Title:** Create bill from shipping links source correctly  
**Expected Result:**
- billing / invoice relation ถูกสร้าง
- trace กลับ shipping ได้

### TC-SHIP-005
**Title:** Shipping status progression syncs properly  
**Expected Result:**
- new → process → confirm ทำงานตามลำดับ
- log / audit ถูกสร้าง

---

## 13) Approval Test Cases

### TC-APP-001
**Title:** Approval instance is created for document requiring approval  
**Expected Result:**
- approval record ถูกสร้าง
- currentStep = 1

### TC-APP-002
**Title:** Only assigned approver can approve current step  
**Expected Result:**
- user อื่น approve ไม่ได้

### TC-APP-003
**Title:** Approval moves to next step correctly  
**Expected Result:**
- currentStep เพิ่ม
- status เปลี่ยนถูกต้อง

### TC-APP-004
**Title:** Rejection stops downstream action  
**Expected Result:**
- เอกสารถูก lock จากการ confirm ต่อ
- มี reason เก็บใน log

---

## 14) Permission / Access Test Cases

### TC-PERM-001
**Title:** User without delete permission cannot delete protected document  
**Expected Result:**
- ลบไม่ได้
- มี error message ชัดเจน

### TC-PERM-002
**Title:** Draft document editable, confirmed document partially locked  
**Expected Result:**
- ฟิลด์สำคัญถูก readonly ตาม policy

### TC-PERM-003
**Title:** User can only see menu/module allowed by role  
**Expected Result:**
- เมนูที่ไม่มีสิทธิ์ไม่แสดงหรือเข้าไม่ได้

---

## 15) Report / Export / Snapshot Test Cases

### TC-REP-001
**Title:** Export and screen totals match  
**Expected Result:**
- ยอด subtotal/tax/total ตรงกันระหว่างหน้าจอและไฟล์ export

### TC-REP-002
**Title:** PDF report shows packaging and CTN consistently  
**Expected Result:**
- pack / CTN ตรงกับ transaction data

### TC-REP-003
**Title:** Report uses exchange rate snapshot, not current live rate  
**Expected Result:**
- เอกสารเก่าไม่เปลี่ยนตาม rate ใหม่

### TC-REP-004
**Title:** Amount in words matches final total  
**Expected Result:**
- ข้อความจำนวนเงินตรงกับยอดสุทธิ

### TC-REP-005
**Title:** Last-page-only summary block renders correctly  
**Expected Result:**
- subtotal/discount/WHT/VAT/net แสดงเฉพาะหน้าสุดท้ายถ้าตาม template

---

## 16) Negative / Edge Case Tests

### TC-EDGE-001
**Title:** Section line should not affect totals  
**Expected Result:**
- total ไม่เปลี่ยนจาก section/note line

### TC-EDGE-002
**Title:** Cancelling source document updates downstream guard correctly  
**Expected Result:**
- เอกสารถัดไปไม่สามารถสร้างเพิ่มโดยไม่ตรวจสถานะ

### TC-EDGE-003
**Title:** Changing partner master data does not mutate posted invoice  
**Expected Result:**
- invoice snapshot เดิมคงอยู่

### TC-EDGE-004
**Title:** Multi-currency conversion does not double-convert charge lines  
**Expected Result:**
- freight / charge line ใช้ rule ที่กำหนดถูกต้อง

### TC-EDGE-005
**Title:** High concurrency create invoice does not duplicate sequence  
**Expected Result:**
- ไม่มีเลขซ้ำ
- transaction integrity สมบูรณ์

---

## 17) Unit Test Targets ที่ควรมีแน่นอน

### 17.1 Amount Calculation
- `calculateLineSubtotal()`
- `calculateDiscountAmount()`
- `calculateTaxAmount()`
- `calculateOrderTotals()`

### 17.2 Packaging
- `calculatePackagingQty()`
- `calculateCartonCount()`

### 17.3 Status
- `deriveStockStatusText()`
- `deriveDeliveryStatusText()`
- `canEditInvoice()`
- `canGenerateInvoice()`

### 17.4 Sequence
- `buildSequencePrefix()`
- `buildPeriodKey()`
- `generateScopedSequenceNumber()`

### 17.5 Mapping
- `mapSalesOrderToInvoiceLines()`
- `mapOrderRequestToPurchaseRequestLines()`

---

## 18) Suggested Integration Test Scenarios

## 18.1 Sales Happy Path
1. create customer
2. create quotation with 2 product lines + 1 section
3. confirm SO
4. create DO
5. validate DO
6. generate invoice

**Expected**
- stock status flow ถูก
- delivery status flow ถูก
- invoice relation ถูก
- totals ถูกทุกจุด

## 18.2 Purchase Happy Path
1. create order request
2. create PR from order request
3. approve PR
4. create PO
5. create shipping record

**Expected**
- request status text sync ถูก
- source relation trace ได้
- PO summary ถูก

## 18.3 Import Purchase with Currency
1. create import PO in CNY
2. assign exchange rate
3. generate commercial invoice report

**Expected**
- currency conversion ถูก
- snapshot rate ถูก
- report amount ถูก

---

## 19) UAT Scenario ที่ควรมี

## 19.1 ฝ่ายขาย
- เปิดใบเสนอราคา
- เรียง section เอง
- confirm เป็น SO
- ตรวจ stock status
- ดู delivery status

## 19.2 ฝั่งจัดซื้อ
- เปิด order request
- สร้าง PR/PO
- ตรวจ MOQ / tax mode / note
- ดู shipping ต่อ

## 19.3 ฝั่งบัญชี
- ดึง invoice
- ตรวจเลขเอกสาร
- ตรวจ report และ export
- ตรวจดึงซ้ำไม่ได้

## 19.4 ฝั่งผู้บริหาร / approver
- อนุมัติเอกสาร
- ดู audit trail
- ดูสถานะและยอดรวม

---

## 20) Suggested Coverage Matrix

| Area | Unit | Integration | Workflow | UAT |
|---|---:|---:|---:|---:|
| Master Data | High | Medium | Low | Medium |
| Sales | High | High | High | High |
| Purchase | Medium | High | High | High |
| Inventory | High | High | High | Medium |
| Invoice / Billing | High | High | High | High |
| Shipping | Medium | High | High | Medium |
| Approval | Medium | High | Medium | High |
| Reports | Medium | High | Medium | High |
| Sequence | High | High | High | Medium |

---

## 21) ตัวอย่างชื่อไฟล์ test ที่แนะนำ

```text
tests/unit/sequence/generate-scoped-sequence-number.test.ts
tests/unit/sales/calculate-order-totals.test.ts
tests/unit/inventory/derive-stock-status-text.test.ts

tests/integration/sales/confirm-sales-order.integration.test.ts
tests/integration/sales/generate-invoice-from-sales-order.integration.test.ts
tests/integration/purchase/create-po-from-pr.integration.test.ts
tests/integration/shipping/create-bill-from-shipping.integration.test.ts

tests/workflows/sales-to-delivery-to-invoice.workflow.test.ts
tests/workflows/order-request-to-pr-to-po.workflow.test.ts
```

---

## 22) Definition of Done สำหรับการทดสอบแต่ละฟีเจอร์

ฟีเจอร์หนึ่งจะถือว่า test พร้อมใช้งานจริงเมื่อ

1. มี unit test ครอบ logic สำคัญ
2. มี integration test ครอบ use case หลัก
3. มี negative case อย่างน้อย 1-2 เคส
4. มี workflow test สำหรับกรณีที่เชื่อมหลายเอกสาร
5. มี UAT scenario อธิบายภาษาธุรกิจได้

---

## 23) สิ่งที่ต้องเน้นเป็นพิเศษในระบบนี้

### 23.1 อย่าทดสอบแค่ create/update/delete
ระบบนี้ต้องทดสอบ
- sync status
- snapshot consistency
- sequence scope
- report consistency
- duplicate prevention

### 23.2 ทดสอบ line ประเภท section/note จริง
เพราะระบบนี้มี requirement เรื่อง line order ชัดมาก

### 23.3 ทดสอบ draft vs confirmed vs posted
สิทธิ์แก้ไขต่างกัน

### 23.4 ทดสอบ multi-currency และ exchange rate snapshot
เพราะมีผลกับ report และเอกสาร import

---

## 24) สรุปสุดท้าย

ถ้าจะทำระบบนี้ให้เสถียรจริง  
test cases ต้องสะท้อน “ความจริงของธุรกิจ” ไม่ใช่แค่ความจริงของหน้าจอ

จุดที่ควรลงแรงมากที่สุดคือ

- sales → delivery → invoice flow
- order request → PR → PO flow
- sequence
- approval
- report/export consistency

เอกสารนี้จึงออกแบบเพื่อให้ใช้เป็นฐานสำหรับสร้าง

- `05_ERP_Traceability_Matrix.md`
- test script สำหรับ SIT/UAT
- automated tests ระดับ unit/integration/workflow
