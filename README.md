<p align="center">
  <h1 align="center">🏪 Shop Inventory</h1>
  <p align="center">
    Full-stack POS & Inventory Management System
    <br />
    Built with Next.js 14 · TypeScript · Prisma · PostgreSQL
    <br /><br />
    <a href="https://shop-inventory.napatdev.com">🌐 Live Demo</a>
    ·
    <a href="#features">Features</a>
    ·
    <a href="#tech-stack">Tech Stack</a>
    ·
    <a href="#getting-started">Setup</a>
  </p>
</p>

---

## About

A production-grade **Point of Sale & Inventory Management** system designed for small-to-medium retail businesses. Supports multi-tenant shops, role-based access control, AI-powered receipt scanning, and real-time stock tracking — all in a single deployable Next.js application.

### 📊 Project Stats

|                        |                                                           |
| ---------------------- | --------------------------------------------------------- |
| **Database Models**    | 22 (User, Product, Sale, Purchase, Return, Shipment, ...) |
| **Server Actions**     | 24 modules (type-safe, audit-logged)                      |
| **Feature Components** | 23 areas (POS, Reports, OCR, Team, ...)                   |
| **Test Framework**     | Vitest with unit test coverage                            |
| **Deployment**         | Vercel (Edge-compatible)                                  |

---

## Features

### 🛒 Point of Sale (POS)

- Full-screen POS optimized for tablet & desktop
- Barcode scanning for quick product lookup
- PromptPay QR code generation for mobile payments
- Thermal receipt printing (80mm)
- Slip upload & payment proof tracking

### 📦 Inventory Management

- Real-time stock tracking with movement history
- Low stock alerts with configurable thresholds
- CSV batch import with Thai/English header auto-mapping
- Barcode label generation (EAN-13, Code128)
- Optimistic locking to prevent concurrent stock conflicts

### 🧾 Sales & Purchases

- Complete sales lifecycle: create → invoice → receipt → return
- Purchase orders with supplier management
- Audit-ready cancellation (soft delete + reason logging)
- Automatic profit calculation per transaction
- Multi-payment method support (Cash, Transfer, Credit)

### 📊 Reports & Analytics

- Revenue, expense, and profit dashboards with Recharts
- Daily/monthly breakdowns
- CSV export for all reports
- Printable report formats

### 🤖 AI & OCR

- **Receipt Scanner**: Tesseract.js (client-side) + Groq AI (server-side) for structured data extraction
- **AI Chat Assistant**: Groq-powered business chatbot for product/sales queries
- **Smart Matching**: Fuzzy matching engine for products & suppliers from scanned data

### 🔐 Security & Multi-Tenancy

- **RBAC**: Granular role system (Owner → Manager → Cashier) with auto-dependency resolution
- **Multi-Tenant**: Complete data isolation per shop
- **Auth**: NextAuth.js v5 with credential + invite-based registration
- **Input Sanitization**: XSS protection on all text inputs
- **Optimistic Locking**: Prevents race conditions on financial records

### 📱 Responsive Design

- Mobile-first UI across all pages
- PWA-ready manifest
- Touch-optimized POS interface

### 🚚 Additional Modules

- Customer management with address book
- Supplier directory
- Shipment tracking with carrier integration
- Expense & income recording
- Team management & invitation system
- System health monitoring dashboard

---

## Tech Stack

| Layer          | Technology                               |
| -------------- | ---------------------------------------- |
| **Framework**  | Next.js 14 (App Router, Server Actions)  |
| **Language**   | TypeScript (Strict mode)                 |
| **Database**   | PostgreSQL                               |
| **ORM**        | Prisma 6                                 |
| **Auth**       | NextAuth.js v5                           |
| **Storage**    | Supabase Storage                         |
| **AI/OCR**     | Groq SDK (Llama), Tesseract.js           |
| **UI**         | TailwindCSS, Shadcn/UI, Radix Primitives |
| **Charts**     | Recharts                                 |
| **Validation** | Zod                                      |
| **Forms**      | React Hook Form                          |
| **Testing**    | Vitest, Testing Library                  |
| **Financial**  | Decimal.js (precision arithmetic)        |
| **Deploy**     | Vercel                                   |

---

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login, Register
│   ├── (dashboard)/        # Protected pages (products, sales, reports, ...)
│   ├── (pos)/              # Full-screen POS interface
│   └── api/                # API routes (OCR, AI, webhooks)
│
├── actions/                # 24 Server Action modules
│   ├── sales.ts            # Sale CRUD, cancellation, audit
│   ├── products.ts         # Product CRUD, batch import
│   ├── reports.ts          # Financial aggregation queries
│   └── ...
│
├── components/
│   ├── features/           # 23 feature-specific component groups
│   │   ├── pos/            # POS interface, payment dialog, QR
│   │   ├── products/       # Product table, CSV import, barcode
│   │   ├── reports/        # Charts, filters, export
│   │   ├── ocr/            # Scanner, review modal
│   │   └── ...
│   └── ui/                 # Shadcn/UI base components
│
├── lib/                    # Shared utilities
│   ├── ocr/                # OCR engine, AI extraction, matching
│   ├── pos/                # POS service layer
│   ├── ai/                 # Groq AI client & chat tools
│   ├── money.ts            # Decimal.js financial helpers
│   ├── permissions.ts      # RBAC permission engine
│   ├── optimistic-lock.ts  # Concurrency control
│   └── sanitize.ts         # XSS input protection
│
└── schemas/                # Zod validation schemas
```

### Data Flow

```
Client (React) → Server Action → Prisma → PostgreSQL
                      ↓
              Input Validation (Zod)
              Auth Check (NextAuth)
              Permission Check (RBAC)
              Audit Logging
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase project (for file storage)

### Installation

```bash
# Clone
git clone https://github.com/xArmeriumx/Shop-inventory.git
cd Shop-inventory

# Install
npm install

# Environment
cp .env.example .env
# Edit .env with your database URL, auth secret, and Supabase keys

# Database
npx prisma db push

# Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="your-secret-key"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
GROQ_API_KEY="..."  # Optional: for AI/OCR features
```

### Scripts

| Command             | Description        |
| ------------------- | ------------------ |
| `npm run dev`       | Start dev server   |
| `npm run build`     | Production build   |
| `npm test`          | Run tests (Vitest) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed`   | Seed sample data   |

---

## Database Schema

22 models covering the full retail business domain:

```
User ─┬─ ShopMember ── Shop
      │       └── Role (RBAC permissions)
      │
      ├── Product ── SaleItem ── Sale ── Customer
      │     └── StockLog           └── Return ── ReturnItem
      │
      ├── Supplier ── Purchase ── PurchaseItem
      │
      ├── Expense / Income
      │
      ├── Shipment ── CustomerAddress
      │
      └── SystemLog / Notification
```

---

## Deployment

Optimized for **Vercel**:

1. Connect GitHub repo to Vercel
2. Set environment variables
3. Deploy

Production URL: [shop-inventory.napatdev.com](https://shop-inventory.napatdev.com)

---

## License

MIT License — see [LICENSE](LICENSE) for details.
