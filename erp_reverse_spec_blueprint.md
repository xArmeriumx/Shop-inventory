# ERP System Reverse-Spec Blueprint
เวอร์ชันสรุปจากบริบทการออกแบบ/ปรับแต่งระบบ ERP ที่เคยทำร่วมกัน  
รูปแบบเอกสารนี้ตั้งใจเขียนให้ใช้เป็น **Blueprint สำหรับสร้างระบบใหม่ที่มีพฤติกรรมใกล้เคียงของเดิมมากที่สุด**  
เน้นอธิบายเชิง **Functional Design + Data/Logic Design + Implementation Mapping**

---

## 1) วัตถุประสงค์ของเอกสาร
เอกสารนี้มีเป้าหมายเพื่อสรุประบบ ERP ที่เคยออกแบบและปรับแต่งไว้ในเชิงใช้งานจริง โดยครอบคลุม:

- โครงสร้างโมดูลหลักของระบบ
- ฟังก์ชันการทำงานสำคัญ
- Use Case เชิงธุรกิจ
- Input → Logic → Output
- Business Rules
- แนวทางออกแบบฐานข้อมูล
- แนวทางสร้าง Workflow / Automation / Document Sequence / Report
- แนวทางย้ายแนวคิดจาก Odoo/Studio ไปเป็นระบบใหม่

> หมายเหตุ: เอกสารนี้อธิบายเพื่อใช้เป็น **แบบจำลองเชิงระบบ** ไม่ใช่การคัดลอกโค้ดตรงๆ จากแพลตฟอร์มเดิม

---

## 2) ภาพรวมระบบที่ต้องการเลียนแบบ
ระบบเดิมมีลักษณะเป็น ERP ที่ไม่ได้เป็นแค่ CRUD พื้นฐาน แต่เป็นระบบที่เชื่อมหลายฝ่ายเข้าด้วยกัน ได้แก่:

- Sales
- Customer / Contact
- Purchase
- Inventory
- Shipping / Logistics
- Accounting / Invoice / Billing
- Document Management
- Reporting / Print Forms
- Workflow Automation
- Status Synchronization

จุดเด่นของระบบเดิมคือ:
1. **มีเลขเอกสารซับซ้อน**
2. **มีการซิงก์สถานะข้ามโมดูล**
3. **มีรายงานทางการค้าซับซ้อน**
4. **มี Business Rule ตามงานจริง**
5. **มีการคุมสิทธิ์/การล็อกข้อมูลในบางจุด**
6. **มีการดึงค่าจาก master data เข้าสู่ transaction อัตโนมัติ**

---

## 3) Core Design Principles ของระบบใหม่
ถ้าจะสร้างใหม่ให้ “พฤติกรรมเหมือนเดิม” ควรยึดหลักดังนี้

### 3.1 Snapshot over Hard Reference
ข้อมูลหลายตัวควรดึงค่าจาก master data มาเป็นค่าเริ่มต้นใน transaction แต่ไม่ผูกตาย เช่น:
- แผนกจาก Employee ลง SO
- เครดิตจาก Contact ลง Sales/Invoice
- MOQ จาก Vendor ลง PO Line

เหตุผล:
- ข้อมูลใน transaction ต้องสะท้อน ณ เวลาที่สร้าง
- ผู้ใช้ต้องแก้ไขเฉพาะ transaction ได้
- การแก้ transaction ต้องไม่ย้อนกลับไปแก้ master

### 3.2 Status as Business View
หลายสถานะไม่ควรโชว์แค่ state ดิบของระบบ แต่ควรแปลงเป็นภาษาธุรกิจ เช่น:
- ยังไม่จองสต็อก
- จองสต็อกแล้ว
- ตัดสต็อกแล้ว
- รอการจัดส่ง
- อยู่ระหว่างการจัดส่ง
- จัดส่งสำเร็จ

### 3.3 Sequence เป็น First-Class Feature
เลขเอกสารเป็นฟีเจอร์หลัก ไม่ใช่ของแถม:
- แยกตามประเภท
- แยกตามแผนก
- แยกตาม journal
- รีเซ็ตรายเดือน/รายปี
- รองรับ prefix พิเศษ
- รองรับปีไทยบางกรณี

### 3.4 Reports ต้องคิดเหมือน Subsystem
รายงานไม่ใช่แค่ “template print”
แต่เป็น subsystem ที่มี:
- calculation logic
- currency conversion
- page control
- dynamic bank info
- summary เฉพาะหน้าสุดท้าย
- signature / stamp

### 3.5 Automation ต้องออกแบบแบบ Event-Driven
ระบบใหม่ควรมี event hooks เช่น:
- beforeCreate
- afterCreate
- beforeUpdate
- afterUpdate
- onConfirm
- onValidate
- onStateChange

เพื่อแทน Automated Actions ของเดิม

---

## 4) โมดูลหลักของระบบ

# 4.1 Sales Module

## 4.1.1 เป้าหมาย
จัดการใบเสนอขาย/ใบขาย โดยผูกข้อมูลกับลูกค้า พนักงานขาย สถานะสต็อก และเอกสารปลายทาง

## 4.1.2 Entities หลัก
- SalesOrder
- SalesOrderLine
- Customer
- Employee
- Delivery / Picking
- Invoice

## 4.1.3 ฟีเจอร์หลัก
- สร้าง Sales Order
- ดึงแผนก/รหัสแผนกจาก Employee
- เก็บ salesperson/department แบบแก้ไขได้
- แสดงสถานะการจองสต็อก
- ล็อก field หลังเข้าสถานะสำคัญ
- เชื่อมไป delivery และ invoice

## 4.1.4 Use Case: เติมแผนกสินค้าอัตโนมัติจาก Employee

### Input
- current_user_id
- employee.user_id
- employee.department_code

### Logic
1. ผู้ใช้กดสร้าง Sales Order
2. ระบบค้นหา employee ที่ผูกกับ user
3. ถ้าพบ department_code ให้ใส่ลง field ใน SO
4. ถ้าไม่พบให้เว้นว่าง
5. หลังสร้างแล้ว ผู้ใช้ยังแก้ค่าได้เอง
6. ห้ามแก้กลับไป employee

### Output
- SO.department_code ถูกตั้งค่า default

### Example
- Employee A.department_code = `K`
- สร้าง SO ใหม่
- SO.department_code = `K`

## 4.1.5 Use Case: สถานะจองสต็อกบน SO

### Input
- sales_order.state
- delivery.state
- delivery.done_flag

### Logic
- ถ้า SO ยัง draft/quotation → `ยังไม่จองสต็อก`
- ถ้า SO confirm แล้ว แต่ delivery ยังไม่ done → `จองสต็อกแล้ว`
- ถ้า delivery done → `ตัดสต็อกแล้ว`

### Output
- sales_order.stock_status_label

### Example
- state = sale
- delivery exists, not done
- Output = `จองสต็อกแล้ว`

---

# 4.2 Contact / Customer Module

## 4.2.1 เป้าหมาย
เก็บ master data ลูกค้า/ผู้ขาย และเชื่อมทีมขายตามพื้นที่

## 4.2.2 Entities หลัก
- Contact / Partner
- Region
- Province
- Employee
- Sales Team
- Customer Group
- Credit Term

## 4.2.3 ฟีเจอร์หลัก
- เก็บข้อมูลลูกค้าแบบขยาย
- หลาย salesperson ต่อ 1 ลูกค้า
- ดึง salesperson ตาม region
- เก็บเลขภาษี / เลขบัตร / รหัสลูกค้า / เขตขาย / province / region

## 4.2.4 Use Case: ดึง Salesperson ตาม Region

### Input
- contact.region_id
- employee.region_ids

### Logic
1. เมื่อ contact.region เปลี่ยน
2. ค้น employee ที่มี region นี้ในรายการที่รับผิดชอบ
3. เติม employee ทั้งหมดลง contact.salesperson_ids
4. ถ้าไม่มี region ให้ clear ค่า

### Output
- contact.salesperson_ids

### Example
- Contact.region = `Northeast`
- Employee E1 ดูแล Northeast
- Employee E2 ดูแล Northeast + North
- Output = `[E1, E2]`

---

# 4.3 Product / Inventory Module

## 4.3.1 เป้าหมาย
ควบคุมข้อมูลสินค้า สถานะขายได้ การนำเข้า และการตีความยอดสต็อก

## 4.3.2 Entities หลัก
- Product
- ProductVariant
- StockQuant
- StockReservation
- ProductPackaging
- ImportTemplate

## 4.3.3 ฟีเจอร์หลัก
- sale_ok auto-set เมื่อ active
- import data cleanup
- duplicate code handling
- minimum quantity logic
- reservation-aware stock view

## 4.3.4 Use Case: Product Active → sale_ok = true

### Input
- product.state

### Logic
- ถ้า product.state == active → set sale_ok = true

### Output
- product.sale_ok

### Example
- x_state = active
- sale_ok = true

## 4.3.5 Use Case: ล้างรหัสสินค้าซ้ำก่อน import

### Input
- list of product_code rows in original order

### Logic
1. อ่านจากบนลงล่าง
2. เจอครั้งแรกให้เก็บ
3. เจอซ้ำครั้งถัดไปให้ล้าง cell เป็นว่าง
4. ห้าม reorder

### Output
- cleaned import sheet preserving row order

### Example
Input:
- A001
- A002
- A001
- A003

Output:
- A001
- A002
- [blank]
- A003

## 4.3.6 Inventory Rule สำคัญ
ต้องแยกอย่างน้อย 3 ค่า:
- On Hand
- Reserved
- Available to Sell

สูตรแนะนำ:
```text
available_to_sell = on_hand - reserved
```

ระบบแจ้งเตือน minimum quantity ควรยึดค่าไหน ต้องตัดสินตามธุรกิจ:
- ถ้าต้องการมอง stock จริงในคลัง → on_hand
- ถ้าต้องการมอง stock ที่ยังขายได้ → available_to_sell

แนะนำระบบใหม่ให้เก็บทั้งสองค่าและแสดง label ชัดเจน

---

# 4.4 Purchase Module

## 4.4.1 เป้าหมาย
รองรับการซื้อแบบไทย/ต่างประเทศ พร้อมเงื่อนไขเอกสารและ vendor data

## 4.4.2 Entities หลัก
- PurchaseRequest
- PurchaseOrder
- PurchaseOrderLine
- Vendor
- SupplierInfo
- MOQ / VendorPrice

## 4.4.3 ฟีเจอร์หลัก
- แยกเลข PR / PO
- แยกไทย / ต่างประเทศ
- default tax ตามประเภทซื้อ
- internal purchase note
- MOQ auto-display
- product group/category filter

## 4.4.4 Use Case: รันเลข PR/PO ตามประเภทซื้อ

### Input
- document_type = PR or PO
- purchase_type = local or foreign
- document_date

### Logic
1. แยก sequence ตาม document_type
2. แยก sub-sequence ตาม purchase_type
3. generate prefix ตาม rule
4. generate running no.

### Output
- document_no

### Example
- PO + Foreign + Apr 2026
- Output = `T-PO-2604-0001`

## 4.4.5 Use Case: ดึง MOQ จาก Vendor

### Input
- selected_vendor_id
- selected_product_id
- supplier_info table

### Logic
1. เลือก Vendor
2. เลือก Product
3. query supplier_info by vendor + product
4. ถ้าพบ ให้ดึง MOQ
5. ถ้าไม่พบ ให้ null/0

### Output
- po_line.moq

### Example
- Vendor A + Product P
- supplier_info MOQ = 500
- Output = 500

---

# 4.5 Shipping / Logistics Module

## 4.5.1 เป้าหมาย
ติดตามการจัดส่ง สถานะ route เอกสาร shipping และลำดับวิ่งงาน

## 4.5.2 Entities หลัก
- ShippingOrder
- DeliveryOrder
- RoutePlan
- RouteLine
- ShippingBill
- ContainerPlan

## 4.5.3 ฟีเจอร์หลัก
- sync สถานะกลับไปต้นทาง
- route process / distance sort
- shipping sequence
- create bill from shipping
- container/load calculation
- รับเข้า/ส่งต่อฝ่ายรับเข้า

## 4.5.4 Use Case: Sync Shipping Status กลับไป SO

### Input
- shipping.state
- shipping.origin_ref
- sales_order.x_delivery_status

### Logic
- New + มี DO → `รอการจัดส่ง`
- Process → `อยู่ระหว่างการจัดส่ง`
- Confirm → `จัดส่งสำเร็จ`

### Output
- sales_order.delivery_status

### Example
- Shipping.state = process
- Output on SO = `อยู่ระหว่างการจัดส่ง`

## 4.5.5 Use Case: Route Sorting ตามระยะทาง

### Input
- company_lat, company_lng
- destination_lat, destination_lng
- route_type

### Logic
1. กด Process
2. set route state = process
3. คำนวณ distance
4. ถ้า outbound: sort near → far
5. ถ้า inbound: sort far → near
6. assign sequence
7. reorder route lines

### Output
- route_line.sequence
- ordered stops

### Example
- A = 5 km
- B = 20 km
- C = 12 km
- outbound
- Output order = A, C, B

---

# 4.6 Accounting / Invoice / Billing Module

## 4.6.1 เป้าหมาย
ควบคุม invoice, billing, outstanding, tax handling, และเลขเอกสารซับซ้อน

## 4.6.2 Entities หลัก
- AccountMove / Invoice
- BillingBatch
- Journal
- DepartmentCode
- CreditNote
- WithholdingTaxRecord

## 4.6.3 ฟีเจอร์หลัก
- invoice sequence ตามแผนก
- prefix override ตาม type/journal
- reset monthly/yearly
- ป้องกันดึงบิลซ้ำ
- support VAT / non-VAT credit note
- outstanding amount interpretation

## 4.6.4 Use Case: รันเลข Invoice ตามแผนก

### Input
- move_type
- state
- current_name
- department_code
- invoice_date

### Logic
1. เฉพาะ out_invoice
2. ต้อง draft
3. name ต้องยังไม่ใช่เลขจริง
4. หา department_code
5. เลือก sequence bucket ของแผนก
6. สร้างเลข เช่น `{DEPT}{YY}{MM}/{RUN}` หรือ format ตามองค์กร

### Output
- invoice.name

### Example
- dept = K
- year=69, month=03, run=0009
- Output = `K6903/0009`

## 4.6.5 Use Case: Prefix Override เป็น OD ถ้า x_type = de

### Input
- invoice.x_type

### Logic
- ถ้า x_type == de → ใช้ prefix OD และ counter แยก

### Output
- invoice.name

### Example
- x_type = de
- Output = `OD6903/0013`

## 4.6.6 Use Case: กันดึง Invoice ซ้ำไป Billing

### Input
- selected_invoice_id
- billing_invoice_link table

### Logic
1. ผู้ใช้เลือก invoice
2. ระบบเช็กว่ามี billing link อยู่แล้วหรือไม่
3. ถ้ามี → block
4. ถ้าไม่มี → allow

### Output
- selectable / blocked result

### Example
- INV001 ถูกผูก Billing B001 แล้ว
- Output = ไม่ให้เลือกซ้ำ

## 4.6.7 Outstanding / VAT Rule
ในระบบใหม่ควรเก็บแยก:
- untaxed_amount
- vat_amount
- total_amount
- paid_amount
- outstanding_amount

และระบุชัดเจนใน UI/Export ว่าฟิลด์ไหน “รวม VAT แล้ว” หรือ “ยังไม่รวม VAT”

---

# 4.7 Document Management Module

## 4.7.1 เป้าหมาย
เก็บเอกสารภายใน แยกประเภท และรันเลขเอกสารตามประเภท/ปี

## 4.7.2 Entities หลัก
- TaskDocument
- DocumentType
- Attachment
- Tag
- Project
- Partner

## 4.7.3 ฟีเจอร์หลัก
- many attachments
- document type
- sequence by type
- yearly reset
- partner/project relation
- kanban display

## 4.7.4 Use Case: รันเลขเอกสารตาม Type + ปี

### Input
- document_type
- document_date

### Logic
1. เลือก sequence bucket ตาม type
2. ดูปีของเอกสาร
3. reset counter ถ้าปีใหม่
4. generate number

### Output
- doc.no

### Example
- type = License
- year = 2026
- Output = `LIC-2026-0008`

---

# 4.8 Reporting / Print Forms Module

## 4.8.1 เป้าหมาย
สร้างรายงานเอกสารทางการค้า/ขนส่ง/การเงินที่มีทั้ง layout และ logic คำนวณ

## 4.8.2 รายงานที่ต้องรองรับ
- Quotation
- Service Quotation
- Proforma Invoice
- Commercial Invoice
- Packing List
- Custom Header/Footer

## 4.8.3 ฟีเจอร์หลัก
- dynamic header info
- fixed line table
- filler rows
- summary only last page
- amount in words
- bank details
- signature blocks
- stamp overlay
- currency conversion
- carton/CTN calculation
- charge allocation

## 4.8.4 Use Case: แปลงราคา CNY → USD ในรายงาน

### Input
- source_currency
- target_currency = USD
- price
- exchange_rate
- freight_already_usd flag

### Logic
1. ถ้ารายงานต้องแสดง USD
2. ถ้า source != USD
3. แปลงด้วย exchange rate
4. ถ้าบาง field เป็น USD อยู่แล้ว อย่า convert ซ้ำ

### Output
- rendered usd price

### Example
- 100 CNY
- rate 7.2
- Output ≈ 13.89 USD

## 4.8.5 Use Case: คำนวณ CTN

### Input
- total_qty
- qty_per_carton

### Logic
- CTN = total_qty / qty_per_carton

### Output
- carton count

### Example
- qty=240
- per carton=24
- Output=10

## 4.8.6 Use Case: กระจาย Charge ไปแต่ละ line

### Input
- normal lines total value
- charge line amount

### Logic
1. หาผลรวมมูลค่าของ line ปกติ
2. คำนวณสัดส่วนต่อ line
3. แจก charge ตามสัดส่วน

### Output
- adjusted line values

### Example
- A=100
- B=300
- Charge=40
- Output:
  - A gets 10
  - B gets 30

## 4.8.7 Use Case: แสดง Summary เฉพาะหน้าสุดท้าย

### Input
- total_lines
- max_rows_per_page
- page index

### Logic
- page non-last → show table only
- last page → show totals + signatures

### Output
- paged report layout

---

# 4.9 Workflow / Automation Module

## 4.9.1 เป้าหมาย
แทนที่ Automated Action แบบเดิมด้วย event-driven logic ที่สม่ำเสมอและ testable

## 4.9.2 ฟีเจอร์หลัก
- field autofill
- status sync
- sequence generation
- duplicate prevention
- conditional lock/unlock
- propagation across models

## 4.9.3 Event Model ที่ควรมี
- onCreate
- onUpdate
- onBeforeSave
- onAfterSave
- onConfirm
- onCancel
- onValidate
- onStateChanged

## 4.9.4 Use Case: Sync Status ข้ามโมเดล

### Input
- current record state
- linked source record

### Logic
1. record ปลายทางเปลี่ยน state
2. map state ไปยัง business label
3. update source record

### Output
- source record status updated

### Example
- PR state = in_progress
- Order Request status = `ยืนยัน PR แล้ว`

---

## 5) Data Model ที่แนะนำ

### 5.1 Employee
```text
id
user_id
name
department_code
region_ids[]
default_sales_team_id
```

### 5.2 Contact
```text
id
customer_code
name
tax_id
citizen_id
phone
province_id
region_id
salesperson_ids[]
credit_days
rating
sales_zone_code
customer_group_code
```

### 5.3 SalesOrder
```text
id
order_no
customer_id
salesperson_id
department_code
stock_status_label
state
delivery_status
invoice_ids[]
```

### 5.4 PurchaseOrder
```text
id
po_no
po_type(local|foreign)
vendor_id
tax_mode
internal_note
state
```

### 5.5 PurchaseOrderLine
```text
id
purchase_order_id
product_id
qty
price
moq
vendor_note
```

### 5.6 Product
```text
id
sku
name
state
sale_ok
on_hand_qty
reserved_qty
available_qty
packaging_qty
```

### 5.7 Invoice
```text
id
name
move_type
x_type
department_code
journal_id
untaxed_amount
vat_amount
total_amount
paid_amount
outstanding_amount
billing_link_id
state
```

### 5.8 ShippingOrder
```text
id
shipping_no
origin_ref_type
origin_ref_id
state
delivery_status_label
route_lines[]
```

### 5.9 Document
```text
id
doc_no
doc_type_id
doc_date
partner_id
project_id
tag_ids[]
attachments[]
```

---

## 6) Sequence Engine Design
ระบบใหม่ควรแยก Sequence Engine เป็น service อิสระ

### 6.1 Input
- sequence_key
- date
- optional prefix parts
- org/unit context

### 6.2 Output
- generated document number

### 6.3 ตัวอย่าง sequence keys
- `invoice.department.K`
- `invoice.type.OD`
- `purchase.po.foreign`
- `purchase.pr.local`
- `document.license`
- `shipping.main`

### 6.4 Rules ที่ต้องรองรับ
- reset monthly
- reset yearly
- buddhist year offset
- per-department counters
- per-prefix counters
- auto-create missing buckets

### 6.5 Pseudocode
```text
function nextNumber(sequenceKey, date, formatConfig):
    bucket = findOrCreateBucket(sequenceKey, periodFrom(date))
    bucket.current += 1
    return render(formatConfig, bucket.current, date)
```

---

## 7) Permission / Locking Rules
ระบบใหม่ควรมี rule layer แยกจาก UI

ตัวอย่าง:
- ถ้า SO ออก invoice แล้ว บาง field ห้ามแก้
- ถ้า invoice ถูกใช้ใน billing แล้ว ห้ามดึงซ้ำ
- draft แก้ได้, posted แก้ไม่ได้
- บาง field readonly ตาม state

แนะนำให้เก็บ rule แบบ declarative เช่น:
```json
{
  "entity": "invoice",
  "condition": "billing_link_id != null",
  "effect": "disallow_select_for_billing"
}
```

---

## 8) UI Behavior ที่ต้องเลียนแบบ
- ซ่อน/แสดง field ตาม type
- many2many tags สำหรับ region/salesperson
- badge label สำหรับ status
- summary pages แสดงเฉพาะข้อมูลจำเป็น
- mobile views ตัดข้อมูลเกินจำเป็น
- HTML section บางจุดต้อง disable ใน specific views เท่านั้น

---

## 9) Import / Export Design
### Import ที่ต้องรองรับ
- Contact import โดยคง column order เป๊ะ
- Product import cleanup
- CSV/XLSX export ตามโครงสร้างธุรกิจ

### หลักการ
- อย่า reorder row ถ้า requirement ต้องคงลำดับ
- ต้องระบุ mapping template ตายตัว
- ช่องว่างต้องคงไว้ ไม่เลื่อนข้อมูลขึ้น

---

## 10) Architecture ถ้าสร้างใหม่ด้วย Next.js + Prisma + Server Actions

### 10.1 Recommended Modules
```text
app/
  sales/
  purchase/
  inventory/
  shipping/
  accounting/
  contacts/
  reports/
  documents/

src/
  modules/
    sales/
      actions/
      services/
      repositories/
      validators/
      mappers/
    purchase/
    inventory/
    shipping/
    accounting/
    reports/
  lib/
    db/
    auth/
    sequence/
    workflow/
    permissions/
```

### 10.2 Layer Responsibilities
- **actions/** รับ input จาก UI
- **validators/** ตรวจ schema
- **services/** เก็บ business logic
- **repositories/** คุยฐานข้อมูล
- **workflow/** sync status / lifecycle
- **sequence/** generate running numbers
- **reports/** build printable data model

### 10.3 Rule สำคัญ
- Read data ใช้ server-side read ปกติ
- Mutations ใช้ action/service
- ห้ามกระจาย business logic เข้า UI
- report logic ห้ามฝังใน component แบบมั่วๆ

---

## 11) Functional Build Order
ถ้าจะสร้างระบบใหม่ให้พฤติกรรมเหมือนเดิม ควรสร้างตามลำดับนี้

### Phase 1: Master Data
- Employee
- Contact
- Product
- Region / Province
- Vendor / Supplier info
- Packaging
- Department code
- Document type

### Phase 2: Transaction Core
- Sales Order
- Purchase Order / Request
- Invoice
- Shipping Order
- Document records

### Phase 3: Sequence Engine
- PR/PO sequence
- Invoice sequence
- Document sequence
- Shipping sequence

### Phase 4: Workflow Engine
- status sync
- delivery status
- stock status label
- duplicate prevention
- locking rules

### Phase 5: Reports
- quotation
- invoice
- packing list
- commercial invoice
- service quotation

### Phase 6: Import/Export
- contact template
- product cleanup
- accounting export fields

### Phase 7: Advanced Logistics
- route sorting
- container planning
- shipping bill creation

---

## 12) Testing Scenarios ที่ต้องมี
### Sales
- สร้าง SO ด้วย user ที่มี department
- สร้าง SO ด้วย user ไม่มี department
- เปลี่ยน department ใน SO แล้ว employee ไม่เปลี่ยน

### Contact
- เปลี่ยน region แล้ว salesperson auto-update
- clear region แล้ว salesperson clear

### Product
- active → sale_ok = true
- duplicate cleanup preserve row order

### Purchase
- PR/PO รันเลขถูกตามประเภท
- MOQ ดึงถูก vendor/product pair

### Invoice
- รันเลขตามแผนก
- override OD เมื่อ x_type=de
- ดึงซ้ำ billing ไม่ได้

### Shipping
- state map กลับไป source ถูก
- route sort ถูกลำดับ

### Reports
- currency conversion ถูก
- CTN ถูก
- charge allocation ถูก
- totals แสดงเฉพาะหน้าสุดท้าย

---

## 13) สิ่งที่ต้องระวังถ้าจะทำให้เหมือนเดิมจริง
1. อย่าทำทุกอย่างเป็น hard relation แล้วคิดว่าเหมือนเดิม
2. อย่าฝังเลข sequence ไว้กระจัดกระจาย
3. อย่าฝัง state labels เป็นข้อความตรงๆ หลายจุด
4. อย่าคิดว่า report เป็นแค่ HTML print
5. อย่าปล่อยให้ import reorder row
6. อย่ารวม business logic ไว้ใน UI layer
7. อย่าลืมว่า “snapshot values” สำคัญมาก

---

## 14) สรุป Blueprint
ถ้าต้องสร้างระบบใหม่ที่มีพฤติกรรมเหมือนระบบเดิมมากที่สุด แกนสำคัญคือ:

- **Master Data ที่ยืดหยุ่น**
- **Transaction ที่เก็บ snapshot**
- **Workflow Engine ที่ sync สถานะ**
- **Sequence Engine ที่ซับซ้อนและยืดหยุ่น**
- **Reporting Engine ที่มี calculation logic**
- **Permission/Lock Rules ที่ชัด**
- **Import/Export ที่รักษาโครงสร้างข้อมูล**
- **UI ที่ซ่อน/แสดงตามบริบทธุรกิจ**

ระบบนี้ไม่ใช่ ERP CRUD ธรรมดา แต่เป็น ERP ที่ถูก customize จากการใช้งานจริงของหลายฝ่าย  
ดังนั้นการสร้างใหม่ให้เหมือนเดิม ต้องสร้าง “พฤติกรรมทางธุรกิจ” ให้เหมือน ไม่ใช่แค่หน้าจอเหมือน

---

## 15) ภาคผนวก: Template Use Case มาตรฐาน
ใช้ template นี้แตกฟังก์ชันเพิ่มได้

```text
Use Case Name:
Objective:
Trigger:
Inputs:
Preconditions:
Business Logic:
Outputs:
Error Cases:
Example Input:
Example Output:
```

---

## 16) ภาคผนวก: ตัวอย่าง Mapping Functional Spec → Implementation
### Example: SO default department
- Functional Spec: ดึงแผนกจาก Employee ตอนสร้าง SO
- DB: employee.department_code, sales_order.department_code
- Service: salesOrderDefaultsService
- Event: onCreateSalesOrder
- UI: field editable after default set
- Test:
  - with employee department
  - without employee department
  - editing on SO does not update employee

### Example: Invoice sequence by department
- Functional Spec: รันเลขตาม department code
- DB: invoice.department_code, sequence_bucket
- Service: invoiceNumberService
- Event: beforeInvoiceSave / onDraftCreate
- Rule:
  - only out_invoice
  - only draft
  - only name empty
- Test:
  - K / M / OD prefix
  - monthly reset
  - duplicate prevention

---

จบเอกสาร
