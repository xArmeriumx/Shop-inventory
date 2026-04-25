# 📜 ERP Development Rules (กติกาเหล็ก)

มาตรฐานสูงสุดสำหรับการพัฒนาความเสถียรของระบบและคุณภาพโค้ด (Clean Code & SSOT)

---

## 💎 1. Single Source of Truth (SSOT)
- **Data Logic**: ธุรกิจต้องมี logic ชุดเดียวที่ service layer เท่านั้น ห้ามเขียนคำนวณซับซ้อนที่ UI
- **Schema**: ความถูกต้องของข้อมูล (Validation) ต้องนิยามที่เดียว (Zod Schema) และแชร์ใช้ทั้งหน้าบ้านและหลังบ้าน
- **Status Consistency**: ทุกเอนทิตีต้องมีสถานะที่ชัดเจน (เช่น OPEN, CLOSED, SUCCESS) และการเปลี่ยนสถานะต้องผ่าน Protocol ที่กำหนดไว้เท่านั้น

## 🧪 2. Service Purity
- **Action Layer Standard**: ทุก Server Action **ต้อง** ถูกหุ้มด้วย `handleAction` เพื่อความสม่ำเสมอของ Response
- **Response Structure**: ห้าม return ข้อมูลดิบโดยตรง ต้องออกไปในรูปแบบ `{ success, data, message, errors }` เสมอ
- **No Manual Try-Catch**: ห้ามดัก Error แบบฟุ่มเฟือยใน Service ให้ปล่อย Error พุ่งขึ้นไปยัง Action Layer เพื่อให้มาตรฐานกลางจัดการ
- **Safeguard Queries**: Service ต้องไม่ล่ม (Crash) ถ้าข้อมูลเป็น Null ต้องใช้เทคนิคการดึงข้อมูลที่ยืดหยุ่นและ Optional Chaining เสมอ

## 💻 3. UI Interaction (Phase 3 Standard)
- **runActionWithToast**: ทุกการส่งข้อมูล (Mutation/Action) **ต้อง** หุ้มด้วยฟังก์ชันนี้ เพื่อความคงเส้นคงวาของ Feedback
- **Zero Placeholder**: ห้ามใช้ข้อมูลหลอก ห้ามเขียน UI เปล่าๆ ต้องมีสถานะ Loading (Skeleton) และ Error Handling (Toast) เสมอ
- **Logic Stability**: UI มีหน้าที่แค่แสดงผลตาม State และส่ง Command ไปที่ Action เท่านั้น ห้ามตัดสินใจ Logic สำคัญเอง
- **Clean Exit**: ทุกหน้าที่มีการกรอกข้อมูล (Form/Action) ต้องมีปุ่ม "ยกเลิก" หรือทางออกที่พากลับไปสู่สภาวะปลอดภัย (Safe State) เสมอ

## 🛡️ 4. Data Safety & Audit (Advanced Governance)
- **Safeguard Access**: การเข้าถึงข้อมูลที่อาจเป็น Null (เช่น Nested Relations) ต้องใช้ Optional Chaining (`?.`) หรือ Null Check เสมอ ห้ามปล่อยให้หน้าเว็บขาว (White Screen)
- **Deep State Audit**: ทุกการแก้ไขข้อมูล (Update Action) **ต้อง** มีการเก็บ Snapshot ข้อมูลเก่า (`before`) และข้อมูลใหม่ (`after`) เสมอ เพื่อใช้ในการเปรียบเทียบ (Diffing)
- **Audit Justification**: การแก้ไขข้อมูลที่ล็อคไปแล้ว หรือข้อมูลสำคัญทางการเงิน ต้องมีการระบุ "เหตุผล" (Reason) ทุกครั้งเพื่อเก็บเป็นหลักฐานใน Audit Log
- **No Magic Numbers**: ห้ามใช้ตัวเลขหรือ String ที่ไม่มีที่มาที่ไป ให้ใช้ Constants หรือ Enums เสมอเพื่อให้โค้ดอ่านง่ายและ SSOT ที่สุด
- **Modular Components**: หน้าเว็บที่ยาวเกิน 300 บรรทัด ต้องแบ่งเป็น Modular Sections เพื่อให้ Maintenance ง่ายและลดความเสี่ยงจากการพังทั้งหน้า

---
*ความผิดพลาดในการไม่รัน `runActionWithToast` ถือเป็นการละเมิดความเสถียรของระบบ*
