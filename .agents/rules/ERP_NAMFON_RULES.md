# 🛡️ ERP-Namfon Master Business Rules

เอกสารฉบับนี้คือ **"Business Rule Registry"** ที่รวบรวมเงื่อนไขและ Logic ทางธุรกิจทั้งหมดของระบบ ERP-Namfon เพื่อใช้เป็นมาตรฐานในการพัฒนา (Single Source of Logic)

---

## 📦 1. Sales & POS Management

### Use Case 1: ดึงข้อมูลแผนกจาก Employee มาใส่ใน SO
*   **เป้าหมาย**: เมื่อพนักงานขายเปิดใบ Sales Order ระบบต้องเติมค่าแผนกอัตโนมัติจากข้อมูลพนักงาน
*   **Input**: `userId` (RequestContext), `Employee.x_product_department_code`
*   **Logic**:
    1.  ค้นหา Employee ที่ผูกกับ User ปัจจุบัน
    2.  ถ้ามี `department_code` -> Set เป็นค่า Default บน SO
    3.  อนุญาตให้แก้บน SO ได้โดยไม่กระทบข้อมูล Employee (Snapshot pattern)
*   **Output**: `Sale.departmentCode` ถูกเติมอัตโนมัติ
*   **ตัวอย่าง**: Sale A (Dept: K) สร้าง SO -> ระบบใส่ Dept: K ใน SO ทันที

### Use Case 2: สถานะจองสต็อกบน SO
*   **เป้าหมาย**: ตรวจสอบสถานะสต็อกในระดับ SO ได้ทันที
*   **Input**: `Sale.status`, `Shipment.status`
*   **Logic**:
    1.  `DRAFT` -> "ยังไม่จองสต็อก"
    2.  `CONFIRMED` / `INVOICED` (แต่ยังไม่ส่ง) -> "จองสต็อกแล้ว"
    3.  `Shipment.status === DELIVERED` -> "ตัดสต็อกแล้ว"
*   **Output**: `Sale.stockStatus` (Virtual field)
*   **ตัวอย่าง**: กดยืนยัน SO -> สถานะเปลี่ยนเป็น "จองสต็อกแล้ว" ทันที

---

## 🤝 2. Contact & CRM

### Use Case 3: ดึง Salesperson ตาม Region อัตโนมัติ
*   **เป้าหมาย**: กำหนดทีมขายตามภูมิภาคของลูกค้า
*   **Input**: `Customer.region`, `Employee.region_ids`
*   **Logic**:
    1.  เมื่อเลือก Region ในหน้า Contact
    2.  ระบบ Lookup หา Employee ที่ดูแล Region นั้น (Many-to-Many)
    3.  Update รายชื่อใน `Customer.salesperson_ids`
*   **Output**: รายชื่อ Salesperson ถูกเติมอัตโนมัติ
*   **ตัวอย่าง**: เลือก "ภาคเหนือ" -> ระบบดึง Sale ที่ดูแลภาคเหนือมาแสดง

### Use Case 12: Contact Import Template
*   **เป้าหมาย**: รักษาโครงสร้างไฟล์ Import ให้คงเดิม 100%
*   **Input**: Excel File (Standard Columns)
*   **Logic**: ห้ามสลับ/เพิ่ม/ลดคอลัมน์, รักษาลำดับข้อมูลเดิม, ช่องว่างให้คงความว่างไว้
*   **Output**: ข้อมูลนำเข้า Master Data ได้อย่างแม่นยำ

---

## 🛒 3. Strategic Procurement

### Use Case 5: แยกเลข PR/PO ตามประเภท (ไทย/ต่างประเทศ)
*   **เป้าหมาย**: รันเลขเอกสารแยกชุดตามประเภทการจัดซื้อ
*   **Input**: `Purchase.type` (LOCAL/FOREIGN), `DocumentType` (PR/PO)
*   **Logic**:
    1.  `LOCAL` -> Prefix: `C-` (เช่น C-PO-...)
    2.  `FOREIGN` -> Prefix: `T-` (เช่น T-PO-...)
*   **Output**: `Purchase.orderNumber` ตาม Prefix ที่กำหนด
*   **ตัวอย่าง**: เลือกซื้อจากต่างประเทศ -> เลขรันเป็น T-PO-2604-0001

### Use Case 6: แสดง MOQ จาก Vendor ใน PO Line
*   **เป้าหมาย**: แสดงยอดสั่งขั้นต่ำในหน้าสั่งซื้อ
*   **Input**: `Supplier.moq`, `Product.id`
*   **Logic**: ดึงค่า `moq` จาก Supplier Info มาแสดงในระดับ Line Item เพื่อแจ้งเตือนผู้ซื้อ
*   **Output**: `PurchaseItem.moq` (Display field)

---

## 🏭 4. Inventory Control

### Use Case 4: Sync Active กับ Saleable
*   **เป้าหมาย**: สินค้า Active ต้องพร้อมขายเสมอ
*   **Input**: `Product.isActive`
*   **Logic**: `isActive` === `isSaleable` (True/False ต้องสอดคล้องกันอัตโนมัติ)
*   **Output**: สินค้าที่ปิดการใช้งานจะไม่ถูกดึงไปแสดงในหน้าขาย

### Use Case 13: Product Cleanup (Dedup)
*   **เป้าหมาย**: ลบรหัสสินค้าซ้ำโดยคงลำดับเดิม
*   **Input**: Item List (Excel/Array)
*   **Logic**: ยึดค่าแรกที่พบ (First encounter), ค่าที่ซ้ำลำดับถัดไปให้ล้างเป็นค่าว่าง (Clear value), ห้ามขยับลำดับแถว
*   **Output**: Cleaned List สำหรับ Batch Create

---

## 🚛 5. Shipping & Logistics

### Use Case 10: Sync สถานะกลับไปต้นทาง
*   **เป้าหมาย**: เปลี่ยนสถานะใน SO/OR ตามความเคลื่อนไหวของขนส่ง
*   **Input**: `Shipment.status`
*   **Logic**:
    1.  `PENDING` -> "รอการจัดส่ง"
    2.  `SHIPPED` -> "อยู่ระหว่างการจัดส่ง"
    3.  `DELIVERED` -> "จัดส่งสำเร็จ"
*   **Output**: `Sale.deliveryStatus` ถูกอัปเดตแบบ Real-time

### Use Case 11: Route Processing (Sort by Distance)
*   **เป้าหมาย**: จัดลำดับการส่งของตามระยะทาง
*   **Input**: coordinates (Lat/Long) ของบริษัทและลูกค้า
*   **Logic**:
    1.  Outbound: เรียงจาก ใกล้ -> ไกล
    2.  Inbound: เรียงจาก ไกล -> ใกล้
*   **Output**: `Shipment.sequence` (จัดลำดับอัตโนมัติ)

---

## 💰 6. Finance & Billing

### Use Case 7: รันเลข Invoice ตามแผนกของเซล
*   **เป้าหมาย**: แยกเลขที่ใบแจ้งหนี้ตามแผนกเพื่อคุมยอด
*   **Input**: `Sale.departmentCode`, `CurrentDate`
*   **Logic**: ใช้ Counter แยกตามแผนก + ปี/เดือน (เช่น K6903/0009)
*   **Output**: `Invoice.number`

### Use Case 9: ป้องกันการดึงบิลซ้ำไป Billing
*   **เป้าหมาย**: ห้าม Invoice ใบเดิมถูกใช้ใน Billing อื่น
*   **Input**: `Invoice.billingStatus`
*   **Logic**: ตรวจสอบสถานะก่อนรวมบิล ถ้าเป็น `BILLED` หรือ `PAID` แล้ว ให้ Block การเลือก
*   **Output**: Error Message แจ้งเตือนผู้ใช้

---

## 📊 7. Professional Reporting (QWeb Style)

### Use Case 14: Currency Conversion (CNY -> USD)
*   **เป้าหมาย**: แสดงราคาสองสกุลเงินในรายงาน
*   **Input**: `exchangeRate`, `Amount`
*   **Logic**: แปลงค่าตามอัตราแลกเปลี่ยน โดยข้ามฟิลด์ที่เป็น USD อยู่แล้ว (เช่น Freight)
*   **Output**: Report PDF แสดงยอด USD ถูกต้อง

### Use Case 17: สรุปยอดเฉพาะหน้าสุดท้าย
*   **เป้าหมาย**: แสดงบล็อกรวมเงิน (VAT/Net) เฉพาะท้ายเอกสาร
*   **Logic**: คำนวณ `pagination.isLastPage` ถ้าใช่จึง render Summary block
*   **Output**: Professional Layout สไตล์ QWeb
