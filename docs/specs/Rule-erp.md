# Rule-erp.md
เอกสารกติกา (Rule Book) สำหรับระบบ ERP ฉบับ Reverse-Spec  
จัดทำจากบริบท, requirement, flow, pattern, และการแก้ระบบที่เคยทำร่วมกันทั้งหมด  
เป้าหมายคือให้ใช้เป็นฐานในการ **implement ระบบใหม่ให้พฤติกรรมใกล้เคียงของเดิมมากที่สุด**

> เอกสารนี้เป็น **functional reverse-spec ที่ละเอียดที่สุดจากสิ่งที่ได้เรียนรู้ร่วมกัน**  
> ไม่ใช่การดึง source code จริง 100% แต่เขียนให้พร้อมใช้เป็นฐาน clone behavior / re-implement / design / BRD / SRS / QA test ได้ทันที

---

# สารบัญ
1. วัตถุประสงค์
2. ขอบเขตของระบบ
3. หลักการออกแบบระบบ
4. Roles / Actors
5. โมดูลหลักของ ERP
6. Master Data Rules
7. Sales Rules
8. Contact / Customer Rules
9. Product / Inventory Rules
10. Purchase Rules
11. Shipping / Logistics Rules
12. Accounting / Invoice / Billing Rules
13. Document Management Rules
14. Reporting / Print / QWeb Rules
15. Import / Export / Data Migration Rules
16. Approval / Automation / Status Sync Rules
17. Authentication / Security / Session Rules
18. Hardening / Observability / Governance Rules
19. Use Case Catalog
20. Test Case Catalog
21. Suggested Build Order
22. Known Constraints / Intentional Scope Limits

---

# 1) วัตถุประสงค์
เอกสารนี้มีเป้าหมายเพื่อกำหนด **กฎการทำงานทั้งหมดของระบบ ERP** ในเชิง:
- Business Rule
- System Rule
- Data Rule
- Security Rule
- Validation Rule
- Document / Sequence Rule
- Audit / Observability Rule
- Recovery / Resilience Rule

เอกสารนี้ตั้งใจให้ใช้เพื่อ:
- implement ระบบใหม่
- แตกต่อเป็น BRD / SRS / SDS
- ใช้เป็น QA baseline
- ใช้ทำ UAT checklist
- ใช้เป็น reference ตอน refactor / hardening / add module

---

# 2) ขอบเขตของระบบ
ระบบ ERP ฉบับนี้เน้นงานองค์กรเชิง operation จริง ประกอบด้วย:
- Sales
- Contact / Customer / Vendor
- Purchase
- Product / Inventory
- Shipping / Logistics
- Accounting / Invoice / Billing
- Document Management
- Reporting / Print Form
- Workflow / Approval / Automation
- Security / Session / Audit / Hardening

จุดเด่นของระบบ:
1. มี sequence logic ซับซ้อน
2. มีการ sync สถานะข้ามโมเดล
3. มีรายงานเอกสารเชิงธุรกิจที่ซับซ้อน
4. เน้น snapshot behavior ไม่ผูก master data แบบแข็ง
5. มี hardening / observability / governance เพื่อให้ระบบทนและตรวจสอบได้

---

# 3) หลักการออกแบบระบบ

## 3.1 Snapshot-over-Reference Principle
ข้อมูลจาก master data ที่ถูกคัดลอกเข้ามาใน transaction ต้องเป็นค่าเริ่มต้นที่ “แก้ในปลายทางได้” และไม่ย้อนกลับไปแก้ต้นทางโดยอัตโนมัติ

ตัวอย่าง:
- Employee.department_code -> SalesOrder.department_code
- Contact.credit_days -> Invoice.credit_days
- SupplierInfo.MOQ -> POLine.moq

### เหตุผล
- transaction ต้องสะท้อนข้อมูล ณ เวลาที่สร้าง
- master เปลี่ยนในอนาคตต้องไม่ย้อนทำลาย historical record
- user ต้อง override ใน transaction ได้ในบางกรณี

---

## 3.2 Single Source of Truth
แต่ละข้อมูลต้องมี owner ที่ชัด:
- Employee = default department / region assignment source
- Contact = master ลูกค้า / ผู้ขาย
- Product = item master / packaging
- SupplierInfo = vendor-product specific data
- Sequence Engine = owner ของ running number
- Workflow Engine = owner ของ state sync
- Logger / Audit = owner ของ operational evidence

---

## 3.3 Derived Business State
สถานะที่ user เห็นไม่ควรยึด technical state ดิบเสมอไป แต่ต้อง map เป็น business label ที่อ่านง่าย

ตัวอย่าง:
- Draft -> ยังไม่จองสต็อก
- Sale -> จองสต็อกแล้ว
- Delivery Done -> ตัดสต็อกแล้ว
- Shipping Process -> อยู่ระหว่างการจัดส่ง

---

## 3.4 Fail Loud vs Fail Soft
แยก behavior ให้ชัด:
- Critical mutation / approval / stock / invoice posting = **Fail Loud**
- Auxiliary read / widget / notification / dashboard = **Fail Soft** พร้อม default shape

---

## 3.5 Guarded UI Recovery
ระบบต้องไม่ล้มทั้งหน้าเพราะ widget เดียวพัง  
ต้องมี:
- SafeBoundary
- contract hardening
- render guards
- telemetry

---

# 4) Roles / Actors

## 4.1 Admin
สิทธิ์:
- เข้าถึง config
- ดู health / audit / logs
- override บาง rule
- ดู system observability
- run resilience test harness (ถ้ามี)

## 4.2 Manager
สิทธิ์:
- approve / review / monitor
- override ตาม scope ธุรกิจ
- ดู reports และ business dashboard

## 4.3 Staff
สิทธิ์:
- ทำ transaction ประจำวัน
- แก้ draft ที่ตัวเองเกี่ยวข้อง
- ใช้ workflow ตามบทบาท

## 4.4 Viewer / Auditor
สิทธิ์:
- ดูข้อมูลอย่างเดียว
- เข้า audit/report ตาม scope

## 4.5 QA / Internal Tester (optional internal role)
สิทธิ์:
- ใช้ test harness
- ทดสอบ recovery / workflow
- อ่าน logs ตาม policy

---

# 5) โมดูลหลักของ ERP

## Module A: Sales & Customer
- Sales Order
- Salesperson defaults
- Stock status display
- Customer assignment
- downstream lock

## Module B: Product & Inventory
- Product active/saleable
- on-hand / reserved / available
- packaging / CTN
- duplicate cleanup / import support

## Module C: Purchase
- PR/PO
- Local / Foreign split
- MOQ from vendor
- purchase note / tax defaults

## Module D: Shipping & Logistics
- shipping state
- route sequence
- distance sort
- bill creation from shipping
- delivery status sync

## Module E: Accounting & Billing
- invoice numbering
- billing dedup
- outstanding / VAT / WHT
- credit note classification

## Module F: Document Management
- internal documents
- attachments
- document type sequence
- kanban display

## Module G: Reporting & QWeb
- quotation / service quotation
- proforma / commercial invoice / packing list
- currency conversion
- CTN
- charge allocation
- last-page summary

## Module H: Security / Audit / Hardening
- logout guardian
- fallback telemetry
- boundary recovery
- health dashboard
- structured event taxonomy

---

# 6) Master Data Rules

## 6.1 Employee Rule
### Required Fields
- id
- user_id
- name
- department_code
- region_ids[]
- default_sales_team_id (optional)

### Rules
1. Employee อาจดูแลหลาย region ได้
2. department_code ใช้เป็น source ของ default ใน SO / Invoice
3. การแก้ค่าใน transaction ห้ามย้อนแก้ employee อัตโนมัติ
4. ถ้า user ไม่มี employee mapping ระบบต้องรับมือได้โดยไม่พัง

### Use Case
**UC-MD-EMP-01**  
เมื่อ user สร้าง Sales Order ระบบต้องหา employee ของ user และดึง department_code มาเป็นค่า default

### Test Cases
- มี employee + มี department_code -> SO default ถูกต้อง
- มี employee แต่ไม่มี department_code -> field ว่าง
- ไม่มี employee -> ระบบไม่ crash
- แก้ค่าใน SO แล้ว employee ไม่เปลี่ยน

---

## 6.2 Contact / Partner Rule
### Required Fields
- customer_code
- name
- tax_id
- citizen_id (optional)
- phone
- province_id
- region_id
- salesperson_ids[]
- credit_days
- customer_group_code
- sales_zone_code

### Rules
1. ลูกค้า 1 รายมี salesperson ได้หลายคน
2. region เป็นตัวกลางในการ assign salesperson อัตโนมัติ
3. credit_days ใช้เป็น default ใน invoice/sales ตาม policy
4. contact ที่ inactive ต้องมีกฎชัดว่าจะเลือกได้หรือไม่

### Use Case
**UC-MD-CONTACT-01**  
เมื่อเปลี่ยน region ของ contact ระบบต้องหา employee ทุกคนที่รับผิดชอบ region นี้แล้ว update salesperson_ids

### Test Cases
- region ตรงกับ 2 employee -> เติมได้ 2 คน
- ไม่มี region -> clear salesperson_ids
- region เปลี่ยน -> update ใหม่
- inactive contact -> block หรือเตือนตาม policy

---

## 6.3 Product Rule
### Required Fields
- sku
- name
- state
- sale_ok
- on_hand_qty
- reserved_qty
- available_qty
- packaging_qty

### Rules
1. state = active -> sale_ok ต้องเปิดได้
2. available_qty = on_hand_qty - reserved_qty
3. packaging_qty ใช้ใน CTN calculation
4. duplicate code import cleanup ต้องรักษาลำดับแถวเดิม

### Use Cases
**UC-MD-PROD-01** Product active -> sale_ok = true  
**UC-MD-PROD-02** duplicate cleanup ก่อน import  
**UC-MD-PROD-03** minimum stock ใช้ available_qty หรือ on_hand_qty ตาม policy

### Test Cases
- active -> sale_ok = true
- inactive -> behavior ตาม policy
- reserved=10 on_hand=100 -> available=90
- duplicate code cleanup occurrence แรกคงไว้ occurrence ถัดไป blank

---

## 6.4 SupplierInfo Rule
### Required Fields
- vendor_id
- product_id
- MOQ
- vendor_price
- vendor_sku
- notes

### Rules
1. MOQ ต้องอ่านจากคู่ vendor + product เท่านั้น
2. ถ้าไม่พบ supplier info -> line แสดงว่าง/0
3. ห้ามเดา MOQ จาก product master เดี่ยวๆ โดยไม่มี vendor context

### Use Case
**UC-MD-SUP-01** เลือก vendor + product ใน PO line แล้วระบบดึง MOQ มาอัตโนมัติ

### Test Cases
- พบ supplier info -> MOQ ถูกต้อง
- ไม่พบ -> 0 หรือ null ตาม policy
- vendor เปลี่ยน -> MOQ refresh ใหม่

---

# 7) Sales Rules

## 7.1 Sales Order Default Department Rule
### Inputs
- current user
- employee mapping
- employee.department_code

### Rule Logic
1. User กดสร้าง SO
2. ระบบหา employee จาก user
3. ถ้ามี department_code -> เติมใน SO
4. ถ้าไม่มี -> ว่าง
5. user สามารถแก้ได้เอง
6. การแก้ SO ไม่กระทบ employee

### Output
- sales_order.department_code

### Edge Cases
- user ไม่มี employee
- employee ไม่มี code
- employee ถูก deactivate

### Test Cases
- default ถูกใส่
- default ว่างแต่ยังบันทึกได้
- override แล้วไม่ย้อนแก้ต้นทาง

---

## 7.2 Stock Status on SO Rule
### Source Signals
- sales_order.state
- delivery existence
- delivery.done

### Business Labels
- Draft / Quotation -> ยังไม่จองสต็อก
- Sale Order -> จองสต็อกแล้ว
- Delivery Done -> ตัดสต็อกแล้ว

### Rules
1. user ห้ามพิมพ์สถานะเอง
2. ต้อง derive จาก state จริงเสมอ
3. ถ้ามีหลาย delivery ให้ define ว่าตัดสต็อกแล้วเมื่อ completed ตามเกณฑ์ใด

### Test Cases
- draft -> ยังไม่จอง
- sale + no done delivery -> จองแล้ว
- done delivery -> ตัดแล้ว
- partial delivery -> define ตาม policy (แนะนำ "จัดส่งบางส่วน" ถ้าจะขยาย)

---

## 7.3 Sales Lock Rule
### Trigger
- SO ถูกใช้งาน downstream แล้ว เช่น invoice created

### Rules
1. field สำคัญบางตัวต้อง readonly
2. หาก manager/admin override ต้องมี audit reason
3. lock based on downstream dependency ไม่ใช่แค่ state

### Test Cases
- SO draft -> editable
- SO invoiced -> locked fields
- admin override -> log reason

---

# 8) Contact / Customer Rules

## 8.1 Region-to-Salesperson Auto Assignment
### Input
- contact.region_id
- employee.region_ids

### Logic
1. เปลี่ยน region
2. หา employee ที่ดูแล region
3. update salesperson_ids
4. ถ้าไม่พบ -> clear หรือคงค่าตาม policy

### Output
- contact.salesperson_ids[]

### Test Cases
- region ตรงหลายคน -> fill หลายคน
- clear region -> clear salespersons
- change region -> replace correctly

---

## 8.2 Customer Credit Rule
### Logic
1. credit_days ใน contact ใช้เป็นค่า default ใน downstream transaction
2. transaction เก็บ snapshot
3. การแก้ transaction ไม่ย้อนแก้ contact

### Test Cases
- create invoice -> credit_days default ถูกต้อง
- override invoice credit -> contact เดิมไม่เปลี่ยน

---

# 9) Product / Inventory Rules

## 9.1 Product Active Rule
- ถ้า state = active -> sale_ok = true
- ถ้า state inactive -> sale_ok ตาม policy อาจ false

## 9.2 Inventory Availability Rule
### Formula
available_qty = on_hand_qty - reserved_qty

### Rules
1. UI ต้องแยกแสดง on_hand / reserved / available
2. minimum stock alert ต้อง define ชัดว่าอิงตัวไหน
3. ห้ามใช้ตัวเลขเดียวปนกันจน user สับสน

### Test Cases
- on_hand 50 reserved 20 -> available 30
- reserved > on_hand -> เตือน data integrity

## 9.3 Duplicate Import Cleanup Rule
### Logic
1. Scan top-down
2. first occurrence keep
3. next duplicates blank
4. preserve row order

### Test Cases
- A001, A002, A001 -> third row blank
- no reorder

---

# 10) Purchase Rules

## 10.1 Purchase Type Rule
### Types
- Local
- Foreign

### Rules
1. type มีผลต่อ sequence
2. type มีผลต่อ default tax mode
3. type อาจมีผลต่อ report template

### Test Cases
- local -> local sequence
- foreign -> foreign sequence
- foreign -> no-tax default (ถ้าธุรกิจใช้ policy นี้)

---

## 10.2 PR / PO Sequence Rule
### Input
- document_type
- purchase_type
- document_date

### Logic
1. เลือก bucket ตาม PR/PO
2. แยก sub-bucket ตาม local/foreign
3. apply format
4. increment running

### Example
- T-PO-2604-0001
- C-PR-2604-0007

### Test Cases
- PR local / PR foreign / PO local / PO foreign
- reset monthly/yearly ตาม config
- bucket ใหม่ถูกสร้างได้ถ้าจำเป็น

---

## 10.3 MOQ Autofill Rule
### Input
- vendor_id
- product_id

### Output
- po_line.moq

### Test Cases
- vendor+product found -> MOQ correct
- not found -> empty/0
- changing vendor refreshes MOQ

---

## 10.4 Purchase Status Sync Rule
PR / PO เปลี่ยน state แล้วต้องสะท้อนกลับต้นทางตาม workflow

### Example
- PR in_progress -> OrderRequest = ยืนยัน PR แล้ว

### Test Cases
- state mapping works
- cancel flows sync back correctly

---

# 11) Shipping / Logistics Rules

## 11.1 Shipping State Mapping Rule
### Technical States
- New
- Process
- Confirm

### Business Labels
- New + has DO -> รอการจัดส่ง
- Process -> อยู่ระหว่างการจัดส่ง
- Confirm -> จัดส่งสำเร็จ

### Output Target
- source document.delivery_status

### Test Cases
- shipping process -> source updated
- shipping confirm -> source success label
- no source -> system must not crash

---

## 11.2 Route Process Rule
### Inputs
- company lat/lng
- destination lat/lng
- route type

### Logic
1. กด Process
2. state = process
3. calculate distance
4. outbound sort near->far
5. inbound sort far->near
6. unknown last
7. assign seq
8. reorder lines

### Test Cases
- outbound 3 stops -> sorted correctly
- inbound sorted reverse logic
- missing coordinates -> unknown last

---

## 11.3 Shipping Bill Creation Rule
### Logic
1. shipping ready
2. user clicks create bill
3. system validates required data
4. create related bill
5. link back to shipping

### Test Cases
- complete shipping -> bill created
- missing required fields -> fail loud
- duplicate create -> prevented or idempotent

---

# 12) Accounting / Invoice / Billing Rules

## 12.1 Invoice Sequence by Department Rule
### Inputs
- move_type
- state
- current name
- department_code
- date
- journal / x_type override

### Logic
1. out_invoice only
2. only when draft / before finalize
3. only when name still placeholder
4. resolve department_code
5. check x_type override (e.g. de -> OD)
6. select sequence bucket
7. generate number

### Examples
- K6903/0009
- OD6903/0013

### Test Cases
- normal dept K
- dept M
- x_type=de -> OD
- reset period correct
- no department -> fallback rule defined

---

## 12.2 Billing Deduplication Rule
### Objective
Invoice 1 ใบห้ามถูกใช้ซ้ำใน billing

### Logic
1. user selects invoice
2. system checks billing link
3. linked -> block
4. unlinked -> allow

### Test Cases
- linked invoice blocked
- after unlink -> policy-defined behavior
- duplicate manual insert blocked

---

## 12.3 Outstanding / VAT Rule
### Store Separately
- untaxed_amount
- vat_amount
- total_amount
- paid_amount
- outstanding_amount

### Rules
1. UI/export ต้องระบุชัดว่ารวม VAT หรือไม่
2. ห้ามใช้ฟิลด์เดียวตีความหลายแบบ
3. ถ้า import/export ต้อง map field ตาม semantics ชัดเจน

### Test Cases
- total = untaxed + vat
- outstanding after payment correct
- export labels correct

---

## 12.4 Credit Note Rule
### Types
- VAT credit note
- non-VAT credit note

### Rules
1. prefix แยกกันได้ เช่น VCN / NCN
2. classification ต้องอิง source/tax relation ตาม policy

### Test Cases
- VAT path -> VCN
- no VAT path -> NCN

---

## 12.5 Withholding Tax Rule
### Requirements
- separate by withholding account category
- support report/filter by date
- exportable for tax operations

### Test Cases
- filter by date works
- grouped correctly by withholding type
- export totals match source entries

---

# 13) Document Management Rules

## 13.1 Internal Document Rule
### Fields
- doc_no
- doc_type
- doc_date
- partner
- project
- tag_ids
- attachments[]

### Rules
1. many attachments supported
2. sequence by doc_type
3. reset yearly
4. relation to partner/project optional but supported
5. kanban must remain clickable and useful

### Test Cases
- create document with type -> doc_no generated
- new year -> reset bucket
- multi attachments stored
- kanban opens detail

---

## 13.2 Document Sequence Rule
### Example
- LIC-2026-0008

### Test Cases
- same year increments
- next year resets
- different type different bucket

---

# 14) Reporting / Print / QWeb Rules

## 14.1 Reporting Scope
ระบบต้องรองรับ:
- Quotation
- Service Quotation
- Proforma Invoice
- Commercial Invoice
- Packing List
- custom header/footer

## 14.2 Report Rendering Rule
Report คือ derived output ไม่ใช่ source of truth

### Rules
1. data ต้องมาจาก transaction/master ที่ชัด
2. calculation in report ต้อง deterministic
3. summary block last page only (ถ้ากำหนด)
4. raw data ต้อง trace กลับได้

---

## 14.3 Currency Conversion Rule
### Inputs
- source currency
- target currency
- exchange rate source
- special flags เช่น freight already in USD

### Logic
1. ถ้า target report เป็น USD และ source != USD -> convert
2. ถ้า field บางตัวเป็น USD อยู่แล้ว -> do not convert again
3. rate source ต้องชัด (system/custom field)

### Test Cases
- CNY -> USD converted
- freight already USD not double-converted
- missing rate -> fail/flag according to policy

---

## 14.4 CTN Calculation Rule
### Formula
CTN = total_qty / packaging_qty

### Test Cases
- 240 / 24 = 10
- packaging 0/null -> guarded behavior
- rounding rule documented

---

## 14.5 Charge Allocation Rule
### Objective
กระจาย charge กลางไปยัง line สินค้าตามสัดส่วน

### Logic
1. identify charge line
2. sum normal lines
3. ratio by line amount
4. distribute charge
5. validate totals

### Test Cases
- A=100, B=300, charge=40 -> A+10, B+30
- total preserved
- zero-sum edge case guarded

---

## 14.6 Last Page Summary Rule
### Rules
- non-last page -> lines only
- last page -> lines + totals + signature

### Test Cases
- 26 lines with MAX_ROWS 15 -> page1 no summary, page2 summary shown
- exact-fit page still behaves correctly

---

# 15) Import / Export / Data Migration Rules

## 15.1 Preserve Column Template Rule
### Rules
1. ห้ามเพิ่ม/ลบ/สลับคอลัมน์
2. ช่องไม่มีข้อมูลให้เว้นว่าง
3. mapping ต้องคง template เดิม

### Test Cases
- import template remains exact
- blank cells preserved
- order not changed

## 15.2 Preserve Row Order Rule
### Rules
1. ถ้า requirement ระบุให้คง row order ต้องห้าม sort
2. duplicate cleanup blank only ไม่ shift rows

### Test Cases
- rows remain in same positions
- no accidental reorder

## 15.3 Export Reliability Rule
- export fields must match semantic meaning
- totals must trace to source fields
- report/export labels must be unambiguous

---

# 16) Approval / Automation / Status Sync Rules

## 16.1 Automation Principle
workflow automation ต้อง event-driven และอธิบายได้

### Required Trigger Types
- onCreate
- onUpdate
- onBeforeSave
- onAfterSave
- onConfirm
- onValidate
- onCancel
- onStateChanged

---

## 16.2 Sync Status Rule
เอกสาร downstream เปลี่ยน state แล้วต้อง sync กลับ upstream ตาม business mapping

### Test Cases
- shipping -> SO delivery status
- PR/PO -> order request status
- cancel path reflected back

---

## 16.3 No Silent Mutation Rule
automation ที่เปลี่ยนหลายโมดูลต้องมี audit/log เสมอ

---

## 16.4 Idempotency Rule
trigger สำคัญต้องรันซ้ำแล้วไม่ทำข้อมูลเพี้ยน

### Test Cases
- click sync twice -> no duplicate records
- retry action -> same final state

---

# 17) Authentication / Security / Session Rules

## 17.1 Logout Guardian Rule
### Objective
ถ้า session ถูก revoke ระหว่างใช้งาน ต้อง redirect user ออกจาก protected UI อัตโนมัติ

### Logic
1. provider tracks previous status
2. trigger on authenticated -> unauthenticated transition
3. skip while loading
4. skip public routes
5. log auth_transition_recovery
6. redirect to /login exactly once

### Test Cases
- logout all in another tab -> current tab redirected after poll
- cookie deleted manually -> redirected
- on login page -> no redirect loop
- repeated polling -> one redirect only

---

## 17.2 Protected Route Awareness Rule
public routes เช่น:
- /login
- /register
- /forgot-password
- /onboarding (if public by policy)

### Rules
- guardian only redirects protected routes
- no loop on public routes

---

## 17.3 Active Session Management Rule (recommended if implemented)
- show active sessions
- logout all other devices
- revoke tokens globally using versioning/session version
- keep audit trail

### Test Cases
- current session retained or excluded by choice
- other sessions revoked
- revoked tab redirected by guardian

---

# 18) Hardening / Observability / Governance Rules

## 18.1 SafeBoundary Variant Rule
### Variants
- silent: non-essential shell slot
- compact: actionable widget
- inline: small label / inline info

### Rule
choose fallback by user expectation:
- user will be confused if disappears -> compact
- harmless decorative slot -> silent

### Test Cases
- widget crash -> compact shown
- sidebar nonessential slot -> hidden
- no whole-page collapse

---

## 18.2 Event Taxonomy Rule
### Event Types
- boundary_recovery
- fallback_contract
- auth_transition_recovery
- simulation_started (if harness exists)

### Rules
- each type has required metadata schema
- logs must be structured and queryable
- avoid raw unstructured strings only

---

## 18.3 Fallback Contract Rule
UI convenience reads may return safe default shapes:
- [] for arrays
- 0 for counts
- {} or explicit empty structure for objects

### But
critical mutations must fail loud

### Test Cases
- malformed notifications -> []
- malformed count -> 0
- invoice create mutation failure -> error visible

---

## 18.4 Health Dashboard Rule
Admin-only operational page should show:
- total boundary recoveries
- total fallback contracts
- top failing sources
- recent events

### Test Cases
- grouped by type correctly
- recent events visible
- admin gate enforced

---

## 18.5 Build Noise Filter Rule
expected Next.js dynamic server usage noise may be filtered precisely  
but real errors must remain visible

### Test Cases
- dynamic server usage suppressed
- intentional real ReferenceError still logged

---

## 18.6 Governance Rule
ต้องมีเอกสารอย่างน้อย:
- TAXONOMY
- UX_MATRIX
- RELEASE_GATE
- HARDENING_STANDARD

---

# 19) Use Case Catalog (Condensed Index)

| ID | Use Case | Module |
|---|---|---|
| UC-MD-EMP-01 | ดึง department จาก Employee | Master/Sales |
| UC-MD-CONTACT-01 | assign salesperson ตาม region | Contact |
| UC-MD-PROD-01 | active -> sale_ok | Product |
| UC-MD-SUP-01 | ดึง MOQ จาก Supplier Info | Purchase |
| UC-SALES-01 | สร้าง SO พร้อม default department | Sales |
| UC-SALES-02 | คำนวณ stock status | Sales |
| UC-SALES-03 | lock SO เมื่อ downstream exists | Sales |
| UC-PUR-01 | สร้าง PR/PO ตาม type + sequence | Purchase |
| UC-PUR-02 | sync PR/PO status กลับต้นทาง | Purchase |
| UC-SHIP-01 | shipping state sync back | Shipping |
| UC-SHIP-02 | process route sorting | Shipping |
| UC-ACC-01 | รัน invoice ตาม department | Accounting |
| UC-ACC-02 | override OD เมื่อ x_type=de | Accounting |
| UC-ACC-03 | กันดึง billing ซ้ำ | Billing |
| UC-DOC-01 | สร้าง document ภายในพร้อม running no. | Document |
| UC-REP-01 | convert currency ใน report | Reporting |
| UC-REP-02 | คำนวณ CTN | Reporting |
| UC-REP-03 | allocate charge | Reporting |
| UC-SEC-01 | Logout Guardian redirect | Security |
| UC-OBS-01 | SafeBoundary recovery log | Hardening |
| UC-OBS-02 | health dashboard query | Observability |

---

# 20) Test Case Catalog (Representative)

## 20.1 Sales
- TC-SALES-01 create SO with employee mapping
- TC-SALES-02 create SO no employee mapping
- TC-SALES-03 stock status draft
- TC-SALES-04 stock status sale
- TC-SALES-05 stock status delivery done
- TC-SALES-06 lock fields after invoice

## 20.2 Contact
- TC-CON-01 assign salesperson by region
- TC-CON-02 clear region clears salespersons
- TC-CON-03 multi-region employee assign works

## 20.3 Product / Inventory
- TC-PROD-01 active -> sale_ok
- TC-PROD-02 available_qty formula
- TC-PROD-03 duplicate import cleanup preserves order

## 20.4 Purchase
- TC-PUR-01 PR local sequence
- TC-PUR-02 PO foreign sequence
- TC-PUR-03 MOQ found
- TC-PUR-04 MOQ missing
- TC-PUR-05 status sync

## 20.5 Shipping
- TC-SHIP-01 state process sync
- TC-SHIP-02 confirm sync
- TC-SHIP-03 route outbound sort
- TC-SHIP-04 route inbound sort
- TC-SHIP-05 missing coordinates guard

## 20.6 Accounting
- TC-ACC-01 invoice dept sequence
- TC-ACC-02 OD override
- TC-ACC-03 billing dedup block
- TC-ACC-04 outstanding calculation
- TC-ACC-05 credit note type mapping

## 20.7 Reporting
- TC-REP-01 currency conversion
- TC-REP-02 freight no double convert
- TC-REP-03 CTN compute
- TC-REP-04 charge allocation preserve totals
- TC-REP-05 last page summary

## 20.8 Security / Hardening
- TC-SEC-01 logout all second tab redirect
- TC-SEC-02 manual cookie delete redirect
- TC-SEC-03 no redirect loop on login
- TC-HARD-01 widget crash compact fallback
- TC-HARD-02 malformed payload fallback contract
- TC-HARD-03 audit large snapshot truncation
- TC-HARD-04 dynamic server usage filtered, real errors visible

---

# 21) Suggested Build Order

## Phase A: Master Data
- Employee
- Contact
- Product
- Region / Province
- SupplierInfo
- Department Code

## Phase B: Core Transactions
- Sales Order
- Purchase Request / Order
- Invoice
- Shipping
- Document

## Phase C: Sequence Engine
- PR/PO sequence
- Invoice sequence
- Document sequence
- Shipping sequence

## Phase D: Workflow Engine
- status sync
- stock status
- delivery status
- billing dedup
- locks

## Phase E: Reports
- quotation
- commercial/proforma invoice
- packing list
- service quotation

## Phase F: Security / Hardening
- auth guardian
- safe boundary
- telemetry
- health dashboard

## Phase G: QA / Governance
- release gate
- hardening standard
- use case / test case docs
- harness (optional later)

---

# 22) Known Constraints / Intentional Scope Limits
1. เอกสารนี้อธิบายจาก reverse-spec และ pattern ที่เคยทำร่วมกัน ไม่ใช่ source dump ตรง
2. Audit diff v1 ยังไม่ครอบคลุม nested deep diff ทั้งหมด
3. in-memory throttle ไม่ใช่ distributed dedupe
4. health dashboard เป็น app-level observability ไม่ใช่ infra monitoring เต็มรูปแบบ
5. resilience test harness เป็น optional extension และควรเปิดเฉพาะ internal/admin

---

# Closing Summary
ถ้าจะ clone ระบบนี้ให้ใกล้ของเดิมที่สุด ต้องสร้าง “พฤติกรรม” เหล่านี้ให้ตรง:
- snapshot defaulting
- sequence separation
- status synchronization
- report calculation rules
- downstream locking
- auditability
- hardening / recovery / observability

ระบบนี้ไม่ใช่ CRUD ERP ธรรมดา แต่เป็น ERP เชิง operation ที่เชื่อมหลายฝ่ายและเน้น reliability จริง
