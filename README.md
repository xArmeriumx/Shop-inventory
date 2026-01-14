# Inventory & Sales Management System (POS)

A modern, robust Inventory and Sales Management System built with Next.js 14, TypeScript, Prisma, and TailwindCSS.

![Project Status](https://img.shields.io/badge/Status-Completed-success)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-ORM-darkblue)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38bdf8)

## 🚀 Features

- **Dashboard**: Real-time overview of sales, profit, and low stock alerts.
- **Product Management**: Full CRUD, barcode/SKU support, stock tracking.
- **Point of Sale (Sales)**: Easy-to-use sales interface, auto stock deduction, invoice generation.
- **Purchases**: Stock replenishment, supplier management, cost tracking.
- **Customers**: Customer database and history.
- **Expenses**: Expense tracking with categorization.
- **Reports**: Financial reports (Revenue/Expense/Profit), daily breakdowns, and Charts.
  - _Export to CSV supported._
  - _Print-ready reports._

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Auth**: NextAuth.js v5
- **UI**: TailwindCSS, shadcn/ui, Lucide React
- **Charts**: Recharts

## 📦 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL Database (Supabase recommended)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/xArmeriumx/Shop-inventory.git
   cd Shop-inventory
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env` (create one if missing) and add your keys:

   ```env
   DATABASE_URL="your-postgresql-connection-string"
   AUTH_SECRET="your-nextauth-secret"
   AUTH_URL="http://localhost:3000"
   ```

4. Initialize Database:

   ```bash
   npx prisma db push
   ```

5. Run Development Server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub.
2. Link your repository to Vercel.
3. Add the **Environment Variables** in Vercel project settings.
4. Deploy!

## 🧪 CI/CD

This project uses **GitHub Actions** for continuous integration.

- **Build Check**: Verifies that the app builds successfully.
- **Linting**: Checks for code style issues.
- **Type Checking**: Ensures TypeScript safety.

## 📄 License

This project is licensed under the MIT License.
