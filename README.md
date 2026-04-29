# Shop Inventory ERP

ระบบ ERP สำหรับร้านค้า เขียนด้วย Next.js 14 App Router ใช้ PostgreSQL เป็นฐานข้อมูล และ Prisma เป็น ORM

---

## สารบัญ

- [ภาพรวม](#ภาพรวม)
- [โมดูลที่มีในระบบ](#โมดูลที่มีในระบบ)
- [สถาปัตยกรรมโค้ด](#สถาปัตยกรรมโค้ด)
- [โครงสร้างโฟลเดอร์](#โครงสร้างโฟลเดอร์)
- [ความต้องการของระบบ](#ความต้องการของระบบ)
- [การติดตั้งและรัน](#การติดตั้งและรัน)
- [การรันด้วย Docker](#การรันด้วย-docker)
- [ตัวแปรสภาพแวดล้อม](#ตัวแปรสภาพแวดล้อม)
- [คำสั่ง npm](#คำสั่ง-npm)
- [ระบบสิทธิ์](#ระบบสิทธิ์)
- [แนวทางการเขียนโค้ด](#แนวทางการเขียนโค้ด)
- [การทดสอบ](#การทดสอบ)
- [Backfill Scripts](#backfill-scripts)
- [Electron](#electron)

---

## ภาพรวม

ระบบนี้ทำงานครอบคลุมด้าน:

- การขายสินค้า ทั้งแบบ POS และออกเอกสารผ่าน ERP
- ติดตามสต็อกสินค้าข้ามหลาย Warehouse
- ออกใบกำกับภาษีและรายงาน ภ.พ.30
- บันทึกรายรับ-รายจ่าย และดูรายงานกำไรขาดทุน
- วงจรเอกสาร: ใบเสนอราคา > ใบสั่งขาย > ใบแจ้งหนี้ > รับชำระ

**Stack ที่ใช้**

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI |
| Backend | Next.js Server Actions, Prisma ORM |
| Database | PostgreSQL 16 |
| Auth | NextAuth v5 (Credentials + RBAC) |
| Storage | Supabase Storage |
| AI | Groq (LLaMA) |
| Cache | Upstash Redis |

---

## โมดูลที่มีในระบบ

### การขาย

- สร้างบิลขาย ออกใบกำกับภาษี รับชำระเงิน
- ส่วนลดได้ทั้งระดับบิลและระดับรายการ แบบจำนวนเงินหรือเปอร์เซ็นต์
- มีระบบ Booking สต็อก ก่อนตัดจริงตอนปิดบิล
- บันทึก Audit Log ทุก Action

### การจัดซื้อ

- สร้างใบสั่งซื้อ รับสินค้าเข้าสต็อก
- เชื่อมกับ Supplier และติดตามสถานะการส่งของ
- บันทึกต้นทุนสินค้าเพื่อคำนวณกำไร

### สินค้าคงคลัง

- แยกสต็อกตาม Warehouse ได้
- บันทึก Stock Movement ทุกความเคลื่อนไหว
- ปรับสต็อกและ Reconcile กับจำนวนจริงได้

### บัญชีและการเงิน

- บันทึกบัญชีคู่ (Double-Entry) จาก Transaction อัตโนมัติ
- Chart of Accounts กำหนดเองได้
- รายงานกำไรขาดทุนและงบทดลอง

### ภาษี

- คำนวณ VAT แบบ Inclusive และ Exclusive ต่อ Line Item
- รายงาน ภ.พ.30 (ภาษีขายและภาษีซื้อ)
- ลำดับความสำคัญ Tax Code: สินค้า > ลูกค้า > ค่าเริ่มต้นร้าน

### เอกสาร

- ใบเสนอราคา
- ใบแจ้งหนี้ พร้อม PDF export
- ใบส่งของ
- ใบรับคืนสินค้า

### อื่น ๆ

- AI Assistant สำหรับถามข้อมูลในระบบด้วยภาษาธรรมชาติ
- ระบบขออนุมัติก่อนดำเนินการ
- POS Mode สำหรับขายหน้าเคาน์เตอร์

---

## สถาปัตยกรรมโค้ด

### การไหลของข้อมูล

```
UI Component
    |
    v
Server Action  (src/actions/[module]/[action].ts)
    |
    v
Service Layer  (src/services/[module]/[service].ts)
    |
    v
Prisma ORM     (src/lib/db.ts)
    |
    v
PostgreSQL
```

### 3 ชั้นหลัก

**1. Server Actions**

รับ Input จาก UI, validate ด้วย Zod Schema และเรียก Service ทุก Action ต้องถูกหุ้มด้วย `handleAction()` เพื่อให้ Error Response มีรูปแบบเดียวกันทั้งระบบ

```typescript
// src/actions/sales/create-sale.action.ts
export const createSaleAction = async (data: CreateSaleInput) => {
    return handleAction(async (ctx) => {
        return SaleService.create(ctx, data);
    });
};
```

**2. Service Layer**

Business Logic ทั้งหมดอยู่ที่นี่ ไม่เขียน Business Logic ใน UI Component หรือ Server Action โดยตรง

- `SaleService` — วงจรชีวิตของบิลขาย
- `InvoiceService` — ใบแจ้งหนี้และการ Post บัญชี
- `StockService` / `StockEngine` — ตัดสต็อก, จอง, ปล่อย
- `PostingService` — แปลง Transaction เป็น Journal Entry
- `TaxResolutionService` — หา Tax Code ต่อ Line Item

**3. Core Services**

| Service | หน้าที่ |
|---------|---------|
| `Security` | ตรวจสิทธิ์ก่อน Operation |
| `WorkflowService` | ตรวจ State Machine ว่า Action ทำได้ไหม |
| `AuditLog` | บันทึก Snapshot ก่อน-หลัง ทุก Mutation |
| `IAMService` | จัดการ User, Role, Permission |
| `SequenceService` | สร้างเลขเอกสาร |

### Type สำคัญ

**RequestContext** — ข้อมูล Session ที่ส่งต่อระหว่าง Service เพื่อไม่ให้ Query ซ้ำ

```typescript
type RequestContext = {
    shopId: string;
    userId: string;
    memberId: string;
    permissions: Permission[];
    isOwner: boolean;
};
```

**MutationResult** — รูปแบบที่ Service Mutation ส่งกลับ

```typescript
type MutationResult<T> = {
    data: T;
    affectedTags: string[];
};
```

**SaleMapper** — แปลง DB Row เป็น DTO โดยรวม Child Tables (SaleStatus, SaleTaxSummary, SalePaymentDetail) ให้ UI ได้รับเป็น Flat Object เสมอ

---

## โครงสร้างโฟลเดอร์

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login, Register
│   ├── (dashboard)/            # หน้าหลักทั้งหมด
│   │   ├── sales/
│   │   ├── purchases/
│   │   ├── inventory/
│   │   ├── accounting/
│   │   ├── invoices/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── tax/
│   │   ├── reports/
│   │   ├── warehouse/
│   │   ├── approvals/
│   │   ├── returns/
│   │   ├── shipments/
│   │   ├── quotations/
│   │   ├── order-requests/
│   │   ├── expenses/
│   │   ├── incomes/
│   │   ├── ai/
│   │   └── settings/
│   ├── (pos)/                  # POS Mode
│   └── (admin)/                # Admin System
│
├── actions/                    # Server Actions
│   ├── sales/
│   ├── purchases/
│   ├── inventory/
│   ├── accounting/
│   └── ...
│
├── services/                   # Business Logic
│   ├── sales/
│   │   ├── sale.service.ts
│   │   └── invoice.service.ts
│   ├── purchases/
│   ├── inventory/
│   │   ├── stock.service.ts
│   │   └── stock-engine.ts
│   ├── accounting/
│   │   ├── posting-engine.service.ts
│   │   ├── journal.service.ts
│   │   └── payment.service.ts
│   ├── tax/
│   │   ├── tax-resolution.service.ts
│   │   └── tax-calculation.service.ts
│   └── core/
│       ├── iam/
│       │   ├── security.service.ts
│       │   └── iam.service.ts
│       ├── workflow/
│       │   └── workflow.service.ts
│       └── system/
│           └── sequence.service.ts
│
├── schemas/                    # Zod Validation Schemas
│   ├── sale-form.ts
│   ├── purchase-form.ts
│   └── ...
│
├── lib/
│   ├── db.ts                   # Prisma Client
│   ├── lock-helpers.ts         # Sale Lock Status
│   ├── money.ts                # Decimal helpers
│   ├── audit-log.ts            # AuditLog writer
│   └── mappers/
│       └── sales.mapper.ts
│
├── types/
│   ├── domain.ts
│   └── dtos/
│
├── config/
│   ├── cache-tags.ts
│   └── reason-codes.ts
│
└── scripts/                    # Backfill, Migration

prisma/
├── schema.prisma               # Database Schema
├── seed.ts
└── dbml/                       # Auto-generated DBML
```

---

## ความต้องการของระบบ

| ซอฟต์แวร์ | เวอร์ชัน |
|-----------|---------|
| Node.js | >= 18.x |
| npm | >= 9.x |
| PostgreSQL | >= 14 |

---

## การติดตั้งและรัน

### 1. Clone และติดตั้ง

```bash
git clone <repository-url>
cd shop-inventory
npm install
```

### 2. ตั้งค่า Environment Variables

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env` ตามส่วน [ตัวแปรสภาพแวดล้อม](#ตัวแปรสภาพแวดล้อม)

### 3. เตรียมฐานข้อมูล

```bash
npm run db:push
npm run db:seed
```

### 4. รัน Development Server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

ครั้งแรกระบบจะพาไปหน้า Onboarding เพื่อตั้งค่าร้านและบัญชีผู้ใช้

---

## การรันด้วย Docker

```bash
cp .env.example .env
# แก้ไข .env ให้ครบ

docker compose up -d
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed
```

คำสั่งอื่นที่ใช้บ่อย:

```bash
# หยุด Container
docker compose down

# หยุดและลบ Volume (ข้อมูลในฐานข้อมูลจะหาย)
docker compose down -v

# Build ใหม่
docker compose up --build -d
```

---

## ตัวแปรสภาพแวดล้อม

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/shop_inventory?schema=public"

# NextAuth
AUTH_SECRET="..."
AUTH_URL="http://localhost:3000"

# Supabase (File Storage)
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# AI (Groq)
GROQ_API_KEY="..."

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

---

## คำสั่ง npm

```bash
npm run dev           # รัน Development Server
npm run build         # Build Production
npm start             # รัน Production Server

npx tsc --noEmit      # ตรวจ TypeScript errors

# Database
npm run db:push       # Sync schema ไป DB
npm run db:studio     # เปิด Prisma Studio
npm run db:seed       # Seed ข้อมูลตั้งต้น
npm run db:generate   # Re-generate Prisma Client

# Testing
npm test              # Watch mode
npm run test:run      # รันครั้งเดียว
npm run test:coverage # พร้อม Coverage

# Electron
npm run electron:dev
npm run electron:build
npm run electron:pack
```

---

## ระบบสิทธิ์

### โครงสร้าง

```
Shop
 └── ShopMember
      └── Role
           └── Permission[]
```

### ตัวอย่าง Permission

| Permission | หมายความว่า |
|-----------|------------|
| `SALE_VIEW` | ดูรายการขาย |
| `SALE_CREATE` | สร้างบิลขาย |
| `SALE_VIEW_PROFIT` | ดูกำไรในรายการขาย |
| `SALE_EDIT_LOCKED` | แก้บิลที่ถูก Lock |
| `INVOICE_POST` | Post ใบแจ้งหนี้ลงบัญชี |
| `STOCK_ADJUST` | ปรับสต็อก |
| `REPORT_VIEW_PROFIT` | ดูรายงานกำไร |

### การตรวจสิทธิ์

```typescript
// ใน Service Layer
Security.require(ctx, Permission.SALE_VIEW_PROFIT);

// ใน Server Component
const canViewProfit = ctx.permissions.includes(Permission.SALE_VIEW_PROFIT) || ctx.isOwner;
```

---

## แนวทางการเขียนโค้ด

### Single Source of Truth

- Zod Schema และ Default Values อยู่ที่ `src/schemas/[feature]-form.ts`
- Business Logic ซับซ้อนอยู่ใน Service Layer เสมอ
- Lock Status ของ Sale อ่านผ่าน `resolveLocked()` เขียนผ่าน `buildLockData()`

### Service Layer

- ทุก Query ใช้ Optional Chaining เพื่อป้องกัน runtime crash
- ทุก Server Action ต้องหุ้มด้วย `handleAction()`

### Audit

- ทุก Mutation บันทึก `beforeSnapshot` และ `afterSnapshot`
- ดู Audit Log ได้ที่ `/system/audit`

### Snapshot

- ข้อมูลที่ Snapshot ตอนออกเอกสาร (ชื่อลูกค้า, Tax Rate, ราคา) ไม่แก้หลัง Post
- ใบแจ้งหนี้ที่ Post แล้วต้องออก Credit Note แทนการแก้ตรง

---

## การทดสอบ

Tests อยู่ใน `src/__tests__/` และ `src/services/**/__tests__/` ใช้ Vitest + Testing Library

```bash
npm run test:run
npm run test:coverage
```

---

## Backfill Scripts

Scripts สำหรับ Data Migration อยู่ใน `src/scripts/`

```bash
# Backfill Sale Child Tables
npx ts-node -r tsconfig-paths/register src/scripts/backfill-sale-child-tables.ts

# Reconcile Stock Cache
npx ts-node -r tsconfig-paths/register src/scripts/reconcile-stock-cache.ts
```

---

## Electron

รองรับการ build เป็น Desktop App สำหรับ Windows ผ่าน Electron

```bash
npm run electron:dev
npm run electron:build   # สร้าง .exe installer
npm run electron:pack    # build โดยไม่ package
```

Config อยู่ที่ `electron/` และ `electron-builder.yml`
