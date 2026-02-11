/**
 * 🔬 Deep Data Integrity & Leak Audit v11 (READ-ONLY)
 *
 * After thorough cross-reference of v1–v10 (158 checks), these are
 * VERIFIED new gaps not covered by any prior version:
 *
 * ── Cancel Lifecycle Integrity ──
 *   1.  Cancelled sale: total SALE_CANCEL stock restored vs expected
 *       (cancelSale deducts alreadyReturned, so restore = sold − returned)
 *   2.  Cancelled purchase: total PURCHASE_CANCEL stock deducted vs expected
 *       (cancelPurchase deducts full item quantity)
 *   3.  Cancelled sale still has cancelledAt/cancelledBy/cancelReason filled
 *   4.  Active sale has cancelledAt set (should be null)
 *
 * ── Shop RBAC Integrity ──
 *   5.  Shop without any isOwner=true member
 *   6.  Shop with multiple isOwner=true members (should be exactly 1)
 *   7.  LookupValue cross-shop: LookupValue.shopId ≠ Product.shopId for categoryRef
 *
 * ── Multi-Default Constraint ──
 *   8.  Multiple isDefault CustomerAddress per customer
 *   9.  Multiple isDefault LookupValue per type+shop
 *
 * ── Financial Edge Cases ──
 *  10.  Sale discountAmount > totalAmount (discount exceeds pre-discount total)
 *  11.  Sale with discountType but discountValue = 0 or null (invalid combo)
 *  12.  Product salePrice < costPrice (selling below cost — INFO only)
 *
 * Verified against:
 *   - cancelSale (sales.ts L497-635): deducts alreadyReturned from restoreQty
 *   - cancelPurchase (purchases.ts L291-420): PURCHASE_CANCEL = -item.quantity
 *   - StockService.recordMovement: atomic increment, balance snapshot
 *   - Schema: CustomerAddress.isDefault, LookupValue.isDefault
 *   - Schema: Sale.discountType, discountValue, discountAmount, netAmount
 *
 * Cumulative: v1-v10(158) + v11(12) = 170 checks
 *
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v11.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function toNum(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

let totalIssues = 0;
let checkCount = 0;

function startCheck(name: string) {
  checkCount++;
  process.stdout.write(`  [${checkCount}] ${name}... `);
}

function endCheck(issues: number) {
  if (issues === 0) {
    console.log('✅ OK');
  } else {
    console.log(`❌ ${issues} issue(s)`);
    totalIssues += issues;
  }
}

// =====================================================================
// 1. Cancelled sale: SALE_CANCEL stock restored vs expected
//    cancelSale: restoreQty = item.quantity - alreadyReturned
//    So SUM(SALE_CANCEL qty for this sale) should = SUM(item.qty - returned)
// =====================================================================
async function checkCancelledSaleStockRestoreAmount() {
  startCheck('Cancelled sale: SALE_CANCEL restore qty vs expected');

  const cancelledSales = await prisma.sale.findMany({
    where: { status: 'CANCELLED' },
    select: {
      id: true,
      invoiceNumber: true,
      items: {
        select: {
          quantity: true,
          returnItems: {
            select: { quantity: true },
          },
        },
      },
      stockLogs: {
        where: { type: 'SALE_CANCEL' },
        select: { quantity: true },
      },
    },
  });

  let issues = 0;
  for (const sale of cancelledSales) {
    // Expected total restore = sum of (item.qty - alreadyReturned) for items with restoreQty > 0
    let expectedRestore = 0;
    for (const item of sale.items) {
      const alreadyReturned = item.returnItems.reduce((s, r) => s + r.quantity, 0);
      const restoreQty = item.quantity - alreadyReturned;
      if (restoreQty > 0) expectedRestore += restoreQty;
    }

    // Actual restore from StockLogs (SALE_CANCEL quantities are positive)
    const actualRestore = sale.stockLogs.reduce((s, l) => s + l.quantity, 0);

    if (expectedRestore !== actualRestore) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  ${sale.invoiceNumber}: expected restore=${expectedRestore} but SALE_CANCEL total=${actualRestore}`
        );
      }
    }
  }
  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 2. Cancelled purchase: PURCHASE_CANCEL stock deducted vs expected
//    cancelPurchase: each item creates PURCHASE_CANCEL with -item.quantity
//    SUM(PURCHASE_CANCEL qty) should = -SUM(item.qty) = negative total
// =====================================================================
async function checkCancelledPurchaseStockDeductAmount() {
  startCheck('Cancelled purchase: PURCHASE_CANCEL deduct qty vs expected');

  const cancelledPurchases = await prisma.purchase.findMany({
    where: { status: 'CANCELLED' },
    select: {
      id: true,
      purchaseNumber: true,
      items: { select: { quantity: true } },
      stockLogs: {
        where: { type: 'PURCHASE_CANCEL' },
        select: { quantity: true },
      },
    },
  });

  let issues = 0;
  for (const p of cancelledPurchases) {
    const expectedDeduct = -p.items.reduce((s, i) => s + i.quantity, 0);
    const actualDeduct = p.stockLogs.reduce((s, l) => s + l.quantity, 0);

    if (p.items.length > 0 && expectedDeduct !== actualDeduct) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  ${p.purchaseNumber || p.id.substring(0, 12)}: expected deduct=${expectedDeduct} but PURCHASE_CANCEL total=${actualDeduct}`
        );
      }
    }
  }
  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 3. Cancelled sale must have cancelledAt, cancelledBy, cancelReason
// =====================================================================
async function checkCancelledSaleMetadata() {
  startCheck('Cancelled sales missing cancel metadata (cancelledAt/By/Reason)');

  const bad = await prisma.sale.findMany({
    where: {
      status: 'CANCELLED',
      OR: [
        { cancelledAt: null },
        { cancelledBy: null },
        { cancelReason: null },
      ],
    },
    select: {
      invoiceNumber: true,
      cancelledAt: true,
      cancelledBy: true,
      cancelReason: true,
    },
  });

  for (const s of bad.slice(0, 5)) {
    const missing = [];
    if (!s.cancelledAt) missing.push('cancelledAt');
    if (!s.cancelledBy) missing.push('cancelledBy');
    if (!s.cancelReason) missing.push('cancelReason');
    console.log(`\n    ⚠️  ${s.invoiceNumber}: CANCELLED but missing ${missing.join(', ')}`);
  }
  if (bad.length > 5) console.log(`\n    ... and ${bad.length - 5} more`);
  endCheck(bad.length);
}

// =====================================================================
// 4. Active sale should NOT have cancelledAt set
// =====================================================================
async function checkActiveSaleWithCancelledAt() {
  startCheck('Active sales with cancelledAt set (should be null)');

  const bad = await prisma.sale.findMany({
    where: {
      status: 'ACTIVE',
      cancelledAt: { not: null },
    },
    select: { invoiceNumber: true, cancelledAt: true },
  });

  for (const s of bad) {
    console.log(
      `\n    ⚠️  ${s.invoiceNumber}: ACTIVE but cancelledAt=${s.cancelledAt?.toISOString()}`
    );
  }
  endCheck(bad.length);
}

// =====================================================================
// 5. Shop without any isOwner=true member
// =====================================================================
async function checkShopWithoutOwner() {
  startCheck('Shops without any isOwner=true member');

  const shops = await prisma.shop.findMany({
    select: {
      id: true,
      name: true,
      members: {
        where: { isOwner: true },
        select: { id: true },
      },
    },
  });

  let issues = 0;
  for (const shop of shops) {
    if (shop.members.length === 0) {
      issues++;
      console.log(`\n    ⚠️  Shop "${shop.name}" (${shop.id.substring(0, 8)}...): no isOwner=true member`);
    }
  }
  endCheck(issues);
}

// =====================================================================
// 6. Shop with multiple isOwner members (should be exactly 1)
// =====================================================================
async function checkShopMultipleOwners() {
  startCheck('Shops with multiple isOwner=true members');

  const shops = await prisma.shop.findMany({
    select: {
      id: true,
      name: true,
      members: {
        where: { isOwner: true },
        select: { user: { select: { email: true } } },
      },
    },
  });

  let issues = 0;
  for (const shop of shops) {
    if (shop.members.length > 1) {
      issues++;
      const emails = shop.members.map(m => m.user.email).join(', ');
      console.log(
        `\n    ⚠️  Shop "${shop.name}": ${shop.members.length} owners (${emails})`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 7. LookupValue cross-shop: Product.categoryRef belongs to different shop
// =====================================================================
async function checkProductCategoryRefCrossShop() {
  startCheck('Product categoryRef LookupValue from different shop');

  const products = await prisma.product.findMany({
    where: { deletedAt: null, categoryId: { not: null } },
    select: {
      id: true,
      name: true,
      shopId: true,
      categoryRef: { select: { id: true, shopId: true, name: true } },
    },
  });

  let issues = 0;
  for (const p of products) {
    if (p.categoryRef && p.categoryRef.shopId && p.categoryRef.shopId !== p.shopId) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  Product "${p.name}": categoryRef "${p.categoryRef.name}" shopId=${p.categoryRef.shopId} ≠ product shopId=${p.shopId}`
        );
      }
    }
  }
  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 8. Multiple isDefault CustomerAddress per customer
// =====================================================================
async function checkMultipleDefaultAddresses() {
  startCheck('Customers with multiple isDefault=true addresses');

  const dupes: Array<{ customerId: string; cnt: bigint }> = await prisma.$queryRaw`
    SELECT ca."customerId", COUNT(*) as cnt
    FROM "CustomerAddress" ca
    JOIN "Customer" c ON c.id = ca."customerId"
    WHERE ca."isDefault" = true
      AND ca."deletedAt" IS NULL
      AND c."deletedAt" IS NULL
    GROUP BY ca."customerId"
    HAVING COUNT(*) > 1
  `;

  let issues = 0;
  for (const d of dupes) {
    issues++;
    const customer = await prisma.customer.findUnique({
      where: { id: d.customerId },
      select: { name: true },
    });
    console.log(
      `\n    ⚠️  Customer "${customer?.name}": ${d.cnt} addresses marked isDefault=true`
    );
  }
  endCheck(issues);
}

// =====================================================================
// 9. Multiple isDefault LookupValue per type+shop
// =====================================================================
async function checkMultipleDefaultLookups() {
  startCheck('Multiple isDefault=true LookupValues per type+shop');

  const dupes: Array<{ lookupTypeId: string; shopId: string | null; cnt: bigint }> = await prisma.$queryRaw`
    SELECT "lookupTypeId", "shopId", COUNT(*) as cnt
    FROM "LookupValue"
    WHERE "isDefault" = true
      AND "deletedAt" IS NULL
      AND "isActive" = true
    GROUP BY "lookupTypeId", "shopId"
    HAVING COUNT(*) > 1
  `;

  let issues = 0;
  for (const d of dupes) {
    issues++;
    const lookupType = await prisma.lookupType.findUnique({
      where: { id: d.lookupTypeId },
      select: { name: true, code: true },
    });
    console.log(
      `\n    ⚠️  LookupType "${lookupType?.name}" (${lookupType?.code}) shop=${d.shopId?.substring(0, 8) || 'null'}: ${d.cnt} defaults`
    );
  }
  endCheck(issues);
}

// =====================================================================
// 10. Sale discountAmount > totalAmount
//     (createSale caps this, but check for corrupted data)
// =====================================================================
async function checkDiscountExceedsTotal() {
  startCheck('Sales where discountAmount > totalAmount');

  const bad = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: {
      invoiceNumber: true,
      totalAmount: true,
      discountAmount: true,
    },
  });

  let issues = 0;
  for (const s of bad) {
    const total = toNum(s.totalAmount);
    const discount = toNum(s.discountAmount);
    if (discount > total + 0.01) {
      issues++;
      console.log(
        `\n    ⚠️  ${s.invoiceNumber}: discountAmount=฿${discount.toFixed(2)} > totalAmount=฿${total.toFixed(2)}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 11. Sale with discountType set but discountValue = 0/null
//     (inconsistent: says PERCENT/FIXED but no value)
// =====================================================================
async function checkDiscountTypeNoValue() {
  startCheck('Sales with discountType but discountValue = 0 or null');

  const bad = await prisma.sale.findMany({
    where: {
      status: 'ACTIVE',
      discountType: { not: null },
      OR: [
        { discountValue: null },
        { discountValue: { lte: 0 } },
      ],
    },
    select: {
      invoiceNumber: true,
      discountType: true,
      discountValue: true,
      discountAmount: true,
    },
  });

  for (const s of bad.slice(0, 5)) {
    console.log(
      `\n    ⚠️  ${s.invoiceNumber}: discountType="${s.discountType}" but discountValue=${toNum(s.discountValue)}`
    );
  }
  if (bad.length > 5) console.log(`\n    ... and ${bad.length - 5} more`);
  endCheck(bad.length);
}

// =====================================================================
// 12. Product salePrice < costPrice (selling below cost — INFO only)
// =====================================================================
async function checkSalePriceBelowCost() {
  startCheck('Products with salePrice < costPrice (INFO: selling below cost)');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { name: true, salePrice: true, costPrice: true },
  });

  let count = 0;
  for (const p of products) {
    const sale = toNum(p.salePrice);
    const cost = toNum(p.costPrice);
    if (sale < cost && cost > 0) {
      count++;
      if (count <= 5) {
        console.log(
          `\n    ℹ️  "${p.name}": salePrice=฿${sale.toFixed(2)} < costPrice=฿${cost.toFixed(2)} (margin: ${((sale - cost) / cost * 100).toFixed(1)}%)`
        );
      }
    }
  }
  if (count > 5) console.log(`\n    ... and ${count - 5} more`);
  if (count > 0) console.log(`\n    ℹ️  ${count} product(s) — may be intentional (promotions, clearance)`);
  // INFO only, don't count as issues
  endCheck(0);
}

// =====================================================================
// Main
// =====================================================================
async function main() {
  console.log('');
  console.log('🔬 Data Integrity & Leak Audit v11');
  console.log('══════════════════════════════════════════');
  console.log('');

  // --- Cancel Lifecycle ---
  console.log('🚫 Cancel Lifecycle Integrity');
  await checkCancelledSaleStockRestoreAmount();
  await checkCancelledPurchaseStockDeductAmount();
  await checkCancelledSaleMetadata();
  await checkActiveSaleWithCancelledAt();

  console.log('');

  // --- Shop RBAC ---
  console.log('🔐 Shop RBAC & Ownership');
  await checkShopWithoutOwner();
  await checkShopMultipleOwners();
  await checkProductCategoryRefCrossShop();

  console.log('');

  // --- Multi-Default Constraint ---
  console.log('🎯 Uniqueness Constraints');
  await checkMultipleDefaultAddresses();
  await checkMultipleDefaultLookups();

  console.log('');

  // --- Financial Edge Cases ---
  console.log('💰 Financial Edge Cases');
  await checkDiscountExceedsTotal();
  await checkDiscountTypeNoValue();
  await checkSalePriceBelowCost();

  // --- Summary ---
  console.log('');
  console.log('══════════════════════════════════════════');
  if (totalIssues === 0) {
    console.log(`✅ All ${checkCount} checks passed — no issues found`);
  } else {
    console.log(`❌ ${totalIssues} issue(s) found across ${checkCount} checks`);
  }

  console.log('');
  console.log('📊 Cumulative: v1-v10(158) + v11(12) = 170 checks');
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
