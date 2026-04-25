# 🔄 ERP Logic Workflow (ขั้นตอนการทำงาน)

มาตรฐานขั้นตอนการพัฒนาเพื่อให้ Logic นิ่งและระบบจัดการการเปลี่ยนแปลงได้แม่นยำ

---

## 🚦 Phase 1: Research (การวิจัยและออกแบบ)
1. **Analyze Schema**: ตรวจสอบ Prisma Schema ก่อนเริ่มเสมอ (ความสัมพันธ์ข้อมูลคือ SSOT)
2. **Context Mapping**: กำหนดขอบเขตข้อมูล (Context) และความเสี่ยงของ Logic (เช่น งวดบัญชีติดล็อคหรือไม่)
3. **Draft Implementation Plan**: เขียนลำดับการแก้ไขก่อนเขียนโค้ดจริง

## 🏗️ Phase 2: Implementation (การลงมือทำ)
1. **Service Layer (The Heart)**: 
    - เขียน Service function ที่จัดการข้อมูลดิบ
    - **Deep Audit Prep**: หากเป็นการ Update **ต้อง** ดึงข้อมูลเดิมเก็บไว้ใน `beforeSnapshot` ก่อนเริ่ม Mutation เสมอ
    - ใช้ Safeguard Queries เพื่อป้องกัน Exception กรณีความสัมพันธ์เป็น Null
2. **Action Layer (The Bridge)**: 
    - หุ้ม Service ด้วย `handleAction`
    - ตรวจสอบว่า Action สำคัญมี Parameter สำหรับ "เหตุผล" หรือ "Audit Metadata" หรือยัง
    - ส่ง `before` และ `after` snapshots เข้าสู่ `AuditService.record()` เพื่อบันทึก Diff
3. **Modular UI (The Face)**: 
    - แบ่งคอมโพเนนต์ออกเป็นส่วนเล็กๆ (Modular Sections)
    - ใช้ `useFormContext` กรณีเป็นฟอร์มขนาดใหญ่เพื่อลด Prop Drilling
    - เรียกใช้ `useTransition` และ `runActionWithToast` เป็นมาตรฐานเดียว
    - จัดการ `onSuccess` callback เพื่อพาผู้ใช้ไปสู่สถานะที่สมบูรณ์เสมอ

```tsx
// มาตรฐานการเรียกใช้ Action ในระดับ UI
const [isPending, startTransition] = useTransition();

const handleOperation = () => {
    startTransition(async () => {
        await runActionWithToast(targetAction(params), {
            loadingMessage: "กำลังประมวลผลระบบ...",
            successMessage: "ดำเนินการสำเร็จ",
            onSuccess: () => {
               // 1. ล้างสถานะเดิม
               // 2. รีเฟรชข้อมูลล่าสุด
               // 3. ปิดหน้าต่างหรือเปลี่ยนเส้นทาง
            }
        });
    });
};
```

## 🏆 ตัวอย่างโค้ดมาตราฐาน (Golden Example: Update Operation)

เพื่อให้เห็นภาพการทำงานจริง นี่คือลำดับการเขียนโค้ดที่ถูกต้อง 100%:

### 1. Service Layer (Purity + Deep Audit Prep)
```typescript
async updateProduct(ctx: RequestContext, id: string, data: any) {
    // A. Deep Audit Prep: ดึงข้อมูลเดิมเก็บไว้ก่อน
    const oldSnapshot = await db.product.findUnique({ where: { id } });
    
    // B. Business Logic & Safeguard Query
    return await db.product.update({
        where: { id, shopId: ctx.shopId },
        data: { ...data },
    });
    // หมายเหตุ: AuditService.record จะถูกเรียกใช้ใน Action Layer หรือหุ้มด้วย runWithAudit
}
```

### 2. Action Layer (The Bridge + handleAction)
```typescript
export async function updateProductAction(id: string, data: any) {
    return handleAction(async () => {
        const ctx = await getContext();
        // ดึงข้อมูลก่อนเพื่อ Audit
        const before = await ProductService.getById(id); 
        
        const result = await ProductService.updateProduct(ctx, id, data);
        
        // C. Record Deep Audit (Old vs New)
        await AuditService.record({
            action: 'PRODUCT_UPDATE',
            targetId: id,
            before,
            after: result,
            note: `อัปเดตข้อมูลสินค้า: ${result.name}`
        });
        
        return result;
    });
}
```

### 3. UI Layer (Interaction + runActionWithToast)
```tsx
const [isPending, startTransition] = useTransition();

const onSave = (formData: any) => {
    startTransition(async () => {
        await runActionWithToast(updateProductAction(id, formData), {
            loadingMessage: "กำลังบันทึกการเปลี่ยนแปลง...",
            successMessage: "อัปเดตข้อมูลสินค้าสำเร็จ",
            onSuccess: () => router.refresh() // กลับสู่สถานะปลอดภัย
        });
    });
};
```

## 🧪 Phase 3: Verification (การตรวจสอบ)
1. **Type & Build Check**: รัน `npm run build` เพื่อยืนยันว่าไม่มีจุดไหนที่โค้ดหลุด Type Safety
2. **Audit Verification**: ตรวจสอบ Audit Log ว่ามีข้อมูล Old/New ครบถ้วนและ Diff ถูกต้องหรือไม่
3. **UI Polish**: เช็คสถานะ Loading (Skeleton) และการแสดงผลบน Mobile ว่าคลีนตามมาตรฐาน Phase 3

---
*Logic ที่นิ่ง คือหัวใจของ ERP ที่ทรงพลัง*
