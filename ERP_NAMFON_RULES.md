# 🛡️ ERP-Namfon Technical Business Rules (Master)

เอกสารฉบับนี้คือ **"กฎเหล็ก"** ของระบบ ERP-Namfon ที่เชื่อมโยงความต้องการทางธุรกิจเข้ากับการทำงานทางเทคนิค 

---

## 🏛️ 1. มาตรฐานสถาปัตยกรรม (Arch. Rules)

*   **Logic Isolation**: ห้ามเขียน Logic การเงินหรือสต็อกในหน้า UI โดยเด็ดขาด ต้องเรียกผ่าน `Service Layer` เท่านั้น
*   **Transaction Lock**: ทุกการบันทึกข้อมูลที่ส่งผลต่อหลายตาราง ต้องทำงานภายใต้ `db.$transaction`
*   **Audit Trail**: ทุกการเคลื่อนไหวของสินค้าต้องมีการสร้าง `StockLog` คู่กันเสมอ

---

## 📦 2. โมดูลสินค้าและคลัง (Inventory Rules)

*   **Availability**: `Available = Stock - ReservedStock` (ต้องแสดงผลค่านี้ในหน้า UI ตลอดเวลา)
*   **Lifecycle**: 
    - `isActive`: หากเป็น `false` ห้ามแสดงในหน้า POS/Sales
    - `isSaleable`: หากเป็น `false` ห้ามทำรายการจองสต็อก
*   **MOQ Intelligence**: หน้าจอจัดซื้อต้องแสดงการแจ้งเตือนหากจำนวนสั่งต่ำกว่า `moq` ใน Master Data

---

## 🛒 3. โมดูลจัดซื้อ (Procurement Rules)

*   **Sequence Control**: รันเลขที่เอกสารแยกตามประเภท (`purchaseType`):
    - `LOCAL`: ขึ้นต้นด้วย `C-` (เช่น C-PO-XXXX)
    - `FOREIGN`: ขึ้นต้นด้วย `T-` (เช่น T-PO-XXXX)
*   **State Machine**: 
    - ใบขอซื้อ (PR) จะเปลี่ยนเป็นใบสั่งซื้อ (PO) ได้เฉพาะเมื่อมีสถานะ `APPROVED`
    - เมื่อ Convert แล้ว ระบบต้องล็อกใบ PR เดิมไม่ให้แก้ไขอีก

---

## 🛍️ 4. โมดูลงานขาย (Sales & POS Rules)

*   **Dept Auto-Detection**: ระบบต้องเติม `departmentCode` ของพนักงานลงในใบขายอัตโนมัติจาก Auth Session
*   **Stock Booking**: เมื่อยืนยันการขาย (`CONFIRMED`) ระบบต้องเพิ่มจำนวนใน `reservedStock` ทันที
*   - **Invoice Lock**: เมื่อออกใบแจ้งหนี้ (`isLocked = true`) ห้ามแก้ไขรายการสินค้าหรือจำนวนเงินเด็ดขาด

---

## 🚛 5. โมดูลขนส่ง (Logistics Rules)

*   **Status Real-time Sync**: สถานะใบขนส่ง (`Shipment`) ต้อง Sync กลับไปยังใบสั่งซื้อ (`Sale`) เสมอ
*   - **Deduction Trigger**: สต็อกจริงจะถูกหัก (Deduct) เฉพาะเมื่อสถานะเปลี่ยนเป็น `SHIPPED` เท่านั้น
*   **Load Calculation**: คำนวณปริมาตร (CBM) อ้างอิงจาก `Product.metadata` เท่านั้น หากไม่มีค่าให้ใช้ค่า Default ขั้นต่ำ (0.5kg/0.01CBM)

---

## 🤝 6. โมดูลลูกค้า (CRM Rules)

*   **Regional Rules**: การกำหนด Salesperson ต้องอ้างอิงตาม `Customer.region` ที่ตรงกับ `Employee.region_ids` เท่านั้น
*   **Credit Rules**: หากยอดค้างชำระเกิน `creditLimit` ระบบต้องบล็อกการสร้าง Order ใหม่จนกว่าจะมีการชำระเงิน
