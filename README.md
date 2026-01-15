# Shop Inventory & Sales Management System

A comprehensive Inventory and Sales Management System developed with Next.js 14, TypeScript, Prisma, and TailwindCSS. This system is designed for multi-tenant usage, featuring role-based access control (RBAC) and robust audit trails.

## System Overview

This application serves as a complete Point of Sale (POS) and inventory management solution. It supports multiple shops, granular user permissions, and precise stock tracking. The architecture prioritizes data integrity, auditability, and ease of use.

## Core Features

### 1. Multi-Tenant Architecture

- Supports multiple independent shops.
- **Role-Based Access Control (RBAC)**: secure and granular permission system (Owner, Manager, Cashier, etc.).
- **Onboarding Flow**: streamlined process for creating new shops or joining existing teams via invitation.

### 2. Inventory Management

- Real-time stock tracking with detailed movement history.
- Manual stock adjustments with mandatory reason logging.
- Low stock alerts and cost tracking.

### 3. Point of Sale (POS)

- Dedicated POS interface optimized for speed and usability.
- Barcode scanner support (Keyboard Mode) for rapid product entry.
- Real-time stock synchronization across multiple terminals.
- Optimistic UI updates for immediate feedback.

### 4. Sales and Purchase Management

- **Audit-Ready Cancellation**: Implements a rigorous cancellation workflow instead of deletion. All cancellations require a reason and are timestamped, ensuring a complete audit trail.
- Automatic profit calculation and stock deduction.
- Receipt upload capability via Supabase Storage.
- Tax invoice generation.

### 5. Reporting and Analytics

- Comprehensive financial reports (Revenue, Expense, Profit).
- Daily breakdowns and downloadable CSV exports.
- Printable report formats.

## Technical Architecture

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict mode)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Styling**: TailwindCSS, Shadcn UI
- **Deployment**: Vercel (Edge-compatible middleware)

### Development Standards

- **Server Actions**: Standardized `ActionResponse` pattern for consistent error handling.
- **Type Safety**: Strictly typed interfaces across the entire codebase.
- **Audit Logging**: All critical actions (stock changes, cancellations) are persistently logged.

## Installation and Setup

### Prerequisites

- Node.js 18 or higher
- PostgreSQL Database

### Setup Instructions

1.  **Clone the repository**

    ```bash
    git clone https://github.com/xArmeriumx/Shop-inventory.git
    cd Shop-inventory
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file based on `.env.example` and populate the necessary variables:

    ```env
    DATABASE_URL="postgresql://..."
    AUTH_SECRET="your-secret-key"
    NEXT_PUBLIC_SUPABASE_URL="..."
    ```

4.  **Database Initialization**

    ```bash
    npx prisma db push
    ```

5.  **Start Development Server**
    ```bash
    npm run dev
    ```

Access the application at `http://localhost:3000`.

## Deployment

The application is optimized for deployment on Vercel.

1.  Connect the GitHub repository to Vercel.
2.  Configure the environment variables in the Vercel dashboard.
3.  Deploy.

## License

This project is licensed under the MIT License.
