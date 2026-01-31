# 📋 Database Architecture Issues - TODO

> สร้างเมื่อ: 2026-01-30  
> อัพเดท: 2026-01-31  
> สถานะ: ✅ แก้ไขเรียบร้อย

---

## ✅ Critical Issues (RESOLVED)

### 1. Mixed Ownership Model (userId vs shopId) - ✅ FIXED

**ปัญหา (เดิม):**

```prisma
// Product model
@@unique([userId, sku])  // constraint ใช้ userId
```

แต่ queries ใช้:

```typescript
where: {
  shopId: ctx.shopId;
} // query ใช้ shopId
```

**แก้ไขแล้ว (2026-01-31):**

```prisma
// เปลี่ยนเป็น:
@@unique([shopId, sku])
@@unique([shopId, invoiceNumber])  // สำหรับ Sale
```

---

### 2. Soft Delete + Unique Constraint Conflict - ✅ HANDLED

**ปัญหา:**

- Products ที่ถูก "ลบ" (`isActive: false`) ยังคงอยู่ใน DB
- `@@unique([userId, sku])` ยังคงบังคับใช้
- `createMany` กับ `skipDuplicates` → ข้ามทั้งหมด

**แก้ไขที่ทำแล้ว:** ✅

- `batchCreateProducts` reactivate products ที่ inactive
- เปลี่ยน unique constraint เป็น shopId-based

---

## ✅ Medium Issues (RESOLVED)

### 3. RBAC Transition Incomplete - ✅ FIXED

**Models ที่แก้แล้ว:**

- [x] Product: `@@unique([userId, sku])` → `@@unique([shopId, sku])`
- [x] Sale: `@@unique([userId, invoiceNumber])` → `@@unique([shopId, invoiceNumber])`
- [x] `batchCreateProducts` - แก้ไขให้ใช้ shopId แทน userId

---

### 4. Inconsistent Delete Patterns

| Model    | isActive | deletedAt | status | หมายเหตุ                   |
| -------- | -------- | --------- | ------ | -------------------------- |
| Product  | ✅       | ✅        | ❌     | ใช้ isActive + deletedAt   |
| Supplier | ❌       | ✅        | ❌     | ใช้ deletedAt              |
| Customer | ❌       | ✅        | ❌     | ใช้ deletedAt              |
| Purchase | ❌       | ✅        | ✅     | ใช้ทั้ง status + deletedAt |
| Sale     | ❌       | ✅        | ✅     | ใช้ทั้ง status + deletedAt |

**หมายเหตุ:** Pattern นี้ไม่จำเป็นต้องเปลี่ยนเพราะทำงานได้อยู่ แต่ควรพิจารณา standardize ในอนาคต

---

## ✅ Migration Completed (2026-01-31)

### Pre-Migration Check

```
📊 Current Record Counts:
   - Products: 39
   - Sales: 43
   - Purchases: 6
```

### Migration Steps Performed:

1. ✅ รัน `prisma/check-migration-conflicts.ts` - ตรวจสอบ conflicts
2. ✅ แก้ไข `schema.prisma` - เปลี่ยน unique constraints
3. ✅ แก้ไข `products.ts` - `batchCreateProducts` ใช้ shopId
4. ✅ รัน `prisma db push` - apply schema changes
5. ✅ Verify data integrity - ข้อมูลครบ ไม่มีหาย

### Post-Migration Verification

```
📊 Verified Record Counts:
   - Products: 39 ✅
   - Sales: 43 ✅
   - Purchases: 6 ✅
```

---

## 📁 Files Changed

- `prisma/schema.prisma` - Updated unique constraints
- `src/actions/products.ts` - batchCreateProducts fixed
- `prisma/check-migration-conflicts.ts` - New validation script (can be deleted)

---

_Migration completed successfully on 2026-01-31 by AI Assistant_
