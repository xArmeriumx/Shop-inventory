# 📜 ERP Development Rules (กติกาเหล็ก)

มาตรฐานสูงสุดสำหรับการพัฒนาความเสถียรของระบบและคุณภาพโค้ด (Clean Code & SSOT)

---

## 💎 1. Single Source of Truth (SSOT)
- **Data Logic**: ธุรกิจต้องมี logic ชุดเดียวที่ service layer เท่านั้น ห้ามเขียนคำนวณซับซ้อนที่ UI
- **Schema**: ความถูกต้องของข้อมูล (Validation) ต้องนิยามที่เดียว (Zod Schema) และแชร์ใช้ทั้งหน้าบ้านและหลังบ้าน
- **Status**: ทุกเอนทิตีต้องมีสถานะที่ชัดเจน (เช่น OPEN, CLOSED, SUCCESS) และการเปลี่ยนสถานะต้องผ่าน Protocol ที่กำหนดไว้เท่านั้น

## 🧪 2. Service Purity
- **Service Layer**: ต้องรับ-ส่งข้อมูลดิบ (Primitives/Interfaces) และมีหน้าที่แค่คุยกับ DB/External Service เท่านั้น
- **No Manual Try-Catch**: ห้ามดัก Error แบบฟุ่มเฟือยใน Service ให้ปล่อย Error พุ่งขึ้นไปยัง Action Layer เพื่อให้มาตรฐานกลางจัดการ
- **Independence**: Service ต้องไม่ล่ม (Crash) ถ้าข้อมูลเป็น Null (ใช้ Safeguard Queries เสมอ)

## 🛡️ 3. Action Layer Standard
- **handleAction**: ทุก Server Action **ต้อง** ถูกหุ้มด้วย `handleAction` เพื่อความสม่ำเสมอของ Response
- **Response Structure**: ห้าม return ข้อมูลดิบโดยตรง ต้องออกไปในรูปแบบ `{ success, data, message, errors }` เสมอ

## 💻 4. UI Interaction (Phase 3 Standard)
- **runActionWithToast**: ทุกการส่งข้อมูล (Mutation/Action) **ต้อง** หุ้มด้วยฟังก์ชันนี้
- **Zero Placeholder**: ห้ามใช้ข้อมูลหลอก ห้ามเขียน UI เปล่าๆ ต้องมีสถานะ Loading (Skeleton) และ Error Handling (Toast) เสมอ
- **Logic Stability**: UI มีหน้าที่แค่แสดงผลตาม State และส่ง Command ไปที่ Action เท่านั้น ห้ามตัดสินใจ Logic สำคัญเอง

---
*ความผิดพลาดในการไม่รัน `runActionWithToast` ถือเป็นการละเมิดความเสถียรของระบบ*
