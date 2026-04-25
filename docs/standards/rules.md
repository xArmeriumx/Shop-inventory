# 📜 ERP Development Rules (กติกาเหล็ก)

มาตรฐานสูงสุดสำหรับการพัฒนาความเสถียรของระบบและคุณภาพโค้ด (Clean Code & SSOT)

---

## 💎 1. Single Source of Truth (SSOT)
- **Schema Layer**: กฎการ Validate (Zod) และค่าเริ่มต้น (Default Values) **ต้อง** อยู่ที่เดียวกันใน `src/schemas/[feature]-form.ts`
- **Logic Purity**: ห้ามคำนวณ Business Logic ซับซ้อนใน UI ทุกอย่างต้องออกจาก Service Layer
- **Status Protocols**: การเปลี่ยนสถานะเอนทิตีต้องทำผ่าน Server Actions ที่มีการเช็กเงื่อนไข (Conditional Guards) เท่านั้น

## 🧪 2. Service & Action Layer Standard
- **Safe Services**: ทุก Service **ต้อง** มี Safeguard Query (Optional Chaining) เพื่อป้องกันหน้าเว็บขาวเมื่อข้อมูลความสัมพันธ์เป็น Null
- **handleAction**: ทุก Server Action **ต้อง** ถูกหุ้มด้วย `handleAction` เพื่อมาตรฐานการส่งกลับข้อมูลที่สม่ำเสมอ
- **Deep Audit**: ทุกการ Update **ต้อง** เก็บทั้ง `beforeSnapshot` และ `afterSnapshot` เพื่อการตรวจสอบย้อนหลัง (Diffing)

## 🧩 3. Triple-Layer Component Architecture
- **Orchestrator**: ไฟล์ `index.tsx` ของ Feature มีหน้าที่จัดการ Form State และ Submission เท่านั้น
- **Modular Sections**: ฟอร์มที่ยาวต้องแบ่งเป็น Section ย่อยในโฟลเดอร์ `sections/` และสื่อสารผ่าน `useFormContext`
- **FormField Wrapper**: ทุก Input **ต้อง** หุ้มด้วย `FormField` (Shared Component) เพื่อมาตรฐาน Label/Error ที่เหมือนกันทั้งระบบ

## 💻 4. UI/UX Interaction (Phase 3)
- **runActionWithToast**: มาตรฐานเดียวในการเชื่อมต่อ UI กับ Action (จัดการ Loading/Toast อัตโนมัติ)
- **Clean Exit**: ทุกจุดที่มี Interaction ต้องมีทางออกที่ปลอดภัย (Cancel/Back) เสมอ
- **Logic Over Design**: เน้นความนิ่งของข้อมูลและความถูกต้องของสถานะ ก่อนความสวยงามที่ซับซ้อนเกินจำเป็น

---
*ความผิดพลาดในการไม่รัน `runActionWithToast` ถือเป็นการละเมิดความเสถียรของระบบ*
