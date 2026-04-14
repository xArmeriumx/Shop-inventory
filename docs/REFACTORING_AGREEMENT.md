# 🏗️ Shop-Inventory: Refactoring & Clean Architecture Agreement

เอกสารฉบับนี้จัดทำขึ้นเพื่อใช้เป็น **"Single Source of Truth"** (จุดศูนย์กลาง) สำหรับข้อตกลงและมาตรฐานในการปรับปรุงโครงสร้างโค้ด (Refactoring) ของโปรเจค Shop-Inventory 

เพื่อให้แน่ใจว่าการขยายระบบ (Scale up) และการบำรุงรักษา (Maintenance) สามารถทำได้อย่างราบรื่น เป็นระเบียบ และทีมในอนาคตสามารถทำงานต่อได้ทันที

---

## 🎯 1. สถาปัตยกรรมเป้าหมาย (Target Architecture)

เราจะเปลี่ยนจากการนำ Business Logic + Database Queries ไปรวมกันไว้ใน **Server Actions** เปลี่ยนเป็นรูปแบบ **Layered Architecture (3 Layers)** ดังนี้:

### 1.1. Presentation / Controller Layer (`src/actions`)
- **หน้าทื่:** เป็นเพียง "นายหน้า" รับข้อมูลจาก Client Components ตรวจสอบสิทธิ์ และโยนงานต่อ
- **สิ่งที่ควรทำ:** 
  - Validate ข้อมูลด้วย Zod Schema
  - ตรวจสอบสิทธิ์ผู้ใช้งาน (RBAC: `requirePermission`)
  - โยน Input ไปให้ Service Layer ทำงาน
  - จัดรูปแบบ Error ให้อยู่ในมาตรฐาน `ActionResponse<T>`
  - สั่งเคลียร์แคช (`revalidatePath`) 
- **ข้อห้าม ❌:** ห้ามเขียน `db.xxxx.findMany()` หรือ Business Logic เด็ดขาด

### 1.2. Service Layer (`src/services`)
- **หน้าที่:** หัวใจหลักของระบบ รับผิดชอบเรื่องกฎทางธุรกิจ (Business Logic) และการดำเนินการกับฐานข้อมูล (Database Operation)
- **สิ่งที่ควรทำ:**
  - รันคำสั่ง Prisma Query (`db.product.create()`, etc.)
  - ทำ Database Transaction (`db.$transaction()`) 
  - ตรวจสอบ Optimistic Locking / ข้อมูลซ้ำซ้อน
  - สำหรับ Service ที่เรียกข้ามโดเมนได้ (เช่น `StockService`) ให้นำมาเรียกในชั้นนี้
- **ข้อห้าม ❌:** ห้ามยุ่งเกี่ยวกับ Framework-specific context อย่าง HTTP Headers, Cookies, หรือ Next.js `revalidatePath` เด็ดขาด

### 1.3. Data / Rules Layer (`src/schemas` & `src/lib/db`)
- **หน้าที่:** แหล่งอ้างอิงความถูกต้องสำหรับ Typesafety และรูปทรงของข้อมูล (Zod Schemas) รวมทั้ง Database Client

---

## 🚀 2. ขั้นตอนปฏิบัติในการ Refactoring (Workflow)

เพื่อความปลอดภัย เราจะทำการแปลงโครงสร้างแบบค่อยเป็นค่อยไป (Phased Approach)

1. **Isolation:** ไม่ส่งผลกระทบ main branch ทุกการ Refactor ต้องทำใน Branch ใหม่ เช่น `refactor/clean-architecture`
2. **Proof of Concept (PoC):** เริ่มนำร่องกระบวนการเหล่านี้กับ **Product Module** ก่อน (`actions/products.ts` -> `services/product.service.ts`)
3. **Validation & Testing:** การ Refactor ต้องไม่ทำให้ Input และ Return Type รูปร่างเปลี่ยนไป เพื่อการันตีว่า Client Component จะไม่ต้องแก้ไขใดๆ
4. **Gradual Migration:** เมื่อ Products สำเร็จ ค่อยทยอยปรับโครงสร้างของ Sales, Purchases และส่วนอื่นๆ ตามมา

---

## 📦 3. มาตรฐานโครงสร้างไฟล์ (Folder Structure Standard)

**จากเดิม:**
```text
src/
 ├── actions/
 │    ├── products.ts   <-- (ปัจจุบันเป็น Controller + Service หมกในนี้หมด)
 ├── lib/
 │    ├── stock-service.ts
```

**เป้าหมายใหม่ (Refactored):**
```text
src/
 ├── actions/
 │    └── products.ts         <-- (Controller: รับค่า ตรวจสิทธิ์ โยนต่อ เคลียร์แคช)
 ├── services/                <-- (🌟 ใหม่: ศูนย์รวม Business/Database Logic)
 │    ├── index.ts            <-- (จุดศูนย์สำหรับ export services)
 │    ├── product.service.ts  <-- (สร้างใหม่ ดึง logic ออกมาจากหน้า actions)
 │    └── stock.service.ts    <-- (ย้ายมาจาก lib/ เพื่อให้ Service อยู่ที่เดียวกัน)
 ├── schemas/
 └── lib/
```

---

## 🛡️ 4. ข้อตกลงความปลอดภัย Typesafety & Error Handling

- **Strict Validation:** ทุกๆ Data Payload จากหน้าบ้าน **ต้อง** ผ่านการ `.safeParse()` จาก Zod (`src/schemas`) ทุกครั้งก่อนส่งเข้าสู้ Service Layer (ห้ามใช้ type `any` เป็นอันขาด)
- **Error Types:** Service ต้องคืนค่า Error แจ้งเตือนแบบเฉพาะเจาะจง (เช่น Throw Error พร้อม Error Message ที่อ่านรู้เรื่อง) เพื่อให้ Action Layer นำไปห่อรูปเป็น `ActionResponse` กลับไปให้ Client ได้สวยงาม
- **Atomicity:** งานที่มีมากกว่า 1 สเต็ปเชื่อมกัน (เช่น สร้างบิล + ตัดสต็อก) จะต้องครอบด้วย `db.$transaction()` เสมอใน Service Layer

---

## 🧐 5. มาตรฐานฟังก์ชันและ TypeScript (Function & Type Definitions)

เพื่อให้มั่นใจว่าเรามี "ภาษาเดียวกัน" ภายในทีมเมื่อเขียนฟังก์ชันขึ้นมา โค้ดทั้งหมดจะต้องปฏิบัติตามกฎของ TypeScript ดังนี้:

### 5.1. ฝั่ง Server Actions (Controller)
- **Signature:** ตัว Action ทุกฟังก์ชัน **ต้อง Return เป็น `Promise<ActionResponse<T>>` เสมอ**
- **Exception Handling:** เราจะไม่ให้ Action โยน (Throw) Error กลับไปสู่หน้าบ้านโดยตรงเด็ดขาด ต้องใช้ `try-catch` ห่อหุ้ม และถ้ามี Error ให้ Return เป็น:
  ```typescript
  return { success: false, message: error.message }; 
  ```

### 5.2. ฝั่ง Service Layer
- **Input Parameters:** ถ้า Service ต้องการข้อมูลเยอะ ให้ส่งผ่านเข้ามาในรูปแบบของ Object Interface เสมอ (เช่น `create(ctx: RequestContext, payload: ProductInput)`) โดย `RequestContext` อาจจะใช้เพื่อส่งต่อพวก `userId` หรือ `shopId`
- **Return Type:** Service **ไม่จำเป็นต้อง Return รูปแบบของ `ActionResponse`** ให้มัน Return ข้อมูลเนื้อๆ รันเสร็จแล้วโยน Entity ก้อนนั้นออกมาเลย (เช่น return ก้อน `Product`) 
- **Exception Handling:** หาก Service เจอเงื่อนไขที่ไม่ถูกต้อง (เช่น สต็อกหมด, ของเกินจำนวน) **ให้ Throw Error ตรงๆ ไปเลย** แล้วหน้า Action ค่อยไปตื่นตัวเพื่อดักจับ (Catch) แล้วห่อรูปแจ้งข้อความ Error กลับไปยังลูกค้า
- **Transaction Forwarding:** ถ้า Service ตัวนี้ถูกเรียกใช้เพื่อเป็นกระบวนการย่อย ควรเปิดรับ Parameter `tx` เสมอ เช่น:
  ```typescript
  // ใน Service: สามารถรับ Transaction Client จาก Prisma ได้
  export async function createProduct(payload: ProductInput, tx?: Prisma.TransactionClient) {
     const dbClient = tx || db; 
     return dbClient.product.create({ ... });
  }
  ```

### 5.3. TypeScript Models & Entities
- รูปแบบของ Input ที่รับมาจากผู้ใช้ **ต้องใช้ชนิดที่ Inferred มาจาก Zod** เช่น `type ProductInput = z.infer<typeof productSchema>`
- ชนิดของตัวแปร Database Entity ให้ **Import มาจาก Prisma โดยตรง** (`import { Product } from '@prisma/client'`)
