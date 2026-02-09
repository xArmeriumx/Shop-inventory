/**
 * Fix StockLog References — Migrate referenceId → saleId/purchaseId/returnId
 * 
 * Phase 1+2: Backfill + Verify
 * 
 * Logic:
 *   1. Find all StockLogs with referenceId but no saleId/purchaseId/returnId
 *   2. Check if referenceId points to a real record in the target table
 *   3. Set the appropriate FK field
 *   4. Verify 100% coverage before proceeding to Phase 3
 * 
 * Usage:
 *   npx tsx scripts/fix-stocklog-references.ts           # DRY-RUN
 *   npx tsx scripts/fix-stocklog-references.ts --apply    # APPLY
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

interface MigrationResult {
  id: string;
  type: string;
  referenceId: string;
  targetField: 'saleId' | 'purchaseId' | 'returnId';
  targetExists: boolean;
}

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  🔧 StockLog Reference Migration (${APPLY ? '⚡ APPLY' : '👀 DRY-RUN'})`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  // ── Step 1: Find all StockLogs needing migration ──
  const toMigrate = await prisma.stockLog.findMany({
    where: {
      referenceId: { not: null },
      saleId: null,
      purchaseId: null,
      returnId: null,
    },
    select: {
      id: true,
      type: true,
      referenceId: true,
      referenceType: true,
      note: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`  Found ${toMigrate.length} StockLogs to migrate\n`);

  if (toMigrate.length === 0) {
    console.log('  ✅ ไม่มีอะไรต้อง migrate\n');
    await verifyAll();
    await prisma.$disconnect();
    return;
  }

  // ── Step 2: Pre-load all Sale/Purchase/Return IDs for fast lookup ──
  const saleIds = new Set(
    (await prisma.sale.findMany({ select: { id: true } })).map(s => s.id)
  );
  const purchaseIds = new Set(
    (await prisma.purchase.findMany({ select: { id: true } })).map(p => p.id)
  );
  const returnIds = new Set(
    (await prisma.return.findMany({ select: { id: true } })).map(r => r.id)
  );

  console.log(`  Lookup tables: ${saleIds.size} Sales, ${purchaseIds.size} Purchases, ${returnIds.size} Returns\n`);

  // ── Step 3: Map each record ──
  const results: MigrationResult[] = [];
  const skipped: { id: string; type: string; referenceId: string; reason: string }[] = [];

  for (const log of toMigrate) {
    const refId = log.referenceId!;
    const type = log.type;

    let targetField: MigrationResult['targetField'] | null = null;
    let targetExists = false;

    switch (type) {
      case 'SALE':
      case 'SALE_CANCEL':
        targetField = 'saleId';
        targetExists = saleIds.has(refId);
        break;
      case 'PURCHASE':
      case 'PURCHASE_CANCEL':
        targetField = 'purchaseId';
        targetExists = purchaseIds.has(refId);
        break;
      case 'RETURN':
        targetField = 'returnId';
        targetExists = returnIds.has(refId);
        break;
      default:
        // ADJUSTMENT, WASTE, CANCEL — no FK needed
        skipped.push({
          id: log.id, type, referenceId: refId,
          reason: `type="${type}" has no FK target`,
        });
        continue;
    }

    if (!targetExists) {
      // referenceId points to a non-existing record
      // Try all tables as fallback (maybe referenceType was wrong)
      if (saleIds.has(refId)) {
        targetField = 'saleId';
        targetExists = true;
      } else if (purchaseIds.has(refId)) {
        targetField = 'purchaseId';
        targetExists = true;
      } else if (returnIds.has(refId)) {
        targetField = 'returnId';
        targetExists = true;
      }
    }

    if (!targetExists) {
      skipped.push({
        id: log.id, type, referenceId: refId,
        reason: `referenceId not found in any table (Sale/Purchase/Return)`,
      });
      continue;
    }

    results.push({ id: log.id, type, referenceId: refId, targetField: targetField!, targetExists });
  }

  // ── Step 4: Print plan ──
  // Group by targetField
  const bySaleId = results.filter(r => r.targetField === 'saleId');
  const byPurchaseId = results.filter(r => r.targetField === 'purchaseId');
  const byReturnId = results.filter(r => r.targetField === 'returnId');

  console.log(`  Migration Plan:`);
  console.log(`    → saleId:     ${bySaleId.length} records`);
  console.log(`    → purchaseId: ${byPurchaseId.length} records`);
  console.log(`    → returnId:   ${byReturnId.length} records`);
  console.log(`    ⚠️ skipped:    ${skipped.length} records`);
  console.log('');

  // Show some examples
  const examples = results.slice(0, 5);
  for (const r of examples) {
    console.log(`    ${APPLY ? '✅' : '📋'} ${r.id.substring(0, 12)}... type=${r.type} → ${r.targetField}=${r.referenceId.substring(0, 12)}...`);
  }
  if (results.length > 5) {
    console.log(`    ... and ${results.length - 5} more`);
  }
  console.log('');

  // Show skipped
  if (skipped.length > 0) {
    console.log(`  ⚠️ Skipped records:`);
    for (const s of skipped.slice(0, 5)) {
      console.log(`    ⚠️ ${s.id.substring(0, 12)}... type=${s.type}: ${s.reason}`);
    }
    if (skipped.length > 5) {
      console.log(`    ... and ${skipped.length - 5} more`);
    }
    console.log('');
  }

  // ── Step 5: Apply ──
  if (APPLY) {
    console.log(`  Applying ${results.length} updates...`);
    
    await prisma.$transaction(async (tx) => {
      for (const r of results) {
        await tx.stockLog.update({
          where: { id: r.id },
          data: { [r.targetField]: r.referenceId },
        });
      }
    }, { timeout: 30000 });

    console.log(`  ✅ Applied ${results.length} updates\n`);

    // Verify after apply
    await verifyAll();
  } else {
    console.log(`  ⚠️ DRY-RUN — ไม่มีการแก้ข้อมูล`);
    console.log(`  npx tsx scripts/fix-stocklog-references.ts --apply\n`);
  }

  await prisma.$disconnect();
}

async function verifyAll() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🔍 Phase 2: Verification');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  // Count: referenceId not null
  const withRef = await prisma.stockLog.count({
    where: { referenceId: { not: null } },
  });

  // Count: any new FK set
  const withNewFK = await prisma.stockLog.count({
    where: {
      OR: [
        { saleId: { not: null } },
        { purchaseId: { not: null } },
        { returnId: { not: null } },
      ],
    },
  });

  // Count: has referenceId BUT no new FK
  const stillOrphaned = await prisma.stockLog.count({
    where: {
      referenceId: { not: null },
      saleId: null,
      purchaseId: null,
      returnId: null,
    },
  });

  // Count: records with type that should have FK but don't
  const missingFK = await prisma.stockLog.count({
    where: {
      type: { in: ['SALE', 'SALE_CANCEL', 'PURCHASE', 'PURCHASE_CANCEL', 'RETURN'] },
      saleId: null,
      purchaseId: null,
      returnId: null,
    },
  });

  console.log(`  Records with referenceId:     ${withRef}`);
  console.log(`  Records with new FK:          ${withNewFK}`);
  console.log(`  Still orphaned (ref but no FK): ${stillOrphaned}`);
  console.log(`  Missing FK (should have one):  ${missingFK}`);
  console.log('');

  if (stillOrphaned === 0 && missingFK === 0) {
    console.log('  ✅ 100% VERIFIED — Safe to proceed to Phase 3 (code update)\n');
  } else if (stillOrphaned === 0) {
    console.log('  ✅ All referenceId migrated. Some records without referenceId may need FK.\n');
  } else {
    console.log(`  ⚠️ ${stillOrphaned} records still have referenceId without new FK`);
    console.log('  Review skipped records above before proceeding.\n');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
