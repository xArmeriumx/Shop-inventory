/**
 * Backfill Script: Sale Child Tables
 * ─────────────────────────────────────────────────────────────────────────────
 * คัดลอกข้อมูลจาก Sale เดิม → SaleStatus, SaleTaxSummary, SalePaymentDetail
 * สำหรับ Record เก่าที่สร้างก่อน Normalization Refactor
 *
 * วิธีรัน: npx ts-node -r tsconfig-paths/register src/scripts/backfill-sale-child-tables.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const BATCH_SIZE = 100;

async function run() {
  console.log('🚀 Starting Sale Child Tables Backfill...\n');

  let skip = 0;
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  while (true) {
    // หา Sale ที่ยังไม่มี SaleStatus (ยังไม่ได้ Backfill)
    const sales = await db.sale.findMany({
      where: {
        statusDetail: null,
      },
      select: {
        id: true,
        shopId: true,
        status: true,
        paymentStatus: true,
        billingStatus: true,
        deliveryStatus: true,
        bookingStatus: true,
        editLockStatus: true,
        isLocked: true,
        lockReason: true,
        cancelReason: true,
        cancelledAt: true,
        cancelledBy: true,
        taxMode: true,
        taxRate: true,
        taxAmount: true,
        taxableAmount: true,
        paymentMethod: true,
        paymentProof: true,
        paymentNote: true,
        paymentVerifiedAt: true,
        paymentVerifiedBy: true,
        paymentStatusProof: true,
        paidAmount: true,
        residualAmount: true,
      },
      take: BATCH_SIZE,
      skip,
    });

    if (sales.length === 0) {
      console.log('\n✅ No more sales to process. Done!');
      break;
    }

    console.log(`📦 Processing batch of ${sales.length} sales (skip: ${skip})...`);

    for (const sale of sales) {
      try {
        // ตรวจสอบ editLockStatus — รวม isLocked เข้าด้วย
        const rawLockStatus = (sale as any).editLockStatus ?? 'NONE';
        const resolvedLockStatus = (rawLockStatus !== 'NONE' || (sale as any).isLocked)
          ? 'LOCKED'
          : 'NONE';

        await db.$transaction([
          // 1. SaleStatus
          db.saleStatus.upsert({
            where: { saleId: sale.id },
            create: {
              saleId:        sale.id,
              shopId:        sale.shopId,
              status:        (sale as any).status        ?? 'ACTIVE',
              paymentStatus: (sale as any).paymentStatus ?? 'UNPAID',
              billingStatus: (sale as any).billingStatus ?? 'UNBILLED',
              deliveryStatus:(sale as any).deliveryStatus?? 'PENDING',
              bookingStatus: (sale as any).bookingStatus ?? 'NONE',
              editLockStatus:resolvedLockStatus,
              lockReason:    (sale as any).lockReason    ?? null,
              cancelReason:  (sale as any).cancelReason  ?? null,
              cancelledAt:   (sale as any).cancelledAt   ?? null,
              cancelledBy:   (sale as any).cancelledBy   ?? null,
            },
            update: {}, // ถ้ามีอยู่แล้วก็ข้ามไป
          }),

          // 2. SaleTaxSummary
          db.saleTaxSummary.upsert({
            where: { saleId: sale.id },
            create: {
              saleId:        sale.id,
              shopId:        sale.shopId,
              taxMode:       (sale as any).taxMode       ?? 'INCLUSIVE',
              taxRate:       (sale as any).taxRate       ?? 7,
              taxAmount:     (sale as any).taxAmount     ?? 0,
              taxableAmount: (sale as any).taxableAmount ?? 0,
            },
            update: {},
          }),

          // 3. SalePaymentDetail
          db.salePaymentDetail.upsert({
            where: { saleId: sale.id },
            create: {
              saleId:            sale.id,
              shopId:            sale.shopId,
              paymentMethod:     (sale as any).paymentMethod     ?? 'CASH',
              paymentProof:      (sale as any).paymentProof      ?? null,
              paymentNote:       (sale as any).paymentNote       ?? null,
              paymentVerifiedAt: (sale as any).paymentVerifiedAt ?? null,
              paymentVerifiedBy: (sale as any).paymentVerifiedBy ?? null,
              paymentStatusProof:(sale as any).paymentStatusProof?? 'VERIFIED',
              paidAmount:        (sale as any).paidAmount        ?? 0,
              residualAmount:    (sale as any).residualAmount    ?? 0,
            },
            update: {},
          }),
        ]);

        totalCreated++;
      } catch (err) {
        console.error(`  ❌ Error on saleId ${sale.id}:`, err);
        totalErrors++;
      }
    }

    totalProcessed += sales.length;
    totalSkipped += (sales.length - totalCreated - totalErrors);
    skip += BATCH_SIZE;

    console.log(`  → Processed: ${totalProcessed} | Created: ${totalCreated} | Errors: ${totalErrors}`);
  }

  console.log('\n══════════════════════════════════════════════');
  console.log('📊 Backfill Summary:');
  console.log(`   Total Processed : ${totalProcessed}`);
  console.log(`   Created (new)   : ${totalCreated}`);
  console.log(`   Skipped (exist) : ${totalSkipped}`);
  console.log(`   Errors          : ${totalErrors}`);
  console.log('══════════════════════════════════════════════');

  if (totalErrors > 0) {
    console.log('\n⚠️  มีบาง Record ที่ Backfill ไม่ได้ กรุณาตรวจสอบ Log ด้านบน');
    process.exit(1);
  } else {
    console.log('\n✅ Backfill completed successfully!');
    console.log('\n💡 Next Step: ตรวจสอบด้วย SQL:');
    console.log('   SELECT COUNT(*) FROM "Sale" s LEFT JOIN "SaleStatus" ss ON ss."saleId" = s.id WHERE ss.id IS NULL;');
    console.log('   -- ต้องได้ 0');
  }

  await db.$disconnect();
}

run().catch(async (err) => {
  console.error('Fatal error:', err);
  await db.$disconnect();
  process.exit(1);
});
