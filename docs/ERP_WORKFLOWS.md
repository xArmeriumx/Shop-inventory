# 🔄 ERP-Namfon: Core Business Workflows

เอกสารฉบับนี้อธิบายลำดับขั้นตอนการทำงาน (Workflow) ของโมดูลต่างๆ ในระบบ ERP-Namfon เพื่อให้ทีมงานเข้าใจภาพรวมของ Business Logic ทั้งหมด

---

## 🛍️ 1. Sales & Order Management Workflow

### 1.1. ใบสั่งขาย (Sale Order) และการจองสต็อก
1.  **Draft**: เซลสร้างใบเสนอราคาหรือใบสั่งขายเบื้องต้น (ยังไม่มีการจองสต็อก)
2.  **Confirmed (Booking)**: เมื่อยืนยันคำสั่งซื้อ ระบบจะทำการ **"จองสต็อก (Reserved Stock)"** ทันที
    *   *Logic*: `Available Stock = On-Hand - Reserved`
    *   ลูกค้าคนอื่นจะไม่สามารถแย่งซื้อสินค้าที่จองไว้ได้
3.  **Shipped (Deduct)**: เมื่อคลังสินค้าทำ Delivery Validate ระบบจะตัดยอดจากคลังจริง
    *   *Logic*: `On-Hand` ลดลง และล้างยอด `Reserved` ในตัว
4.  **Invoiced (Lock)**: เมื่อออกใบกำกับภาษี เอกสาร Sale Order จะถูก Read-only ทันที

---

## 📦 2. Strategic Procurement Workflow (PR to PO)

### 2.1. ใบขอซื้อ (Purchase Request) ไปยังใบสั่งซื้อ (Purchase Order)
1.  **PR Issue**: แผนกที่ต้องการของสร้างใบ PR
2.  **PR Approval**: ผู้มีอำนาจตรวจสอบและอนุมัติ
3.  **PO Generation**: จัดซื้อกดปุ่ม "Convert to PO" จากใบ PR (ห้ามพิมพ์ข้อมูลซ้ำ เพื่อลด Human Error)
4.  **Type-based Sequencing**:
    *   *Local*: รันเลขด้วยชุด Thai Prefix (เช่น T) + คิด VAT ปกติ
    *   *Foreign*: รันด้วยชุด Foreign Prefix (เช่น C) + Default เป็น No Tax
5.  **MOQ Check**: ระบบแจ้งเตือนอัตโนมัติหากสินค้าใน Line มีจำนวนน้อยกว่ายอดสั่งขั้นต่ำที่ตั้งไว้ใน Product Master

---

## 🚚 3. Shipping & Logistics Workflow

### 3.1. สถานะการจัดส่ง (Shipping Status Flow)
1.  **Waiting**: รอการเตรียมสินค้า
2.  **Processing**: อยู่ระหว่างบรรจุลงรถ (System Sync: ส่งสถานะกลับไป SO เป็น "In Process")
3.  **Delivered**: จัดส่งสำเร็จ (System Sync: ส่งสถานะกลับไป SO เป็น "Completed")

### 3.2. การจัดลำดับ (Dispatch Sequence)
*   **x_seq**: ผู้ดูแลคลังสามารถจัดลำดับลำดับการส่ง (1, 2, 3...) เพื่อวางแผนเส้นทางรถขนส่ง (Route Planning)

---

## 💰 4. Finance & Billing Workflow

### 4.1. ระบบInvoice และการป้องกันยอดซ้ำ
*   **Dept-based Prefix**: รันเลขใบกำกับภาษีตามแผนก (เช่น K-INV สำหรับแผนก K)
*   **Billing Prevention**: ระบบจะบันทึกสถานะ "Billed" ลงใน Invoice ทันทีที่ถูกนำไปสร้างใบวางบิล (Billing Statement) ป้องกันการนำบิลใบเดิมไปส่งลูกค้าซ้ำซ้อน
*   **WHT Logic**: ระบบหักภาษี ณ ที่จ่ายอิงตาม Config ของการจ่ายเงิน (1%, 3%, 53%)

---

## 👥 5. Master Data Management

### 5.1. Customer & Salesperson Mapping
*   **Region-based Logic**: 
    1.  ระบุภูมิภาคให้ลูกค้า (Contact Region)
    2.  ระบบดึงรายชื่อเซลที่ดูแลภาคนั้นๆ มาเป็น Default ให้ทันที
    3.  รองรับความสัมพันธ์แบบ 1 ลูกค้า ต่อหลายพื้นที่รับผิดชอบ
