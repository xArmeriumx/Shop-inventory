# 🔄 ERP-Namfon Development Workflow

เอกสารฉบับนี้กำหนดมาตรฐานขั้นตอนการพัฒนา (Standard Operating Procedure - SOP) สำหรับการปรับปรุงและเพิ่มฟีเจอร์ในระบบ ERP-Namfon เพื่อให้โค้ดมีความเป็นระเบียบและตรวจสอบย้อนกลับได้

---

## 🛠️ Step-by-Step Feature Implementation

ในการสร้างฟังก์ชันใหม่ หรือแก้ไขฟังก์ชันเดิม ให้ยึดตามโครงสร้าง **Use Case Standard** ดังนี้:

### 1. Planning: แตก Use Case
ก่อนลงมือเขียนโค้ด ต้องระบุ 4 องค์ประกอบหลัก:
1.  **Objective (เป้าหมาย)**: ฟังก์ชันนี้ทำเพื่ออะไร แก้ปัญหาไหนให้ธุรกิจ?
2.  **Input (ข้อมูลขาเข้า)**: ต้องการข้อมูลอะไรบ้าง? (User, Fields, Model, RequestContext)
3.  **Business Logic (เงื่อนไขและขั้นตอน)**: สูตรคำนวณคืออะไร? เงื่อนไข IF/ELSE มีอะไรบ้าง? ต้องทำ $transaction ไหม?
4.  **Output (ข้อมูลขาออก/ผลลัพธ์)**: ข้อมูลที่บันทึกลง DB หรือค่าที่ส่งกลับหน้าบ้านคืออะไร?

### 2. Implementation: การเขียนโค้ด (Clean Architecture)
*   **Action Layer**: รับ Input และทำการ Validation ด้วย Zod
*   **Service Layer**: รับข้อมูลที่ Validate แล้วมาทำ Business Logic (ห้ามแตะ HTTP/Cookie)
*   **Atomic Call**: หากมีการแก้ไขหลาย Table ต้องใช้ `db.$transaction` เสมอ

### 3. Verification: การตรวจสอบ
*   **Success Path**: บันทึกข้อมูลถูกต้อง, สถานะเปลี่ยนตาม Logic
*   **Edge Cases**: ข้อมูลเป็น Null, หา Record ไม่เจอ, Sequence ซ้ำ
*   **UI Feedback**: แจ้งเตือนผู้ใช้ด้วย Message ที่ชัดเจน (เช่น "วงเงินเครดิตไม่พอ")

---

## 📝 Use Case Template (สำหรับ Developer)

ใช้ Template นี้ทุกครั้งเมื่อสรุปงานหรือเตรียม Spec:

```markdown
### [ชื่อฟังก์ชัน]
- **Objective**: [ระบุเป้าหมาย]
- **Trigger**: [เหตุการณ์ที่ทำให้ระบบทำงาน เช่น Create/Update/Button Click]
- **Inputs**:
  - [Input 1]
  - [Input 2]
- **Business Logic**:
  1. [ขั้นตอนที่ 1]
  2. [ขั้นตอนที่ 2]
  - [เงื่อนไข IF/ELSE]
- **Outputs**:
  - [ผลลัพธ์ 1]
  - [ผลลัพธ์ 2]
- **Examples**:
  - Input: [ตัวอย่าง]
  - Output: [ผลลัพธ์ที่คาดหวัง]
```

---

## 🛡️ กฎเหล็ก (Iron Rules)
1.  **No Direct DB in Actions**: Business Logic ต้องอยู่ใน Service เสมอ
2.  **No Placeholders**: ห้ามใช้ข้อมูลหลอกในระดับ Production ระบบต้องใช้ข้อมูลจริงจาก Schema
3.  **Sync always**: ขนะเปลี่ยนสถานะ (Status) ต้อง Sync ข้อมูลที่เกี่ยวข้องให้ครบตามกฎใน `ERP_NAMFON_RULES.md`
4.  **Security First**: ตรวจสอบ `shopId` ในทุก Query เพื่อป้องกันการเข้าถึงข้ามร้าน (Multi-tenancy)
