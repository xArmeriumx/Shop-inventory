# 🛡️ ERP-Namfon: Master Architecture & Business Rules

เอกสารฉบับนี้คือ **"Single Source of Truth"** สำหรับการพัฒนาและปรับปรุงระบบ Shop-Inventory สู่ระดับ **Customized ERP** ที่รองรับ Workflow ธุรกิจจริงอย่างเต็มรูปแบบ และทำหน้าที่เป็นคู่มือการออกแบบ (Design Framework) สำหรับทีมพัฒนา

---

## 🏗️ 1. มาตรฐานการเขียนโค้ดและสถาปัตยกรรม (Technical Standards)

### 1.1. Single Source of Truth (SSOT)
*   **DocSequence (ศูนย์รวมเลขเอกสาร)**: ห้ามสร้าง Logic รันเลขแยกในแต่ละ Action ทุกเอกสารต้องผ่าน `DocSequence` Service เพื่อป้องกันเลขซ้ำและรองรับ Prefix ตามบริบท (เช่น แผนก, ประเภทโครงการ)
*   **Inventory Integrity**: ยอดสต็อกต้องแยกชัดเจนระหว่าง `onHand` (คงเหลือจริง) และ `reserved` (จองไว้) โดยสูตร `Available = onHand - reserved` ต้องเป็นจริงเสมอทั่วทั้งระบบ

### 1.2. Clean Layered Architecture
*   **Action Layer (Controller)**: รับผิดชอบการ Validation (Zod), ตรวจสอบสิทธิ์ (RBAC), และการเรียก `revalidatePath` เท่านั้น ห้ามเขียน Business Logic หรือ Query DB โดยตรง
*   **Service Layer (Core Logic)**: ศูนย์รวม Business Logic ห้ามยุ่งเกี่ยวกับ HTTP Headers หรือ Cookies ทุกการดำเนินการที่แก้ไขมากกว่าหนึ่งตารางต้องใช้ `db.$transaction`

### 1.3. Atomic Operations
*   การคำนวณยอดเงินและสต็อกต้องทำในระดับ Database (Atomic update) เพื่อป้องกัน Race Condition ในระบบที่มี User ใช้งานพร้อมกันจำนวนมาก

---

## 🏭 2. มาตรฐานการปฏิบัติงานทางธุรกิจ (Business Operation Standards)

สำหรับการทำงานในแต่ละโมดูล ให้เน้น **"การประยุกต์และบูรณาการ (Professional Integration)"** ฟีเจอร์ที่มีอยู่แล้วให้เข้ากับระบบใหม่ตามกฎดังนี้:

### Module 1: Sales Management (ระบบการขาย)
*   **Smart Info Mapping**: ดึงข้อมูลแผนก สินค้า และ Sale Default จากข้อมูลพนักงานที่เปิดใบ (Employee-based Default) แต่ต้องอนุญาตให้แก้ไขได้ในระดับเอกสาร
*   **Stock Status on SO**: แสดงสถานะสต็อก 3 ระดับ (ยังไม่จอง, จองแล้ว, ตัดสต็อกแล้ว) เพื่อให้ฝ่ายขายเห็นภาพรวมโดยไม่ต้องเข้าคลัง
*   **Data Integrity Locking**: เมื่อออก Invoice (INV) หรือดึงเข้าสู่ Billing แล้ว บางฟิลด์ใน SO ต้องถูก readonly ทันทีเพื่อกันการแก้ซ้ำ

### Module 2: Contact & CRM (ฐานข้อมูลอัจฉริยะ)
*   **Region-Salesperson Mapping**: ลูกค้าหนึ่งรายผูกกับภูมิภาค และภูมิภาคผูกกับพนักงานขายที่ดูแล (แบบ Many-to-Many) ระบบต้องดึงข้อมูลให้อัตโนมัติเมื่อเลือกภูมิภาค
*   **Industrial Contacts**: เก็บข้อมูลเชิงธุรกิจครบถ้วน (รหัสกลุ่ม, เครดิตเทอม, เลขผู้เสียภาษี, แผนก Default)
*   **Import Strictness**: การ Import ผ่าน Excel ต้องรักษาโครงสร้าง 100% ตาม Template และตรวจสอบข้อมูลซ้ำก่อนเข้าสู่ Master Data

### Module 3: Procurement (การจัดซื้อเชิงกลยุทธ์)
*   **Sequence Distinction**: แยกชุดเลขเลขที่ใบขอซื้อ (PR) และใบสั่งซื้อ (PO) ออกจากกันชัดเจน
*   **Global Purchase Logic**: แยกประเภทการซื้อ ไทย/ต่างประเทศ (C/T Prefix) พร้อมจัดการพฤติกรรมภาษี (Default No Tax สำหรับต่างประเทศ)
*   **Vendor Intelligence**: แสดงยอดสั่งซื้อขั้นต่ำ (MOQ) และแจ้งเตือน Purchase Note ระดับสินค้าในหน้าสั่งซื้อ

### Module 4: Inventory & Warehouse (คลังสินค้าและการควบคุม)
*   **Product Control**: ผูกสถานะ `Active` ของสินค้าเข้ากับ `Sale_ok` อัตโนมัติ
*   **Data Cleaning**: ระบบตรวจสอบรหัสดังสินค้าซ้ำ (Duplication check) โดยยึดข้อมูลตัวแรกเป็นหลัก
*   **Inventory Control Logic**: การคำนวณ Minimum Quantity ต้องอิงจากจำนวนที่ "ขายได้จริง" (Available) ไม่ใช่แค่ยอดเหลือถาวร

### Module 5: Shipping & Logistics (การขนส่งและการกระจายสินค้า)
*   **Status Synchronization**: สถานะการจัดส่ง (DO) ต้อง Sync กลับไปยังต้นทาง (SO/OR) แบบ Real-time (รอส่ง -> อยู่ระหว่างส่ง -> สำเร็จ)
*   **Dispatch Planning**: รองรับการจัดลำดับการวิ่งงาน (Sequence) และคำนวณระยะทางจากบริษัท (Route Sorting)
*   **Shipping Hub**: ฝั่ง Shipping คือศูนย์รวมเอกสาร (INV/PL/PI/CI) และการคำนวณการจุตู้ (Container calculation)

### Module 6: Finance & Billing (การเงินและบัญชี)
*   **Dynamic Invoice Numbering**: รันเลข INV ตามแผนกของพนักงาน, แยก Counter ตามเดือน/ปี (ไทย/สากล), และรองรับ Prefix ตาม Journal/ประเภทเอกสาร
*   **Duplicate Prevention**: ห้ามดึง Invoice ใบเดิมเข้าสู่กระบวนการ Billing หรือวางบิลซ้ำซ้อน
*   **Tax Regulation**: รองรับรายงานภาษีหัก ณ ที่จ่าย (ภงด 1, 3, 53) และการคำนวณยอดสุทธิรวม/แยก VAT

---

## 💎 3. จุดเด่นที่ต้องให้ความสำคัญที่สุด (Cornerstone Focus)

เพื่อให้ระบบเป็น ERP ระดับมืออาชีพ ต้องเน้นความเข้มข้นใน 4 เรื่องนี้:
1.  **Document/Sequence Control**: การควบคุมเลขที่เอกสารให้ยืดหยุ่นตามแผนกและเวลา
2.  **Workflow/Status Automation**: การ Sync สถานะข้ามระบบเพื่อลดการคีย์ซ้ำ
3.  **Business Rules Integration**: การนำ Business Logic เช่น ภาษีหรือการจองสต็อกมาฝังลงใน Transaction
4.  **Professional Reporting (QWeb Style)**: รายงานที่คำนวณเลขในตัว (Currency conversion, Carton calculation, Pagination control) และ Layout ที่ได้มาตรฐานสากล

---

## 📈 4. Professional Portfolio Summary

สำหรับการนำเสนอผลงานหรือใส่ใน Resume ให้จัดกลุ่มความสามารถของระบบ (ERP-Namfon Edition) ดังนี้:

| Module | Objective | Key Features | Business Value |
| :--- | :--- | :--- | :--- |
| **Sales & CRM** | เพิ่มประสิทธิภาพการขาย | Region-based Mapping, Stock Booking status | ลดการ assign งานพลาด, เห็นจำนวนขายได้จริง |
| **Procurement** | ควบคุมต้นทุนและจัดซื้อ | PR/PO Workflow, Thai/Foreign logic, MOQ Alert | ป้องกันการซื้อของเกินจำเป็น, จัดการภาษีถูกต้อง |
| **Logistics** | จัดการขนส่งแบบครบวงจร | Shipping status sync, Dispatch sequencing | ติดตามงานจัดส่งได้ Real-time, วางแผนเส้นทางคุ้มค่า |
| **Finance** | ความแม่นยำทางบัญชี | Dynamic Sequnce, Duplicate billing prevention | ลดข้อผิดพลาดด้านตัวเลขเอกสาร, ตรวจสอบ Audit ง่าย |
| **Automation** | ลดภาระงาน Manual | Cross-model status sync, Automated actions | ข้อมูลสะท้อนถึงกันทั้งองค์กร, ลดการคีย์ซ้ำ |

---

> [!NOTE]
> ฟีเจอร์ใดที่มีอยู่แล้วในโปรเจกต์เดิม (Existing Features) ให้มุ่งเน้นการปรับจูน (Refinement) ให้เข้ากับโครงสร้าง Module ใหม่นี้ เพื่อให้เกิดการทำงานร่วมกันแบบบูรณาการ (Deep Integration) ไม่ใช่แค่ทำงานแยกส่วนกัน
