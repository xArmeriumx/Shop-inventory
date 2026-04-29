/**
 * Backfill Payment Allocations Script (Phase 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * สร้าง PaymentAllocation จาก Legacy Payment FK (invoiceId/saleId/purchaseId/expenseId)
 * สำหรับ Payment ที่ยังไม่มี Allocation
 *
 * Safe to run multiple times (idempotent)
 *
 * วิธีรัน:
 *   ตรวจอย่างเดียว:
 *     npx ts-node -r tsconfig-paths/register src/scripts/backfill-payment-allocations.ts --dry-run
 *   Fix:
 *     npx ts-node -r tsconfig-paths/register src/scripts/backfill-payment-allocations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

type DocType = 'INVOICE' | 'SALE' | 'PURCHASE' | 'EXPENSE';

async function run() {
  console.log(`\n🔄 Backfill Payment Allocations [${isDryRun ? 'DRY RUN' : 'LIVE'}]\n`);

  // 1. หา Payment ทั้งหมดที่มี Legacy FK แต่ยังไม่มี Allocation
  const payments = await (db as any).payment.findMany({
    where: {
      allocations: { none: {} },
      OR: [
        { invoiceId:  { not: null } },
        { saleId:     { not: null } },
        { purchaseId: { not: null } },
        { expenseId:  { not: null } },
      ],
    },
    select: {
      id: true,
      shopId: true,
      amount: true,
      invoiceId: true,
      saleId: true,
      purchaseId: true,
      expenseId: true,
      paymentNo: true,
    },
  });

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`📊 พบ Payment ที่ต้อง Backfill: ${payments.length} รายการ`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (payments.length === 0) {
    console.log('✅ ไม่มี Legacy Payment ที่ต้อง Backfill — ระบบสะอาดแล้ว!\n');
    await db.$disconnect();
    return;
  }

  // 2. Map each payment → documentType + documentId
  const toCreate: Array<{
    paymentId:    string;
    shopId:       string;
    documentType: DocType;
    documentId:   string;
    amount:       any;
    // legacy FK mirror
    invoiceId?:   string;
    saleId?:      string;
    purchaseId?:  string;
    expenseId?:   string;
  }> = [];

  for (const p of payments) {
    let documentType: DocType | null = null;
    let documentId: string | null = null;

    if (p.invoiceId)  { documentType = 'INVOICE';  documentId = p.invoiceId; }
    else if (p.saleId)     { documentType = 'SALE';     documentId = p.saleId; }
    else if (p.purchaseId) { documentType = 'PURCHASE'; documentId = p.purchaseId; }
    else if (p.expenseId)  { documentType = 'EXPENSE';  documentId = p.expenseId; }

    if (!documentType || !documentId) continue;

    console.log(`  → ${p.paymentNo ?? p.id}  [${documentType}] ${documentId}  ฿${p.amount}`);

    toCreate.push({
      paymentId:    p.id,
      shopId:       p.shopId,
      documentType,
      documentId,
      amount:       p.amount,
      // mirror legacy FK so existing queries still work
      invoiceId:    p.invoiceId  ?? undefined,
      saleId:       p.saleId    ?? undefined,
      purchaseId:   p.purchaseId ?? undefined,
      expenseId:    p.expenseId  ?? undefined,
    });
  }

  console.log(`\n📝 จะสร้าง PaymentAllocation ${toCreate.length} รายการ\n`);

  if (isDryRun) {
    console.log('💡 รัน script โดยไม่มี --dry-run เพื่อ Backfill จริง\n');
    await db.$disconnect();
    return;
  }

  // 3. Bulk create
  let created = 0;
  let errors  = 0;

  for (const alloc of toCreate) {
    try {
      await (db as any).paymentAllocation.create({ data: alloc });
      created++;
    } catch (err) {
      console.error(`  ❌ Error: paymentId=${alloc.paymentId}`, err);
      errors++;
    }
  }

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`📊 Backfill Summary: Created ${created} | Errors ${errors}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (errors > 0) process.exit(1);
  await db.$disconnect();
}

run().catch(async (err) => {
  console.error('Fatal:', err);
  await db.$disconnect();
  process.exit(1);
});
