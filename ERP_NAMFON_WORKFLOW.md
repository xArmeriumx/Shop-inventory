# 🔄 ERP-Namfon Operational Workflows (Master)

คู่มือขั้นตอนการทำงาน (Step-by-Step) เพื่อให้การประสานงานระหว่าง UI และ Data Layer เป็นไปอย่างถูกต้อง

---

## 🛒 1. Workflow: งานจัดซื้อ (Procurement Cycle)

1.  **ขอซื้อ (PR Request)**: ผู้ใช้สร้างรายการในสถานะ `REQUEST` -> ระบบรันเลขชุด `C-PUR-` หรือ `T-PUR-`
2.  **อนุมัติ (PR Approved)**: ผู้จัดการตรวจสอบและกดอนุมัติ -> เปลี่ยนสถานะเป็น `APPROVED`
3.  **แปลงใบสั่งซื้อ (Convert to PO)**: กดปุ่ม "Convert" -> ระบบสร้างใบ `Purchase` ใหม่ (เลขชุด `C-PO-` / `T-PO-`) พร้อมเชื่อมโยง `originPrId`
4.  **รับของ (Receive Goods)**: คลังสินค้ากดรับของ -> ระบบอัปเดตราคาต้นทุนเฉลี่ย และเพิ่มจำนวนสต็อกจริง (Stock On-Hand)

---

## 🛍️ 2. Workflow: การจองและขาย (Sales Fulfillment)

1.  **เสนอราคา/จอง (Confirmed Order)**: เมื่อกดยืนยันการขาย -> ระบบรัน Action `confirmSale` -> ทำการเพิ่มค่าใน `Product.reservedStock`
2.  **ออกใบแจ้งหนี้ (Invoice Issuance)**: กดออกบิล -> ระบบดึงเลขที่เอกสารตามแผนกพนักงาน -> ล็อกใบสั่งซื้อ (`isLocked = true`) เพื่อป้องกันการแก้ไข
3.  **แจ้งขนส่ง (Shipment Creation)**: ข้อมูล Sale จะถูกดึงไปสร้างใบ `Shipment` โดยอัตโนมัติ

---

## 🚛 3. Workflow: การขนส่งและส่งมอบ (Logistics Pipeline)

1.  **วางแผนโหลด (Load Planning)**: กดคำนวณปริมาตรในหน้า Shipment -> ระบบดึงค่า Dimension จาก Metadata -> แนะนำขนาดรถ
2.  **วางแผนเส้นทาง (Route Planning)**: เลือกใบขนส่ง -> กดจัดลำดับเส้นทาง -> ระบบจัดเรียงตามระยะทางและบันทึกใน `dispatchSeq`
3.  **ปล่อยรถ (Dispatch)**: กด "Ship" -> ระบบเปลี่ยนสถานะเป็น `SHIPPED` -> **Trigger: หักสต็อกจริงออกจากคลังอัตโนมัติ**
4.  **ส่งมอบ (Delivery)**: บันทึกวันและเวลาที่ถึงมือลูกค้า -> ปิดสถานะ Shipment และ Sale เป็นสำเร็จ

---

## 🏭 4. Workflow: การจัดการสินค้า (Inventory Lifecycle)

1.  **เพิ่มสินค้าใหม่ (Onboarding)**: ระบุข้อมูลเบื้องต้น + ตั้งค่า `isActive`/`isSaleable` และ `moq`
2.  **ตั้งค่า Dimension**: ระบุขนาดและน้ำหนักสินค้าในส่วน Metadata (JSON) เพื่อให้ระบบ Logistics คำนวณได้แม่นยำ
3.  **ตรวจสต็อก (Availability Check)**: หน้าจอ Stock Report จะแสดงผลลัพธ์จาก `Stock - Reserved` เพื่อเตือนให้ฝ่ายจัดซื้อเรียกของเพิ่ม (PR) ได้ทันเวลา
