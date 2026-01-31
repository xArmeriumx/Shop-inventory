# 🔍 Comprehensive Project Risk Analysis

> สร้างเมื่อ: 2026-01-30 23:50  
> ระบบ: Shop Inventory POS

---

## 🔴 Critical Security Issues (ต้องแก้ทันที)

### 1. RBAC Bypass in `expenses.ts`

**ไฟล์:** `src/actions/expenses.ts`

```typescript
// ❌ Line 119-121: ใช้ userId แทน shopId
const existing = await db.expense.findFirst({
  where: { id, userId: ctx.userId, deletedAt: null }, // ❌ WRONG
});

// ❌ Line 154-156: เหมือนกัน
const existing = await db.expense.findFirst({
  where: { id, userId: ctx.userId, deletedAt: null }, // ❌ WRONG
});
```

**ความเสี่ยง:**

- พนักงานใน Shop A สามารถแก้ไข/ลบ expenses ของ Shop B ได้ถ้ามี userId ตรงกัน
- Multi-tenant data isolation ไม่ปลอดภัย

**แก้ไข:**

```typescript
// ✅ ใช้ shopId แทน userId
where: { id, shopId: ctx.shopId, deletedAt: null }
```

---

### 2. Hard Delete Instead of Soft Delete

**ไฟล์:** `src/actions/expenses.ts` line 163, `src/actions/incomes.ts` line 169

```typescript
// ❌ Comment ว่า "soft delete" แต่ทำ hard delete
await db.expense.delete({
  where: { id },
});
```

**ความเสี่ยง:**

- ข้อมูลหายถาวร ไม่สามารถกู้คืนได้
- ไม่สอดคล้องกับ schema ที่มี `deletedAt` field
- Reports ย้อนหลังอาจผิดพลาด

**แก้ไข:**

```typescript
// ✅ ใช้ soft delete ตาม comment
await db.expense.update({
  where: { id },
  data: { deletedAt: new Date() },
});
```

---

### 3. Unique Constraint vs Query Filter Mismatch

**ไฟล์:** `prisma/schema.prisma`

| Model       | Unique Constraint                        | Query Filter       | Status      |
| ----------- | ---------------------------------------- | ------------------ | ----------- |
| Product     | `@@unique([userId, sku])`                | `WHERE shopId = ?` | ❌ MISMATCH |
| Sale        | `@@unique([userId, invoiceNumber])`      | `WHERE shopId = ?` | ❌ MISMATCH |
| LookupValue | `@@unique([lookupTypeId, shopId, code])` | `WHERE shopId = ?` | ✅ OK       |

**ความเสี่ยง:**

- Owner ที่มีหลาย shops ไม่สามารถใช้ SKU ซ้ำข้าม shops ได้
- Soft-deleted products ยังบล็อก unique constraint

---

## 🟡 Medium Issues (ควรแก้ไข)

### 4. Inconsistent Delete Patterns

| Model    | Method                  | Notes             |
| -------- | ----------------------- | ----------------- |
| Product  | `isActive: false`       | Different pattern |
| Expense  | `db.delete()`           | **Hard delete!**  |
| Income   | `db.delete()`           | **Hard delete!**  |
| Customer | `deletedAt: new Date()` | Soft delete       |
| Supplier | `deletedAt: new Date()` | Soft delete       |
| Purchase | `status: 'CANCELLED'`   | Cancel pattern    |
| Sale     | `status: 'CANCELLED'`   | Cancel pattern    |

**ปัญหา:** ต้องจำวิธีการลบสำหรับแต่ละ model

---

### 5. Missing Stock Validation in Sale

**ไฟล์:** `src/actions/sales.ts` line 174-179

```typescript
// ⚠️ Stock check แต่ไม่ได้ lock row
if (product.stock < item.quantity) {
  throw new Error(`สินค้า "${product.name}" มีสต็อกไม่พอ`);
}
```

**ความเสี่ยง:**

- Race condition: 2 users ขายสินค้าเดียวกันพร้อมกัน
- Stock อาจติดลบได้

**แก้ไข:** ใช้ optimistic locking หรือ SELECT FOR UPDATE

---

### 6. Invoice Number Race Condition

**ไฟล์:** `src/actions/sales.ts` line 183-192

```typescript
const lastSale = await tx.sale.findFirst({
  where: { shopId: ctx.shopId },
  orderBy: { createdAt: "desc" },
});
const lastNumber = lastSale
  ? parseInt(lastSale.invoiceNumber.split("-")[1] || "0")
  : 0;
const invoiceNumber = `INV-${String(lastNumber + 1).padStart(5, "0")}`;
```

**ความเสี่ยง:**

- 2 users สร้าง sale พร้อมกัน → เลข invoice ซ้ำ
- จริงๆ มี `@@unique([userId, invoiceNumber])` แต่จะ error แทนที่จะ retry

---

### 7. Rate Limiter Memory Leak Risk

**ไฟล์:** `src/middleware.ts` line 18

```typescript
const rateLimitMap = new Map<string, RateLimitEntry>();
```

**ความเสี่ยง:**

- ใน serverless environment (Vercel) memory จะ reset ทุก cold start
- Rate limiting อาจไม่ทำงานข้าม instances
- ตัว cleanup มีแต่ไม่ persistent

**แนะนำ:** ใช้ Redis หรือ Upstash สำหรับ production

---

### 8. Stock Service Missing shopId

**ไฟล์:** `src/lib/stock-service.ts` line 69-81

```typescript
await prisma.stockLog.create({
  data: {
    // ...
    userId,
    // ❌ Missing shopId!
  },
});
```

**ความเสี่ยง:**

- Stock logs ไม่มี shopId ทำให้ query ช้า (ต้อง join)
- RBAC filtering ต้องผ่าน product relation

---

## 🟢 Low Issues (ควรปรับปรุง)

### 9. Type Casting with `any`

หลายไฟล์มีการ cast เป็น `any`:

```typescript
// dashboard.ts line 44
(db as any).income.aggregate({...})

// reports.ts line 88
(db as any).income.findMany({...})
```

**สาเหตุ:** Prisma generate ไม่ครบ หรือ Income model ไม่ recognized

---

### 10. Deprecated Function Still Used

**ไฟล์:** `src/actions/suppliers.ts` line 85

```typescript
const userId = await getCurrentUserId(); // ❌ Deprecated
```

**แนะนำ:** ใช้ `ctx.userId` จาก `requirePermission()`

---

### 11. Missing Error Logging

บาง functions ใช้ `console.error` แทน `logger.error`:

- `expenses.ts` - ใช้ console.error
- `incomes.ts` - ใช้ console.error
- `customers.ts` - ใช้ console.error

**แนะนำ:** ใช้ `logger.error` เพื่อ persist logs

---

### 12. OCR Error Handling

**ไฟล์:** `src/lib/ocr/extract-receipt.ts` (29KB)

ไฟล์ใหญ่มาก อาจมี error handling ไม่ครบ

- ถ้า AI ตอบ format ผิด → crash?
- ถ้า network timeout → retry logic?

---

## � Frontend Security Issues

### 13. File Upload Missing Server Validation

**ไฟล์:** `src/components/ui/file-upload.tsx` line 75

```typescript
accept = "image/*,application/pdf"; // Client-only validation
```

**ความเสี่ยง:** Client-side validation ถูก bypass ได้ผ่าน DevTools

**แนะนำ:** เพิ่ม server-side validation ใน upload handler

---

### 14. Client-Only Permission Guards

**ไฟล์:** `src/components/auth/permission-guard.tsx`

**สถานะ:** ✅ Safe - Server actions ใช้ `requirePermission()` ซ้ำ

---

### 15. dangerouslySetInnerHTML

**ไฟล์:** `src/components/seo/json-ld.tsx`

**สถานะ:** ✅ Safe - ใช้สำหรับ JSON-LD SEO เท่านั้น

---

### 16. UX: alert() Instead of Toast

**ไฟล์:** `sale-form.tsx`, `pos-interface.tsx`

**ปัญหา:** `alert()` บล็อก UI thread, UX ไม่ดี

**แนะนำ:** ใช้ toast notification (sonner)

---

### 17. Form Input Disabled Manipulation

**ไฟล์:** `product-form.tsx` line 189

**สถานะ:** ✅ Safe - Server ignores stock from edit form

---

### 18. CSRF Protection

**สถานะ:** ✅ Safe - Next.js Server Actions มี built-in CSRF protection

---

### 19. POS Stock Real-time Sync

**ไฟล์:** `pos-interface.tsx` line 67-86

**ความเสี่ยง:** 2 terminals ขายสินค้าเดียวกันพร้อมกัน อาจ conflict

---

### 20. Zod Schema Validation (Positive)

**สถานะ:** ✅ ดี - มี regex validation, length limits, type enforcement

---

## �📋 Priority Fix Matrix

| Priority | Issue                   | File                     | Effort |
| -------- | ----------------------- | ------------------------ | ------ |
| 🔴 P0    | RBAC Bypass             | expenses.ts              | Low    |
| 🔴 P0    | Hard Delete             | expenses.ts, incomes.ts  | Low    |
| 🔴 P0    | Unique Constraint       | schema.prisma            | Medium |
| 🟡 P1    | Stock Race Condition    | sales.ts                 | Medium |
| 🟡 P1    | Invoice Race            | sales.ts                 | Medium |
| 🟡 P1    | stockLog missing shopId | stock-service.ts         | Low    |
| 🟢 P2    | Type any                | dashboard.ts, reports.ts | Low    |
| 🟢 P2    | Deprecated function     | suppliers.ts             | Low    |
| 🟢 P2    | Error logging           | multiple                 | Low    |

---

## 🔧 Quick Fixes (สามารถทำได้ทันที)

### Fix 1: expenses.ts RBAC

```diff
- where: { id, userId: ctx.userId, deletedAt: null }
+ where: { id, shopId: ctx.shopId, deletedAt: null }
```

### Fix 2: Soft Delete

```diff
- await db.expense.delete({ where: { id } });
+ await db.expense.update({
+   where: { id },
+   data: { deletedAt: new Date() },
+ });
```

### Fix 3: Stock Service shopId

```diff
  await prisma.stockLog.create({
    data: {
      // ...existing fields
      userId,
+     shopId: ctx?.shopId, // Pass from caller
    },
  });
```

---

ต้องการให้ทำ Quick Fixes ทันทีไหม หรือบันทึกไว้ทำพรุ่งนี้?
