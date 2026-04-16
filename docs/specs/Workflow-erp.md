# Workflow-erp.md
เอกสาร Workflow & Execution Blueprint สำหรับระบบ ERP ฉบับ Reverse-Spec  
เน้นลำดับการไหลของงานจริง, actor, trigger, input/output, use case flow, state transition และ test scenario

> ใช้คู่กับ `Rule-erp.md`  
> `Rule-erp.md` = กฎของระบบ  
> `Workflow-erp.md` = ลำดับการทำงานของระบบ

---

# สารบัญ
1. วัตถุประสงค์
2. แนวคิดของ Workflow
3. Global State Flow
4. Master Data Workflow
5. Sales Workflow
6. Inventory / Delivery Workflow
7. Contact / Assignment Workflow
8. Purchase Workflow
9. Shipping Workflow
10. Accounting / Billing Workflow
11. Document Workflow
12. Reporting Workflow
13. Security / Session Workflow
14. Hardening / Observability Workflow
15. Verification Workflow
16. Workflow Use Cases แบบละเอียด
17. Workflow Test Scenarios
18. Suggested Technical Mapping

---

# 1) วัตถุประสงค์
เอกสารนี้อธิบาย “งานไหลยังไง” ตั้งแต่จุดเริ่มจนจบใน ERP  
โดยเน้น:
- Trigger
- Main Flow
- Alternative Flow
- Exception Flow
- State Transition
- Downstream / Upstream Sync
- Expected UX Recovery
- QA/UAT validation point

---

# 2) แนวคิดของ Workflow
ERP นี้ทำงานแบบ event-driven business flow

ทุก workflow มักมี 6 ขั้น:
1. Read master/default
2. Validate inputs
3. Save draft/snapshot
4. Transition state
5. Create or sync downstream artifact
6. Audit / log / recover

---

# 3) Global State Flow

Master Data Setup
-> Transaction Draft
-> Confirm / Approve
-> Downstream Execution
-> Accounting / Billing / Reporting
-> Audit / Health / Recovery

### Core Principle
- Draft = editable zone
- Confirmed = guarded zone
- Downstream linked = partial lock zone
- Posted / final = strict control zone

---

# 4) Master Data Workflow

## 4.1 Employee Setup Workflow
### Goal
สร้าง employee ให้พร้อมเป็น source ของ defaults

### Main Flow
1. Admin/HR สร้าง employee
2. ผูก employee กับ user
3. กำหนด department_code
4. กำหนด region_ids
5. บันทึก

### Output
employee พร้อมใช้กับ SO/Invoice/Assignment

### Exceptions
- ไม่มี user mapping -> ใช้ใน transaction default ไม่ได้
- ไม่มี department_code -> downstream field จะว่าง

### Test
- create complete employee -> usable in SO
- create employee without code -> SO default blank, no crash

---

## 4.2 Contact Setup Workflow
### Goal
สร้างลูกค้า/ผู้ขายที่พร้อมใช้ในหลายโมดูล

### Main Flow
1. สร้าง contact
2. กรอกข้อมูลพื้นฐาน
3. เลือก province / region
4. ระบบหา salesperson ตาม region
5. เติม salesperson_ids
6. save

### Alternative Flow
- region ไม่ถูกเลือก -> salesperson_ids ว่าง
- region ถูกเปลี่ยนภายหลัง -> recalculate assignment

### Outputs
- contact master usable in sales/billing/shipping

---

## 4.3 Product Setup Workflow
### Goal
เตรียมสินค้าพร้อมซื้อ/ขาย/คำนวณรายงาน

### Main Flow
1. สร้าง product
2. ใส่ sku / name / state
3. ถ้า state = active -> sale_ok true
4. ใส่ packaging_qty
5. บันทึก

### Outputs
- product usable across modules

### Edge Cases
- packaging_qty missing -> CTN report fallback / guard
- duplicate sku in import path -> cleanup flow required

---

## 4.4 Supplier Info Setup Workflow
### Goal
เก็บข้อมูล vendor-specific

### Main Flow
1. เลือก vendor
2. เลือก product
3. กรอก MOQ / vendor price
4. save

### Output
- PO line autofill source ready

---

# 5) Sales Workflow

## 5.1 Create Sales Order
### Actor
Staff / Sales

### Preconditions
- user login
- customer exists
- employee mapping optional but recommended

### Main Flow
1. เปิดหน้า Create SO
2. ระบบหา employee จาก current user
3. เติม default department_code
4. user เลือกลูกค้า
5. user เพิ่ม line items
6. validate required fields
7. save as draft

### Output
- sales order draft

### Alternative Flow
- ไม่มี employee -> create ได้แต่ default blank
- ไม่มีลูกค้า -> save blocked
- ไม่มี line item -> block ตาม policy

### Audit
- create event
- default source may be traceable if needed

### UI Expectation
- no crash even when employee mapping missing

---

## 5.2 Confirm Sales Order
### Trigger
user clicks Confirm

### Main Flow
1. validate SO completeness
2. change state = sale
3. derive stock status = จองสต็อกแล้ว
4. make delivery flow eligible

### Outputs
- SO sale state
- stock status updated
- downstream delivery possible

### Exception Flow
- missing required data -> fail loud
- inventory policy conflict -> warn/fail based on rules

---

## 5.3 Sales Order Downstream Lock
### Trigger
invoice or downstream documents linked

### Main Flow
1. detect downstream dependency
2. lock fields defined by business policy
3. if override by privileged user -> require reason + audit

### Output
- protected fields readonly
- edit discipline increased

---

# 6) Inventory / Delivery Workflow

## 6.1 SO Stock Status Derivation
### Flow
SO Draft -> ยังไม่จองสต็อก
SO Confirmed -> จองสต็อกแล้ว
Delivery Done -> ตัดสต็อกแล้ว

### Data Sources
- SO state
- delivery status

### Test Points
- no manual typing
- reflects current state accurately

---

## 6.2 Delivery Validation Workflow
### Main Flow
1. delivery created from SO
2. picking / preparation occurs
3. user validates delivery
4. delivery = done
5. SO stock status updates to ตัดสต็อกแล้ว

### Output
- delivery final
- SO updated

### Exception Flow
- validation blocked due to missing stock / data
- partial delivery behavior according to policy

---

# 7) Contact / Assignment Workflow

## 7.1 Region-to-Salesperson Assignment
### Trigger
contact.region changes

### Main Flow
1. region changed
2. system queries employee where region matches
3. update salesperson_ids
4. save contact

### Alternative Flow
- region blank -> clear list
- no employee found -> empty assignment

### Output
- contact has auto-assigned salespersons

### Test Points
- supports multiple employees
- clear region clears assignment

---

# 8) Purchase Workflow

## 8.1 Create PR / PO
### Actor
Purchase staff

### Main Flow
1. user creates PR or PO
2. selects document type
3. selects purchase type local/foreign
4. system chooses sequence bucket
5. system generates doc no.
6. save draft

### Output
- PR/PO draft with correct number

### Alternative Flow
- sequence bucket missing -> auto-create or fail according to config
- purchase type not chosen -> block or default

---

## 8.2 Add PO Line with MOQ Autofill
### Main Flow
1. user selects vendor
2. user selects product
3. system queries supplier info
4. fill moq
5. user enters qty/price
6. save line

### Output
- PO line contains MOQ context

### Exception Flow
- supplier info missing -> no MOQ but no crash
- vendor change -> line may need refresh/revalidation

---

## 8.3 Purchase Approval / Status Sync
### Trigger
PR/PO state changes

### Main Flow
1. PR/PO state transitions
2. workflow engine maps to business status
3. source document updated (e.g. Order Request)
4. audit record written

### Example
- PR in_progress -> Order Request = ยืนยัน PR แล้ว

### Output
- upstream status consistent

---

# 9) Shipping Workflow

## 9.1 Shipping Creation / Progress
### Main Flow
1. shipping record created
2. source link stored
3. state starts as New
4. if DO exists -> business label = รอการจัดส่ง
5. move to Process / Confirm through operations

---

## 9.2 Shipping State Sync Back
### Trigger
shipping.state changes

### Main Flow
1. detect new state
2. map state to business label
3. update source document delivery_status
4. log sync event

### State Mapping
- New + DO -> รอการจัดส่ง
- Process -> อยู่ระหว่างการจัดส่ง
- Confirm -> จัดส่งสำเร็จ

### Exception Flow
- source missing -> log warning, no crash

---

## 9.3 Route Process & Sorting
### Actor
Logistics / Dispatcher

### Main Flow
1. click Process Route
2. state = process
3. calculate distance from company to each stop
4. sort:
   - outbound = near -> far
   - inbound = far -> near
   - unknown = last
5. assign x_seq
6. reorder lines

### Outputs
- route lines in operational order

### Exception Flow
- missing coords -> unknown bucket
- invalid coordinates -> log and place last

---

## 9.4 Create Bill from Shipping
### Main Flow
1. shipping ready
2. click Create Bill
3. validate shipping completeness
4. create bill
5. link bill back
6. prevent duplicate bill creation if policy requires

### Outputs
- shipping-linked bill

---

# 10) Accounting / Billing Workflow

## 10.1 Create Invoice
### Main Flow
1. user creates invoice / system generates from source
2. validate move_type
3. resolve department_code
4. resolve override prefix if any (e.g. x_type=de => OD)
5. pick sequence bucket
6. generate invoice no.
7. save draft

### Output
- invoice draft with correct number

### Exception Flow
- no department resolved -> fallback rule or fail
- sequence missing -> bucket creation or error

---

## 10.2 Post Invoice
### Main Flow
1. user posts/confirm invoice
2. critical validations run
3. lock critical fields
4. invoice becomes final/accounting-relevant
5. report/export can rely on final values

### Output
- posted invoice
- mutation discipline increased

---

## 10.3 Billing Link Flow
### Main Flow
1. billing operator selects invoice(s)
2. system checks if invoice already linked
3. if linked -> block
4. if unlinked -> allow
5. link billing relation

### Output
- no duplicate billing

### Test
- duplicate invoice selection blocked

---

## 10.4 Credit Note Classification Flow
### Main Flow
1. determine note type context
2. choose VAT/non-VAT classification
3. select prefix bucket
4. generate number
5. save note

---

# 11) Document Workflow

## 11.1 Create Internal Document
### Actor
Staff / Admin

### Main Flow
1. user clicks create document
2. chooses document type
3. system selects yearly bucket
4. generates doc no.
5. user attaches files
6. user links partner/project/tags
7. save

### Output
- document record with sequence + attachments

### Exception Flow
- missing type -> block
- attachment optional/required per policy

---

## 11.2 Document Kanban Interaction
### Main Flow
1. show documents as cards
2. display minimal useful metadata
3. click card to open detail
4. optional quick actions available

### UX Rules
- card must remain usable
- not overloaded with noisy data

---

# 12) Reporting Workflow

## 12.1 Print Business Document
### Main Flow
1. user opens transaction
2. clicks Print
3. system gathers source data
4. report service performs calculations
5. page model built
6. template rendered

### Output
- print-ready business document

---

## 12.2 Currency Conversion Workflow
### Main Flow
1. report requires target currency
2. detect source currency
3. fetch rate
4. convert fields needing conversion
5. skip fields already in target currency
6. render

### Exception Flow
- missing rate -> warning/fail according to policy

---

## 12.3 CTN Workflow
### Main Flow
1. read total qty
2. read packaging qty
3. compute CTN
4. render value

### Edge Cases
- packaging qty 0/null -> fallback text or no value

---

## 12.4 Charge Allocation Workflow
### Main Flow
1. identify charge line
2. sum normal lines
3. compute allocation ratios
4. distribute charge
5. validate final sum
6. render adjusted values

---

## 12.5 Last Page Summary Workflow
### Main Flow
1. calculate total pages from line count and max rows
2. render each page
3. on non-last pages: lines/filler only
4. on last page: lines + summary + signature

### Output
- professional document layout

---

# 13) Security / Session Workflow

## 13.1 Login State Consumption Workflow
### Main Principle
provider must expose explicit status:
- loading
- authenticated
- unauthenticated

Components must not infer auth state from array emptiness alone.

---

## 13.2 Logout Guardian Workflow
### Goal
handle remote session revoke gracefully

### Main Flow
1. user is on protected page
2. provider polls / checks current auth state
3. previous status = authenticated
4. current status = unauthenticated
5. confirm route is protected
6. log auth_transition_recovery
7. hard redirect to /login
8. prevent repeated redirect

### Output
- no half-dead UI
- user removed from protected route

### Non-Trigger Cases
- initial unauthenticated load on public route
- loading state
- already on login

---

## 13.3 Active Session Management Workflow (if implemented)
### Main Flow
1. user opens session settings
2. sees active sessions/devices
3. clicks logout all other devices
4. session version / token version updates
5. other tabs/devices invalidated
6. guardian redirects them after next check

---

# 14) Hardening / Observability Workflow

## 14.1 Contract Hardening Flow
### Goal
UI reads survive malformed data

### Flow
1. server action runs
2. if auxiliary read fails/malformed -> safe default shape returned
3. client state normalizes
4. render uses safe values
5. telemetry logs fallback_contract when needed

### Output
- widget survives contract anomaly

---

## 14.2 SafeBoundary Recovery Flow
### Goal
component crash must not collapse shell

### Flow
1. widget throws error
2. nearest SafeBoundary catches
3. fallback variant selected:
   - silent / compact / inline
4. boundary_recovery logged
5. rest of page continues working

### Output
- graceful degradation

---

## 14.3 Health Dashboard Workflow
### Actor
Admin

### Main Flow
1. open /system/health
2. query structured events
3. aggregate by taxonomy
4. show:
   - counts
   - top failing sources
   - recent events
5. use results to prioritize fixes

### Output
- operational insight

---

## 14.4 Build Stabilization Workflow
### Goal
remove noisy fake build logs but preserve real errors

### Main Flow
1. server action catches error during build/SSG
2. utility checks if error is expected Next dynamic server control-flow
3. if yes -> suppress noisy log
4. if no -> log real error
5. build output remains clean and truthful

### Output
- cleaner build logs
- higher developer trust

---

# 15) Verification Workflow

## 15.1 Verification Run Principle
หลัง implement feature/hardening ต้องมี verification evidence  
ไม่ใช่แค่ build pass

### Evidence Types
- screenshots
- event logs
- pass/fail table
- recent event query
- route behavior confirmation

---

## 15.2 Required Verification Scenarios
### A. Logout Guardian
- two-tab revoke
- natural session expiry

### B. SafeBoundary
- widget crash
- shell remains

### C. Contract Failure
- malformed list -> []
- malformed count -> 0

### D. Audit Large Snapshot
- 100k payload
- truncation message
- browser stays responsive

### E. Build Transparency
- expected dynamic noise filtered
- real error still visible

---

# 16) Workflow Use Cases แบบละเอียด

## UC-WF-01 Create Sales Order
### Actor
Sales Staff

### Trigger
Create SO

### Preconditions
- logged in
- customer exists

### Main Flow
1. open form
2. system loads employee-derived defaults
3. user inputs customer and lines
4. validate
5. save draft

### Alternative Flow
- no employee mapping -> continue without default
- missing required fields -> block save

### Postconditions
- SO draft exists
- default department snapshot stored

---

## UC-WF-02 Confirm Sales Order
### Trigger
Confirm click

### Main Flow
1. validate
2. state -> sale
3. stock status -> reserved label
4. downstream delivery enabled

### Postconditions
- SO active in operation
- stock status derived

---

## UC-WF-03 Auto Assign Salesperson by Region
### Trigger
region change

### Main Flow
1. detect region change
2. query matching employees
3. update salesperson_ids

### Postconditions
- contact reflects regional ownership

---

## UC-WF-04 Create PO with Sequence and MOQ
### Trigger
Create PO + select type + add lines

### Main Flow
1. choose local/foreign
2. generate document no.
3. choose vendor
4. choose product
5. fill MOQ
6. save draft

### Postconditions
- PO has doc no.
- lines are context-aware

---

## UC-WF-05 Shipping Sync Back
### Trigger
shipping state change

### Main Flow
1. map state
2. update source delivery status
3. log sync

### Postconditions
- source document displays current shipping stage

---

## UC-WF-06 Invoice Generation with Department Sequence
### Trigger
create invoice

### Main Flow
1. resolve dept code
2. check overrides
3. choose bucket
4. generate name
5. save

### Postconditions
- invoice name consistent with business policy

---

## UC-WF-07 Billing Duplicate Prevention
### Trigger
select invoice for billing

### Main Flow
1. check link
2. if linked -> block
3. else allow

### Postconditions
- invoice reused safely

---

## UC-WF-08 Logout Guardian
### Trigger
auth transition from authenticated to unauthenticated

### Main Flow
1. previous status known
2. new status unauthenticated
3. route protected
4. log event
5. redirect to login once

### Postconditions
- no stale protected UI remains

---

## UC-WF-09 SafeBoundary Recovery
### Trigger
component render error

### Main Flow
1. boundary catches
2. fallback variant rendered
3. boundary_recovery logged
4. rest of shell survives

### Postconditions
- isolated failure

---

# 17) Workflow Test Scenarios

## Sales
- create SO with employee default
- create SO without employee
- confirm SO
- create downstream invoice then lock SO

## Contact
- assign by region
- remove region
- change region repeatedly

## Purchase
- create local PR/PO
- create foreign PR/PO
- MOQ fetch success/failure
- status sync

## Shipping
- create shipping
- move to process
- confirm
- route sort with mixed coords

## Accounting
- invoice K sequence
- invoice OD override
- billing duplicate block
- outstanding logic

## Reporting
- convert currency
- CTN from packaging
- charge allocation
- summary only on last page
- large snapshot raw preview truncation

## Security / Hardening
- logout all two tabs
- manual session cookie delete
- widget crash compact fallback
- fallback_contract logs
- build noise filter
- health page shows structured events

---

# 18) Suggested Technical Mapping

## Service Layers
- employeeDefaultsService
- contactAssignmentService
- inventoryAvailabilityService
- purchaseSequenceService
- invoiceNumberService
- shippingSyncService
- reportCalculationService
- workflowSyncService
- authGuardianService
- hardeningTelemetryService

## UI / Client Concerns
- guarded widget rendering
- safe value formatting
- status-based permission context
- compact/silent fallback variants

## Data / Repositories
- employee repository
- contact repository
- supplier info repository
- sequence bucket repository
- invoice/billing link repository
- system event repository

## Event Types
- create/update/confirm/cancel
- fallback_contract
- boundary_recovery
- auth_transition_recovery

---

# Closing Summary
ระบบ ERP นี้ต้องถูก implement แบบ “รักษา behavior” มากกว่า “ลอกหน้าจอ”  
สิ่งที่ต้อง clone ให้ใกล้ที่สุดคือ:

1. วิธีดึง default จาก master เข้าสู่ transaction
2. วิธีรันเลขเอกสารแบบแยก bucket
3. วิธี sync สถานะข้ามโมดูล
4. วิธีคำนวณใน report
5. วิธี lock ข้อมูลเมื่อมี downstream dependency
6. วิธี recover จาก auth / data / UI failures
7. วิธีเก็บหลักฐานผ่าน audit / telemetry / health

ถ้าทำตาม Rule-erp.md + Workflow-erp.md คู่กัน จะได้ระบบใหม่ที่พฤติกรรมใกล้ของเดิมมากและพร้อมเอาไปแตกต่อเป็น implementation จริง
