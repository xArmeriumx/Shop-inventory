# 🔄 ERP Logic Workflow (ขั้นตอนการทำงาน)

มาตรฐานขั้นตอนการพัฒนาเพื่อให้ Logic นิ่งและระบบจัดการการเปลี่ยนแปลงได้แม่นยำ

---

## 🚦 Phase 1: Research (การวิจัยและออกแบบ)
1. **Analyze Schema**: ตรวจสอบ Prisma Schema ก่อนเริ่มเสมอ (ความสัมพันธ์ข้อมูลคือ SSOT)
2. **Path Mapping**: กำหนดจุดเชื่อมต่อของข้อมูล (Service -> Action -> Component)
3. **Draft Plan**: เขียนลำดับการแก้ไขก่อนเขียนโค้ด (เน้น logic stability)

## 🏗️ Phase 2: Implementation (การลงมือทำ)
1. **Service Layer**: สร้าง/แก้ไข Service function (เน้น Logic ความปลอดภัย)
2. **Action Layer**: หุ้ม Service ด้วย `handleAction` (ห้ามลืม!)
3. **Standard UI**: 
    - เรียกใช้ `useTransition` เพื่อจัดการสถานะการทำงาน
    - ครอบการเรียก Action ด้วย `runActionWithToast`
    - จัดการ `onSuccess` callback เพื่อล้างฟอร์มหรือรีเฟรชข้อมูล

```tsx
// ลำดับขั้นตอนมาตรฐานใน UI
const [isPending, startTransition] = useTransition();

const handleAction = () => {
    startTransition(async () => {
        const result = await runActionWithToast(myServerAction(args), {
            loadingMessage: "...",
            onSuccess: () => {
               // Update UI state / refresh data
            }
        });
    });
};
```

## 🧪 Phase 3: Verification (การตรวจสอบ)
1. **Build Test**: รัน `npm run build` เพื่อเช็ก Type Safety
2. **Manual Audit**: ทดลองรัน Flow ทั้งหมด และตรวจสอบ Audit Log ใน Database
3. **Commit & Push**: บันทึกงานพร้อมคำอธิบายที่ระบุถึงมาตรฐานที่ปฏิบัติ

---
*Logic ที่นิ่ง คือหัวใจของ ERP ที่ทรงพลัง*
