# มาตรฐานการ Refactor UI สำหรับระบบ ERP (Phase 3 Standard)

เอกสารฉบับนี้กำหนดขั้นตอนการทำ UI Refactor เพื่อให้โค้ดสะอาด (Clean Code), ดูแลรักษาง่าย (Maintenance Friendly), และเป็นระบบระเบียบตามหลัก Single Source of Truth

---

## 🏗️ เทคโนโลยีหลัก (Tech Stack)
- **Next.js 14+ (App Router)**
- **React Hook Form (RHF)**: จัดการ State และ Validation ฝั่งหน้าบ้าน
- **Zod**: กำหนด Schema สำหรับตรวจสอบข้อมูล (ใช้ทั้ง Client และ Server)
- **Server Actions**: สำหรับการส่งข้อมูลไปยัง Backend

---

## 🔄 ขั้นตอนการ Refactor (Workflow)

### 1. ชั้นข้อมูล (Schema Layer) 📝
สร้างไฟล์ Schema สำหรับ Form แยกออกมา (เช่น `src/schemas/customer-form.ts`)
- **หน้าที่**: กำหนด "หน้าตาข้อมูลดิบ" ที่ Input จะส่งเข้ามา
- **หลักการ**: 
  - ใช้ `z.coerce` สำหรับฟิลด์ตัวเลข เพื่อให้คุยกับ `<input type="number">` ได้ลื่นไหล
  - สร้างฟังก์ชัน `getDefaultValues(data?)` ไว้ในไฟล์นี้ที่เดียว เพื่อลดความซ้ำซ้อน

### 2. ชั้นโครงสร้าง (Infrastructure Layer) 🛠️
เรียกใช้ Shared Component ที่เตรียมไว้ให้:
- **`FormField`**: ใช้ห่อหุ้มทุก Input เพื่อให้การแสดงผล Label, Error Message, และ Hint Text เป็นมาตรฐานเดียวกันทั่วระบบ

### 3. ชั้นส่วนประกอบ (Component Layer) 🧩
แบ่งฟอร์มที่ยาวให้เป็น **Modular Sections** (เช่น Identity, Pricing, Logistics)
- **การจัดการ State**: ใช้ `FormProvider` หุ้มฟอร์มใหญ่ และตัวลูกใช้ `useFormContext` เพื่อดึงข้อมูล (ลดการทำ Prop Drilling)
- **SafeBoundary**: เลือกห่อเฉพาะ Section ที่มีความเสี่ยง (เช่น ส่วนที่ดึง data จากภายนอก หรือส่วนที่มี logic ซับซ้อน) เพื่อไม่ให้หน้าเว็บล่มทั้งหน้าหากจุดนั้นพัง

### 4. ชั้นการเชื่อมต่อ (Action Layer) 📮
เชื่อมต่อกับ Server Actions:
- **Submission**: ใช้ `useTransition` เพื่อจัดการสถานะ Loading และ `startTransition` สำหรับการบันทึก
- **Error Mapping**: หาก Server พ่น Error กลับมา (เช่น Validation fail บน server) ให้ใช้ `setError()` ของ RHF เพื่อปักหมุด Error กลับไปที่ Field นั้นๆ

### 5. ชั้นประสบการณ์ผู้ใช้ (Experience Layer) ✨
- **Mobile First**: 
    - ใช้ Grid สำหรับคอลัมน์กว้างบน Desktop และยุบเป็นแถวเดียวบน Mobile
    - ใช้ **Sticky Action Bar** (ปุ่ม Save/Cancel) ไว้ที่ด้านล่างสุดของจอเสมอในกรณีหน้าจอยาว
- **Visual Feedback**: ใช้ `toast` แจ้งเตือนเมื่อสำเร็จ และ `Skeleton` ในช่วงโหลดข้อมูล

---

## 📁 โครงสร้างไฟล์แนะนำ (Recommended File Structure)

```text
src/
 ├── schemas/
 │    └── [feature]-form.ts       # Client-side form logic & schema
 ├── components/
 │    ├── ui/
 │    │    └── form-field.tsx      # Shared FormField wrapper
 │    └── features/
 │         └── [feature]/
 │              └── [feature]-form.tsx  # Modularized form component
```

---

## 💡 กติกาเหล็ก (Golden Rules)
1. **Single Source of Truth**: กฎการ Validate ต้องอยู่ที่ Zod Schema เป็นหลัก และ Default values ต้องอยู่ที่เดียว
2. **Consistency**: ทุกฟิลด์ต้องมี Label และการแสดง Error ในตำแหน่งเดียวกัน (ผ่าน `FormField`)
3. **Fail-Safe**: อย่าห่อ `SafeBoundary` ใหญ่เกินไป ให้ห่อแค่จุดที่เสี่ยง เพื่อให้ Dev ยัง Debug จุดอื่นได้ง่าย
4. **Clean Exit**: ทุกหน้าต้องมีปุ่ม "ยกเลิก" ที่นำผู้ใช้กลับไปสภาวะปลอดภัยเสมอ

---
*จัดทำขึ้นเพื่อใช้เป็นแม่แบบสำหรับการ Refactor Phase 3 ของระบบ Shop Inventory สู่ ERP*
