/**
 * Reconcile Stock Cache Script
 * ─────────────────────────────────────────────────────────────────────────────
 * ตรวจหา Product.stock ที่ Drift จาก SUM(WarehouseStock.quantity)
 * และ Fix ให้ตรงกัน (ถ้าไม่ได้ใช้ --dry-run)
 *
 * วิธีรัน:
 *   ตรวจอย่างเดียว (ไม่แก้ไข):
 *     npx ts-node -r tsconfig-paths/register src/scripts/reconcile-stock-cache.ts --dry-run
 *
 *   Fix ด้วย:
 *     npx ts-node -r tsconfig-paths/register src/scripts/reconcile-stock-cache.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

type DriftRecord = {
  productId:    string;
  productName:  string;
  cachedStock:  number;
  actualStock:  number;
  drift:        number;
  cachedReserved: number;
  actualReserved: number;
};

async function run() {
  console.log(`\n🔍 Stock Cache Reconciliation [${isDryRun ? 'DRY RUN — ไม่แก้ไขข้อมูล' : 'LIVE — จะแก้ไขข้อมูล'}]\n`);

  // 1. ดึง Product ทั้งหมด + Aggregate WarehouseStock
  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true, reservedStock: true, shopId: true },
  });

  const warehouseStocks = await db.warehouseStock.findMany({
    select: { productId: true, quantity: true, reservedStock: true },
  });

  // 2. Build Map: productId → { onHand, reserved }
  const stockMap = new Map<string, { onHand: number; reserved: number }>();
  for (const ws of warehouseStocks) {
    const prev = stockMap.get(ws.productId) ?? { onHand: 0, reserved: 0 };
    stockMap.set(ws.productId, {
      onHand:   prev.onHand   + Number(ws.quantity),
      reserved: prev.reserved + Number(ws.reservedStock || 0),
    });
  }

  // 3. Find Drifts
  const drifts: DriftRecord[] = [];
  for (const p of products) {
    const agg           = stockMap.get(p.id) ?? { onHand: 0, reserved: 0 };
    const cachedStock   = Number(p.stock);
    const cachedReserved= Number(p.reservedStock);
    const actualStock   = agg.onHand;
    const actualReserved= agg.reserved;

    if (cachedStock !== actualStock || cachedReserved !== actualReserved) {
      drifts.push({
        productId:      p.id,
        productName:    p.name,
        cachedStock,
        actualStock,
        drift:          actualStock - cachedStock,
        cachedReserved,
        actualReserved,
      });
    }
  }

  // 4. Report
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`📊 ผลการตรวจสอบ: Products ทั้งหมด ${products.length} รายการ`);
  console.log('══════════════════════════════════════════════════════════════');

  if (drifts.length === 0) {
    console.log('\n✅ ไม่พบ Drift — Product.stock ตรงกับ WarehouseStock ทั้งหมด!');
  } else {
    console.log(`\n⚠️  พบ Drift ${drifts.length} รายการ:\n`);
    for (const d of drifts) {
      const stockOk    = d.cachedStock    === d.actualStock    ? '✅' : '❌';
      const reserveOk  = d.cachedReserved === d.actualReserved ? '✅' : '❌';
      console.log(`  [${stockOk}${reserveOk}] ${d.productName} (${d.productId})`);
      if (d.cachedStock !== d.actualStock) {
        console.log(`       stock:    cache=${d.cachedStock}  actual=${d.actualStock}  drift=${d.drift >= 0 ? '+' : ''}${d.drift}`);
      }
      if (d.cachedReserved !== d.actualReserved) {
        console.log(`       reserved: cache=${d.cachedReserved}  actual=${d.actualReserved}`);
      }
    }
  }

  // 5. Fix (ถ้าไม่ใช่ Dry Run)
  if (!isDryRun && drifts.length > 0) {
    console.log('\n🔧 กำลัง Fix...\n');
    let fixed = 0;
    let errors = 0;

    for (const d of drifts) {
      try {
        await db.product.update({
          where: { id: d.productId },
          data: {
            stock:        d.actualStock,
            reservedStock: d.actualReserved,
            isLowStock:   false, // จะถูก Sync ใหม่ครั้งต่อไปที่มี Movement
          },
        });
        console.log(`  ✅ Fixed: ${d.productName} → stock: ${d.cachedStock} → ${d.actualStock}`);
        fixed++;
      } catch (err) {
        console.error(`  ❌ Error fixing ${d.productId}:`, err);
        errors++;
      }
    }

    console.log(`\n══════════════════════════════════════════════════════════════`);
    console.log(`📊 Fix Summary: Fixed ${fixed} | Errors ${errors}`);
    if (errors > 0) process.exit(1);
  } else if (isDryRun && drifts.length > 0) {
    console.log('\n💡 รัน script โดยไม่มี --dry-run เพื่อ Fix อัตโนมัติ');
  }

  console.log('\n══════════════════════════════════════════════════════════════\n');
  await db.$disconnect();
}

run().catch(async (err) => {
  console.error('Fatal:', err);
  await db.$disconnect();
  process.exit(1);
});
