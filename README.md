# Shop Inventory ERP

ระบบบริหารจัดการธุรกิจ (ERP) สำหรับร้านค้า ครอบคลุมตั้งแต่การขาย การจัดซื้อ การจัดการสต็อก ไปจนถึงการบัญชีและรายงานภาษี พัฒนาด้วย Next.js 14 App Router บนสถาปัตยกรรม Server Actions และ Service Layer แบบ Clean Architecture

---

## สารบัญ

- [ภาพรวมระบบ](#ภาพรวมระบบ)
- [โมดูลหลัก](#โมดูลหลัก)
- [สถาปัตยกรรมโค้ด](#สถาปัตยกรรมโค้ด)
- [โครงสร้างโฟลเดอร์](#โครงสร้างโฟลเดอร์)
- [ความต้องการของระบบ](#ความต้องการของระบบ)
- [การติดตั้งและรัน (Development)](#การติดตั้งและรัน-development)
- [การรันด้วย Docker](#การรันด้วย-docker)
- [ตัวแปรสภาพแวดล้อม](#ตัวแปรสภาพแวดล้อม)
- [คำสั่ง npm ที่ใช้บ่อย](#คำสั่ง-npm-ที่ใช้บ่อย)
- [ระบบสิทธิ์ (RBAC)](#ระบบสิทธิ์-rbac)
- [หลักการออกแบบโค้ด](#หลักการออกแบบโค้ด)
- [การทดสอบ](#การทดสอบ)

---

## ภาพรวมระบบ

ระบบนี้ออกแบบมาสำหรับร้านค้าที่ต้องการ:

- ขายสินค้าผ่านหน้าร้าน (POS) หรือออกบิลแบบ ERP
- ติดตามสต็อกแบบ Real-time ข้ามหลาย Warehouse
- ออกใบกำกับภาษีมูลค่าเพิ่ม (Tax Invoice) ตามมาตรฐาน ภ.พ.30
- บันทึกรายรับ-รายจ่าย และดูรายงานกำไรขาดทุน
- จัดการวงจรเอกสารครบวงจร: ใบเสนอราคา > ใบสั่งขาย > ใบแจ้งหนี้ > รับชำระ

**Stack หลัก**

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI |
| Backend | Next.js Server Actions, Prisma ORM |
| Database | PostgreSQL 16 (Supabase หรือ self-hosted) |
| Auth | NextAuth v5 (Credentials + RBAC) |
| Storage | Supabase Storage (ใบเสร็จ, หลักฐานการชำระ) |
| AI | Groq (LLaMA) สำหรับ AI Assistant |
| Cache | Upstash Redis (Rate Limit + Cache Tags) |

---

## โมดูลหลัก

### การขาย (Sales)
- สร้างบิลขาย ออกใบกำกับภาษี รับชำระเงิน
- รองรับส่วนลด (บิลและรายการ) ทั้งแบบจำนวนเงินและเปอร์เซ็นต์
- ระบบ Booking สต็อก — จองก่อนตัดจริงเมื่อปิดบิล
- ประวัติการแก้ไขและ Audit Log ครบทุก Action

### การจัดซื้อ (Purchases)
- สร้างใบสั่งซื้อ (PO) รับสินค้าเข้าสต็อก
- เชื่อมกับ Supplier และติดตามสถานะการส่งของ
- บันทึกต้นทุนสินค้าเพื่อคำนวณกำไรต่อชิ้น

### สินค้าคงคลัง (Inventory)
- ระบบ Multi-Warehouse: แยกสต็อกตาม Warehouse ได้
- Stock Movement Log: บันทึกทุกความเคลื่อนไหว (รับเข้า/ขายออก/โอนย้าย/คืนสินค้า)
- แจ้งเตือน Low Stock อัตโนมัติ
- Reconcile: ปรับสต็อกจริงกับระบบ

### บัญชีและการเงิน (Accounting)
- บันทึกบัญชีคู่ (Double-Entry Journal) อัตโนมัติจาก Transaction
- Chart of Accounts (COA) กำหนดเองได้
- รายงานกำไรขาดทุน (P&L), งบทดลอง (Trial Balance)
- Posting Engine: แปลง Sale/Invoice/Payment เป็น Journal Entry อัตโนมัติ

### ภาษี (Tax)
- คำนวณ VAT แบบ Inclusive/Exclusive ต่อ Line Item
- ออกรายงาน ภ.พ.30 (ภาษีขาย/ภาษีซื้อ)
- Tax Resolution Priority Chain: สินค้า > ลูกค้า > ค่าเริ่มต้นร้าน

### เอกสาร
- ใบเสนอราคา (Quotation)
- ใบแจ้งหนี้ (Invoice) พร้อม PDF export
- ใบส่งของ (Delivery Order)
- ใบรับคืนสินค้า (Return)

### ระบบสนับสนุน
- **AI Assistant**: ถามตอบเกี่ยวกับข้อมูลในระบบด้วยภาษาธรรมชาติ
- **Approvals**: ระบบขออนุมัติก่อนดำเนินการ
- **Audit Log**: บันทึกทุก Action พร้อม Snapshot ก่อน-หลัง
- **POS Mode**: หน้าร้านแบบง่าย สำหรับขายหน้าเคาน์เตอร์

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
ทำหน้าที่รับ Input จาก UI, validate ด้วย Zod Schema, เรียก Service และส่ง Response กลับ ทุก Action ต้องถูกหุ้มด้วย `handleAction()` เพื่อ standardize Error Handling

```typescript
// src/actions/sales/create-sale.action.ts
export const createSaleAction = async (data: CreateSaleInput) => {
    return handleAction(async (ctx) => {
        return SaleService.create(ctx, data);
    });
};
```

**2. Service Layer**
Business Logic ทั้งหมดอยู่ที่นี่ ห้ามมี Business Logic ใน UI Component หรือ Server Action โดยตรง

- `SaleService` — วงจรชีวิตของบิลขาย
- `InvoiceService` — ออกใบแจ้งหนี้และ Post บัญชี
- `StockService` / `StockEngine` — ตัดสต็อก, จอง, ปล่อย
- `PostingService` — แปลง Transaction เป็น Journal Entry
- `TaxResolutionService` — หา Tax Code ที่เหมาะสมต่อ Line

**3. Core Services (Cross-cutting)**

| Service | หน้าที่ |
|---------|---------|
| `Security` | ตรวจสิทธิ์ก่อนทุก Operation |
| `WorkflowService` | ตรวจ State Machine ว่า Action ทำได้ไหม |
| `AuditLog` | บันทึก Snapshot ก่อน-หลัง ทุก Mutation |
| `IAMService` | จัดการ User, Role, Permission |
| `SequenceService` | สร้างเลขเอกสาร (INV-XXXXXX) |

### Pattern สำคัญ

**RequestContext** — ส่งต่อข้อมูล Session ระหว่าง Service โดยไม่ Query ซ้ำ
```typescript
type RequestContext = {
    shopId: string;
    userId: string;
    memberId: string;
    permissions: Permission[];
    isOwner: boolean;
};
```

**MutationResult** — ทุก Service Mutation ส่งกลับ format เดียวกัน
```typescript
type MutationResult<T> = {
    data: T;
    affectedTags: string[];  // สำหรับ revalidatePath
};
```

**SaleMapper** — แปลง Database Row เป็น DTO โดยรวม Child Tables (SaleStatus, SaleTaxSummary, SalePaymentDetail) ให้ UI ได้รับ Flat Object เสมอ ไม่ว่า DB จะ normalize อย่างไร

---

## โครงสร้างโฟลเดอร์

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login, Register
│   ├── (dashboard)/            # หน้าหลักทั้งหมด
│   │   ├── sales/              # หน้าจัดการการขาย
│   │   ├── purchases/          # หน้าจัดซื้อ
│   │   ├── inventory/          # หน้าสินค้าคงคลัง
│   │   ├── accounting/         # หน้าบัญชี
│   │   ├── invoices/           # หน้าใบแจ้งหนี้
│   │   ├── customers/          # หน้าลูกค้า
│   │   ├── suppliers/          # หน้า Supplier
│   │   ├── tax/                # หน้ารายงานภาษี
│   │   ├── reports/            # รายงานทั่วไป
│   │   ├── warehouse/          # จัดการคลังสินค้า
│   │   ├── approvals/          # ระบบอนุมัติ
│   │   ├── returns/            # ใบรับคืน
│   │   ├── shipments/          # ใบส่งของ
│   │   ├── quotations/         # ใบเสนอราคา
│   │   ├── order-requests/     # ใบสั่งซื้อภายใน
│   │   ├── expenses/           # รายจ่าย
│   │   ├── incomes/            # รายรับอื่น
│   │   ├── ai/                 # AI Assistant
│   │   └── settings/           # ตั้งค่าร้าน
│   ├── (pos)/                  # POS Mode (หน้าร้าน)
│   └── (admin)/                # Admin System
│
├── actions/                    # Server Actions (รับ Input จาก UI)
│   ├── sales/
│   ├── purchases/
│   ├── inventory/
│   ├── accounting/
│   └── ...
│
├── services/                   # Business Logic Layer
│   ├── sales/
│   │   ├── sale.service.ts     # บิลขาย (create, update, complete, cancel)
│   │   └── invoice.service.ts  # ใบแจ้งหนี้ (createFromSale, post, cancel)
│   ├── purchases/
│   ├── inventory/
│   │   ├── stock.service.ts    # ตัดสต็อก, จอง, ปล่อย
│   │   └── stock-engine.ts     # Core Movement Engine
│   ├── accounting/
│   │   ├── posting-engine.service.ts  # แปลง Transaction → Journal
│   │   ├── journal.service.ts         # บันทึกรายการบัญชี
│   │   └── payment.service.ts         # รับชำระเงิน
│   ├── tax/
│   │   ├── tax-resolution.service.ts  # หา Tax Code
│   │   └── tax-calculation.service.ts # คำนวณภาษี
│   └── core/
│       ├── iam/
│       │   ├── security.service.ts    # ตรวจสิทธิ์
│       │   └── iam.service.ts         # จัดการ User/Role
│       ├── workflow/
│       │   └── workflow.service.ts    # State Machine Guard
│       └── system/
│           └── sequence.service.ts    # สร้างเลขเอกสาร
│
├── schemas/                    # Zod Validation Schemas (SSOT)
│   ├── sale-form.ts
│   ├── purchase-form.ts
│   └── ...
│
├── lib/
│   ├── db.ts                   # Prisma Client Instance
│   ├── lock-helpers.ts         # Sale Lock Status SSOT
│   ├── money.ts                # Helper แปลง Decimal
│   ├── audit-log.ts            # AuditLog Writer
│   └── mappers/
│       └── sales.mapper.ts     # Sale → DTO (Mapper Shield Pattern)
│
├── types/
│   ├── domain.ts               # Type หลัก (RequestContext, ServiceError, ...)
│   └── dtos/                   # Data Transfer Objects
│
├── config/
│   ├── cache-tags.ts           # Cache Tag Constants
│   └── reason-codes.ts         # เหตุผลสำหรับ Cancel/Void
│
└── scripts/                    # Utility Scripts (Backfill, Migrate, ...)

prisma/
├── schema.prisma               # Database Schema (source of truth)
├── seed.ts                     # Seed ข้อมูลตั้งต้น
└── dbml/                       # Auto-generated DBML Diagram
```

---

## ความต้องการของระบบ

| ซอฟต์แวร์ | เวอร์ชันที่รองรับ |
|-----------|------------------|
| Node.js | >= 18.x |
| npm | >= 9.x |
| PostgreSQL | >= 14 (แนะนำ 16) |

---

## การติดตั้งและรัน (Development)

### ขั้นที่ 1 — Clone และติดตั้ง Dependencies

```bash
git clone <repository-url>
cd shop-inventory
npm install
```

### ขั้นที่ 2 — ตั้งค่า Environment Variables

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env` ให้ครบตามส่วน [ตัวแปรสภาพแวดล้อม](#ตัวแปรสภาพแวดล้อม) ด้านล่าง

### ขั้นที่ 3 — เตรียมฐานข้อมูล

```bash
# Push schema ไปยัง Database (สร้าง Table ทั้งหมด)
npm run db:push

# Seed ข้อมูลเริ่มต้น (ตั้งค่าระบบ, lookup values)
npm run db:seed
```

### ขั้นที่ 4 — รัน Development Server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) ในเบราว์เซอร์

### ขั้นที่ 5 — สร้าง Shop แรก

ระบบจะพาไปหน้า Onboarding สำหรับตั้งค่าร้านค้าและบัญชีผู้ใช้แรกโดยอัตโนมัติ

---

## การรันด้วย Docker

เหมาะสำหรับการรันบน Server หรือทดสอบ Production Environment บน Local

### ขั้นที่ 1 — เตรียมไฟล์ Environment

```bash
cp .env.example .env
# แก้ไข .env ให้ครบ (ดูส่วน ตัวแปรสภาพแวดล้อม)
```

### ขั้นที่ 2 — Build และรัน

```bash
# รัน Application + Database พร้อมกัน
docker compose up

# รันใน Background
docker compose up -d

# หยุดและลบ Container (ข้อมูลใน Volume ยังอยู่)
docker compose down

# หยุดและลบทุกอย่างรวม Volume (ข้อมูลจะหายทั้งหมด)
docker compose down -v
```

### ขั้นที่ 3 — Push Schema และ Seed (ครั้งแรก)

```bash
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed
```

Application จะอยู่ที่ [http://localhost:3000](http://localhost:3000)

---

## ตัวแปรสภาพแวดล้อม

สร้างไฟล์ `.env` จาก `.env.example` และกรอกค่าดังนี้:

```env
# ---- Database ----
# สำหรับ Development (self-hosted PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/shop_inventory?schema=public"

# สำหรับ Production (Supabase)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?schema=public"

# ---- NextAuth ----
AUTH_SECRET="สร้างด้วย: openssl rand -base64 32"
AUTH_URL="http://localhost:3000"

# ---- Supabase (สำหรับ File Storage) ----
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# ---- AI (Groq) ----
GROQ_API_KEY="..."

# ---- Upstash Redis (Rate Limit + Cache) ----
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

**หมายเหตุ:**
- `SUPABASE_SERVICE_ROLE_KEY` ใช้สำหรับ Upload File ฝั่ง Server เท่านั้น ห้าม Expose ทาง Client
- ถ้าไม่มี Groq API Key ระบบ AI จะไม่ทำงาน แต่ฟีเจอร์อื่นทำงานได้ตามปกติ
- ถ้าไม่มี Upstash Redis ระบบจะ Bypass Rate Limit และใช้ Revalidation แบบ On-demand แทน

---

## คำสั่ง npm ที่ใช้บ่อย

```bash
# รัน Development Server
npm run dev

# Build Production
npm run build

# รัน Production Server (หลัง build แล้ว)
npm start

# ตรวจ TypeScript Errors
npx tsc --noEmit

# ---- Prisma (Database) ----

# Sync Schema ไปยัง DB (ใช้ระหว่าง Dev)
npm run db:push

# เปิด Prisma Studio (GUI จัดการ DB)
npm run db:studio

# Seed ข้อมูลตั้งต้น
npm run db:seed

# Re-generate Prisma Client หลังแก้ Schema
npm run db:generate

# ---- Testing ----

# รัน Unit Tests (Watch mode)
npm test

# รัน Tests ครั้งเดียว
npm run test:run

# รัน Tests พร้อม Coverage Report
npm run test:coverage

# ---- Electron (Desktop App) ----

# รัน Electron Dev Mode
npm run electron:dev

# Build Windows Installer
npm run electron:build
```

---

## ระบบสิทธิ์ (RBAC)

ระบบใช้ Role-Based Access Control แบบ Fine-grained

### โครงสร้าง

```
Shop
 └── ShopMember (User ที่อยู่ใน Shop)
      └── Role (เช่น Owner, Manager, Cashier)
           └── Permission[] (เช่น SALE_VIEW, SALE_CREATE, SALE_VIEW_PROFIT)
```

### ตัวอย่าง Permission

| Permission | ความหมาย |
|-----------|----------|
| `SALE_VIEW` | ดูรายการขาย |
| `SALE_CREATE` | สร้างบิลขาย |
| `SALE_VIEW_PROFIT` | ดูกำไรในรายการขาย (Sensitive) |
| `SALE_EDIT_LOCKED` | แก้บิลที่ถูก Lock แล้ว |
| `INVOICE_POST` | Post ใบแจ้งหนี้ลงบัญชี |
| `STOCK_ADJUST` | ปรับสต็อก Manual |
| `REPORT_VIEW_PROFIT` | ดูรายงานกำไร |

### การตรวจสิทธิ์ในโค้ด

```typescript
// ใน Service Layer
Security.require(ctx, Permission.SALE_VIEW_PROFIT);

// ใน UI (Server Component)
const canViewProfit = ctx.permissions.includes(Permission.SALE_VIEW_PROFIT) || ctx.isOwner;
```

---

## หลักการออกแบบโค้ด

โปรเจคนี้ยึดถือหลักการต่อไปนี้อย่างเคร่งครัด:

### 1. Single Source of Truth (SSOT)

- Schema validation และ Default Values อยู่ที่ `src/schemas/[feature]-form.ts` เท่านั้น
- Business Logic ซับซ้อนต้องอยู่ใน Service Layer เสมอ ห้ามอยู่ใน UI Component
- Lock Status ของ Sale อ่านผ่าน `resolveLocked()` และเขียนผ่าน `buildLockData()` เสมอ

### 2. Safe Service Layer

- ทุก Service Query ใช้ Optional Chaining เพื่อป้องกันหน้าเว็บขาว
- ทุก Server Action ต้องถูกหุ้มด้วย `handleAction()` สำหรับ standardized Error Response

### 3. Deep Audit

- ทุก Mutation (Create, Update, Delete) บันทึก `beforeSnapshot` และ `afterSnapshot`
- ตรวจสอบ Audit Log ได้จาก `/system/audit` ใน Admin Panel

### 4. Immutable Snapshots

- ข้อมูลที่ Snapshot ณ เวลาออกเอกสาร (ชื่อลูกค้า, Tax Rate, ราคา) ห้ามแก้หลัง Post
- ใบแจ้งหนี้ที่ Post แล้วต้องทำ Credit Note แทนการแก้ตรง

---

## การทดสอบ

Unit Tests อยู่ใน `src/__tests__/` และ `src/services/**/__tests__/`

```bash
# รัน Tests ทั้งหมด
npm run test:run

# ดู Coverage
npm run test:coverage
```

ใช้ Vitest + Testing Library และ jsdom สำหรับ Component Tests

---

## Backfill Scripts

Script สำหรับ Migration ข้อมูลอยู่ใน `src/scripts/`

```bash
# Backfill Sale Child Tables (SaleStatus, SaleTaxSummary, SalePaymentDetail)
npx ts-node -r tsconfig-paths/register src/scripts/backfill-sale-child-tables.ts

# Reconcile Stock Cache
npx ts-node -r tsconfig-paths/register src/scripts/reconcile-stock-cache.ts
```

---

## Electron (Desktop Application)

ระบบรองรับการ Package เป็น Desktop Application สำหรับ Windows ด้วย Electron

```bash
# รัน Dev Mode
npm run electron:dev

# Build Windows Installer (.exe)
npm run electron:build

# Build โดยไม่ Package (สำหรับทดสอบ)
npm run electron:pack
```

ไฟล์ config ของ Electron อยู่ที่ `electron/` และ `electron-builder.yml`
