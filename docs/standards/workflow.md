# 🔄 ERP Logic Workflow (ขั้นตอนการทำงาน)

มาตรฐานขั้นตอนการพัฒนาเพื่อให้โครงสร้างโค้ดสะอาดและ Logic นิ่งที่สุด (Phase 3 Standard)

---

## 🚦 Phase 1: Research & Schema Definition
1. **Analyze Prisma**: เช็กความสัมพันธ์ของโมเดลก่อนเริ่ม
2. **Define Schema (SSOT)**: สร้างไฟล์ `src/schemas/[feature]-form.ts`
    - กำหนด Zod Schema
    - สร้างฟังก์ชัน `getDefaultValues(data?)` ไว้ในที่เดียว
3. **Plan Audit**: ระบุฟีลด์ที่ต้องเก็บ Snapshot (Old/New)

## 🏗️ Phase 2: Modular Implementation
1. **Service Layer**: 
    - เขียน Query ที่มีระบบ Safeguard (ดัก Null/Relation)
    - เตรียม logic สำหรับการทำ Deep Audit
2. **Action Layer**: 
    - หุ้มด้วย `handleAction`
    - ดึงข้อมูลเดิม (Before) -> ทำการแก้ไข -> ส่ง Before/After เข้า `AuditService.record()`
3. **Component Structure**:
    - สร้าง `index.tsx` เพื่อเป็นศูนย์กลางจัดการ RHF (FormProvider)
    - แยก UI เป็นโฟลเดอร์ `sections/` ตามลำดับความสำคัญ (เช่น Identity, Pricing)
    - ใช้ `runActionWithToast` พร้อม `useTransition` เพื่อ UX ที่ลื่นไหล

## 🧪 Phase 3: Total Verification
1. **Data Integrity**: แก้ไขแล้ว ข้อมูล Old/New ใน Audit Log ต้องถูกต้อง
2. **UI Resilience**: ทดลองลบข้อมูลบางส่วนใน DB แล้วหน้าเว็บต้องไม่ล่ม (Safeguard Test)
3. **Build Check**: `npm run build` ต้องผ่าน 100%

---

### 📂 โครงสร้างมาตรฐาน (Folder Structure)
```text
src/
 ├── schemas/
 │    └── [feature]-form.ts      # Client-side form logic & schema (SSOT)
 ├── components/
 │    └── features/
 │         └── [feature]/
 │              ├── index.tsx     # Form Orchestrator (Orchestration context)
 │              └── sections/     # Modular UI Sections (Sub-components)
```

---
*Logic ที่นิ่ง คือหัวใจของ ERP ที่ทรงพลัง*
