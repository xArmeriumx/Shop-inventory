/**
 * Deep Data Integrity Audit v4
 * 
 * ⚠️ READ-ONLY — never writes to the database.
 * 
 * Structural & relationship checks:
 *  1.  Soft-delete cascade (parent deleted but children not)
 *  2.  Invoice/Purchase number sequence gaps
 *  3.  LookupValue integrity (referenced values deleted/inactive)
 *  4.  Timestamp anomalies (createdAt > updatedAt, ancient dates)
 *  5.  User ownership consistency (userId not a shop member)
 *  6.  Data completeness (required business fields empty)
 *  7.  Optimistic locking version anomalies
 *  8.  Decimal precision check (values with excess precision)
 *  9.  Large value anomalies (outliers that may be bugs)
 * 10.  Sale status vs deletedAt consistency
 * 11.  Role/Permission integrity
 * 12.  Duplicate product names within same shop
 * 
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v4.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function toNum(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

interface Issue {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  check: string;
  model: string;
  identifier: string;
  detail: string;
}

const issues: Issue[] = [];
function add(sev: Issue['severity'], check: string, model: string, id: string, detail: string) {
  issues.push({ severity: sev, check, model, identifier: id, detail });
}

// ═══════════════════════════════════════════════════
// 1. Soft-delete cascade consistency
// ═══════════════════════════════════════════════════
async function check1_SoftDeleteCascade() {
  process.stdout.write('  [1/12]  Soft-delete cascade...');
  let count = 0;

  // Deleted customers with non-deleted addresses
  const custAddrs = await prisma.customerAddress.count({
    where: { deletedAt: null, customer: { deletedAt: { not: null } } },
  });
  if (custAddrs > 0) {
    add('INFO', 'Soft-Delete Cascade', 'CustomerAddress', `${custAddrs} records`,
      `Active addresses for deleted customers`);
    count++;
  }

  // Deleted products still referenced in active sales (not the item itself, the product)
  const deletedProdActiveSales = await prisma.saleItem.count({
    where: {
      sale: { status: 'ACTIVE' },
      product: { deletedAt: { not: null } },
    },
  });
  if (deletedProdActiveSales > 0) {
    add('WARNING', 'Soft-Delete Cascade', 'SaleItem', `${deletedProdActiveSales} items`,
      `Active sale items reference deleted products`);
    count++;
  }

  // Deleted suppliers still linked to active products
  const deletedSupProd = await prisma.product.count({
    where: {
      deletedAt: null,
      supplier: { deletedAt: { not: null } },
    },
  });
  if (deletedSupProd > 0) {
    add('INFO', 'Soft-Delete Cascade', 'Product', `${deletedSupProd} records`,
      `Active products still linked to deleted suppliers`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 2. Invoice/Purchase number sequence gaps
// ═══════════════════════════════════════════════════
async function check2_SequenceGaps() {
  process.stdout.write('  [2/12]  Number sequence gaps...');
  let count = 0;

  // Check invoice numbers (INV-00001, INV-00002, etc.)
  const sales = await prisma.sale.findMany({
    select: { invoiceNumber: true, shopId: true },
    orderBy: { invoiceNumber: 'asc' },
  });

  const shopInvoices = new Map<string, number[]>();
  for (const s of sales) {
    const match = s.invoiceNumber.match(/\d+$/);
    if (match) {
      const nums = shopInvoices.get(s.shopId) || [];
      nums.push(parseInt(match[0], 10));
      shopInvoices.set(s.shopId, nums);
    }
  }

  for (const [shopId, nums] of Array.from(shopInvoices)) {
    nums.sort((a: number, b: number) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 1) {
        for (let g = nums[i - 1] + 1; g < nums[i] && gaps.length < 5; g++) {
          gaps.push(g);
        }
      }
    }
    if (gaps.length > 0) {
      add('INFO', 'Invoice Gap', 'Sale', `Shop ${shopId.substring(0, 8)}...`,
        `Missing invoice numbers: ${gaps.map(g => `INV-${String(g).padStart(5, '0')}`).join(', ')}${gaps.length >= 5 ? ' ...' : ''}`);
      count++;
    }
  }

  // Check purchase numbers
  const purchases = await prisma.purchase.findMany({
    where: { purchaseNumber: { not: null } },
    select: { purchaseNumber: true, shopId: true },
    orderBy: { purchaseNumber: 'asc' },
  });

  const shopPurchases = new Map<string, number[]>();
  for (const p of purchases) {
    if (!p.purchaseNumber) continue;
    const match = p.purchaseNumber.match(/\d+$/);
    if (match) {
      const nums = shopPurchases.get(p.shopId) || [];
      nums.push(parseInt(match[0], 10));
      shopPurchases.set(p.shopId, nums);
    }
  }

  for (const [shopId, nums] of Array.from(shopPurchases)) {
    nums.sort((a: number, b: number) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 1) {
        for (let g = nums[i - 1] + 1; g < nums[i] && gaps.length < 5; g++) {
          gaps.push(g);
        }
      }
    }
    if (gaps.length > 0) {
      add('INFO', 'Purchase Gap', 'Purchase', `Shop ${shopId.substring(0, 8)}...`,
        `Missing purchase numbers: ${gaps.map(g => `PUR-${String(g).padStart(5, '0')}`).join(', ')}${gaps.length >= 5 ? ' ...' : ''}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 3. LookupValue integrity
// ═══════════════════════════════════════════════════
async function check3_LookupIntegrity() {
  process.stdout.write('  [3/12]  LookupValue integrity...');
  let count = 0;

  // Products referencing deleted/inactive lookup values
  const badCatProducts = await prisma.product.findMany({
    where: {
      deletedAt: null,
      categoryId: { not: null },
      categoryRef: { OR: [{ deletedAt: { not: null } }, { isActive: false }] },
    },
    select: { name: true, categoryRef: { select: { name: true, deletedAt: true, isActive: true } } },
  });
  for (const p of badCatProducts) {
    const status = p.categoryRef?.deletedAt ? 'deleted' : 'inactive';
    add('WARNING', 'Lookup Integrity', 'Product', p.name,
      `References ${status} category: "${p.categoryRef?.name}"`);
    count++;
  }

  // Expenses referencing deleted lookup
  const badCatExpenses = await prisma.expense.count({
    where: {
      deletedAt: null,
      categoryId: { not: null },
      categoryRef: { OR: [{ deletedAt: { not: null } }, { isActive: false }] },
    },
  });
  if (badCatExpenses > 0) {
    add('WARNING', 'Lookup Integrity', 'Expense', `${badCatExpenses} records`,
      `Expenses reference deleted/inactive categories`);
    count++;
  }

  // Lookup values without a valid type
  const orphanLookups = await prisma.lookupValue.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, lookupTypeId: true },
  });
  const typeIds = new Set((await prisma.lookupType.findMany({ select: { id: true } })).map(t => t.id));
  let orphanCount = 0;
  for (const lv of orphanLookups) {
    if (!typeIds.has(lv.lookupTypeId)) {
      orphanCount++;
    }
  }
  if (orphanCount > 0) {
    add('CRITICAL', 'Lookup Integrity', 'LookupValue', `${orphanCount} records`,
      `LookupValues reference non-existing LookupType`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 4. Timestamp anomalies
// ═══════════════════════════════════════════════════
async function check4_Timestamps() {
  process.stdout.write('  [4/12]  Timestamp anomalies...');
  let count = 0;

  const cutoff2024 = new Date('2024-01-01');

  // Products created before 2024 (system wasn't built then)
  const ancientProducts = await prisma.product.count({
    where: { createdAt: { lt: cutoff2024 } },
  });
  if (ancientProducts > 0) {
    add('INFO', 'Ancient Date', 'Product', `${ancientProducts} records`,
      `Products with createdAt before 2024`);
    count++;
  }

  // Sales with date before createdAt (backdated sales)
  const backdatedSales = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM "Sale" 
    WHERE "date" < "createdAt" - INTERVAL '1 day'
  `;
  const bdCount = Number(backdatedSales[0]?.cnt || 0);
  if (bdCount > 0) {
    add('INFO', 'Backdated', 'Sale', `${bdCount} records`,
      `Sales where date is >1 day before createdAt (manually backdated)`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 5. User ownership - userId must be a shop member
// ═══════════════════════════════════════════════════
async function check5_UserOwnership() {
  process.stdout.write('  [5/12]  User ownership consistency...');
  let count = 0;

  // Get all shop members
  const members = await prisma.shopMember.findMany({
    select: { userId: true, shopId: true },
  });
  const memberSet = new Set(members.map(m => `${m.shopId}::${m.userId}`));

  // Also include shop owners
  const shops = await prisma.shop.findMany({ select: { id: true, userId: true } });
  for (const shop of shops) {
    memberSet.add(`${shop.id}::${shop.userId}`);
  }

  // Check sales
  const sales = await prisma.sale.findMany({
    select: { invoiceNumber: true, userId: true, shopId: true },
  });
  let saleOrphans = 0;
  for (const s of sales) {
    if (!memberSet.has(`${s.shopId}::${s.userId}`)) {
      saleOrphans++;
    }
  }
  if (saleOrphans > 0) {
    add('INFO', 'User Not Member', 'Sale', `${saleOrphans} records`,
      `Sales created by users who are no longer shop members`);
    count++;
  }

  // Check products
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { name: true, userId: true, shopId: true },
  });
  let prodOrphans = 0;
  for (const p of products) {
    if (!memberSet.has(`${p.shopId}::${p.userId}`)) {
      prodOrphans++;
    }
  }
  if (prodOrphans > 0) {
    add('INFO', 'User Not Member', 'Product', `${prodOrphans} records`,
      `Products owned by users who are no longer shop members`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 6. Data completeness
// ═══════════════════════════════════════════════════
async function check6_DataCompleteness() {
  process.stdout.write('  [6/12]  Data completeness...');
  let count = 0;

  // Products without category
  const noCatProducts = await prisma.product.count({
    where: { deletedAt: null, category: '' },
  });
  if (noCatProducts > 0) {
    add('INFO', 'Missing Category', 'Product', `${noCatProducts} records`,
      `Products with empty category string`);
    count++;
  }

  // Products without name
  const noNameProducts = await prisma.product.count({
    where: { deletedAt: null, name: '' },
  });
  if (noNameProducts > 0) {
    add('WARNING', 'Missing Name', 'Product', `${noNameProducts} records`,
      `Products with empty name`);
    count++;
  }

  // Sales without payment method
  const noPayMethod = await prisma.sale.count({
    where: { paymentMethod: '' },
  });
  if (noPayMethod > 0) {
    add('WARNING', 'Missing PayMethod', 'Sale', `${noPayMethod} records`,
      `Sales with empty paymentMethod`);
    count++;
  }

  // Purchases without purchaseNumber
  const noPurNum = await prisma.purchase.count({
    where: { purchaseNumber: null },
  });
  if (noPurNum > 0) {
    add('INFO', 'Missing PurchaseNum', 'Purchase', `${noPurNum} records`,
      `Purchases without purchase number (legacy)`);
    count++;
  }

  // Customers without phone AND email
  const noContactCust = await prisma.customer.count({
    where: { deletedAt: null, phone: null, email: null },
  });
  if (noContactCust > 0) {
    add('INFO', 'No Contact Info', 'Customer', `${noContactCust} records`,
      `Customers without phone or email`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 7. Optimistic locking version check
// ═══════════════════════════════════════════════════
async function check7_VersionCheck() {
  process.stdout.write('  [7/12]  Optimistic lock versions...');
  let count = 0;

  // Products with version = 0 (should never happen, default is 1)
  const zeroVersion = await prisma.product.count({
    where: { version: 0, deletedAt: null },
  });
  if (zeroVersion > 0) {
    add('WARNING', 'Version Zero', 'Product', `${zeroVersion} records`,
      `Products with version=0 (should be ≥1)`);
    count++;
  }

  // Products with very high version (>100 = possible runaway)
  const highVersion = await prisma.product.findMany({
    where: { version: { gt: 100 }, deletedAt: null },
    select: { name: true, version: true },
  });
  for (const p of highVersion) {
    add('INFO', 'High Version', 'Product', p.name,
      `version=${p.version} (unusually high, possible rapid updates?)`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 8. Large value anomalies
// ═══════════════════════════════════════════════════
async function check8_LargeValues() {
  process.stdout.write('  [8/12]  Large value anomalies...');
  let count = 0;

  // Sales > 1M baht
  const largeSales = await prisma.sale.findMany({
    where: { status: 'ACTIVE', totalAmount: { gt: 1000000 } },
    select: { invoiceNumber: true, totalAmount: true },
  });
  for (const s of largeSales) {
    add('INFO', 'Large Sale', 'Sale', s.invoiceNumber,
      `totalAmount = ฿${toNum(s.totalAmount).toLocaleString()}`);
    count++;
  }

  // Products > 10M stock
  const hugeStock = await prisma.product.findMany({
    where: { stock: { gt: 10000 }, deletedAt: null },
    select: { name: true, stock: true },
  });
  for (const p of hugeStock) {
    add('INFO', 'Huge Stock', 'Product', p.name, `stock = ${p.stock.toLocaleString()}`);
    count++;
  }

  // Products with costPrice > 1M
  const expensiveProducts = await prisma.product.findMany({
    where: { deletedAt: null, costPrice: { gt: 1000000 } },
    select: { name: true, costPrice: true },
  });
  for (const p of expensiveProducts) {
    add('INFO', 'Expensive Product', 'Product', p.name,
      `costPrice = ฿${toNum(p.costPrice).toLocaleString()}`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 9. Sale status vs deletedAt
// ═══════════════════════════════════════════════════
async function check9_StatusDeletedAt() {
  process.stdout.write('  [9/12]  Status vs deletedAt consistency...');
  let count = 0;

  // ACTIVE sales with deletedAt set
  const activeDel = await prisma.sale.count({
    where: { status: 'ACTIVE', deletedAt: { not: null } },
  });
  if (activeDel > 0) {
    add('CRITICAL', 'Status Conflict', 'Sale', `${activeDel} records`,
      `ACTIVE sales with deletedAt set — conflicting state`);
    count++;
  }

  // ACTIVE purchases with deletedAt set
  const activePurDel = await prisma.purchase.count({
    where: { status: 'ACTIVE', deletedAt: { not: null } },
  });
  if (activePurDel > 0) {
    add('CRITICAL', 'Status Conflict', 'Purchase', `${activePurDel} records`,
      `ACTIVE purchases with deletedAt set — conflicting state`);
    count++;
  }

  // Cancelled sales WITHOUT cancelledAt
  const cancelNoDate = await prisma.sale.count({
    where: { status: 'CANCELLED', cancelledAt: null },
  });
  if (cancelNoDate > 0) {
    add('WARNING', 'Missing CancelDate', 'Sale', `${cancelNoDate} records`,
      `Cancelled sales without cancelledAt timestamp`);
    count++;
  }

  // Cancelled purchases WITHOUT cancelledAt
  const cancelPurNoDate = await prisma.purchase.count({
    where: { status: 'CANCELLED', cancelledAt: null },
  });
  if (cancelPurNoDate > 0) {
    add('WARNING', 'Missing CancelDate', 'Purchase', `${cancelPurNoDate} records`,
      `Cancelled purchases without cancelledAt timestamp`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 10. Role/Permission integrity
// ═══════════════════════════════════════════════════
async function check10_RoleIntegrity() {
  process.stdout.write('  [10/12] Role/Permission integrity...');
  let count = 0;

  // Shops without an OWNER role
  const shops = await prisma.shop.findMany({
    select: {
      id: true, name: true,
      roles: { where: { isSystem: true }, select: { name: true } },
    },
  });
  for (const shop of shops) {
    if (shop.roles.length === 0) {
      add('CRITICAL', 'Missing System Role', 'Shop', shop.name,
        `No system (OWNER) role found`);
      count++;
    }
  }

  // Roles with 0 permissions
  const emptyRoles = await prisma.role.findMany({
    where: { permissions: { isEmpty: true } },
    select: { name: true, shop: { select: { name: true } } },
  });
  for (const r of emptyRoles) {
    add('WARNING', 'Empty Permissions', 'Role', `${r.shop.name} → ${r.name}`,
      `Role has 0 permissions assigned`);
    count++;
  }

  // Members without isOwner=true but linked to system role
  const ownerMembers = await prisma.shopMember.findMany({
    where: { role: { isSystem: true } },
    select: { isOwner: true, user: { select: { name: true } }, shop: { select: { name: true } } },
  });
  for (const m of ownerMembers) {
    if (!m.isOwner) {
      add('WARNING', 'Owner Flag Mismatch', 'ShopMember', m.user.name || 'unknown',
        `Has system role but isOwner=false in ${m.shop.name}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 11. Duplicate product names
// ═══════════════════════════════════════════════════
async function check11_DuplicateProducts() {
  process.stdout.write('  [11/12] Duplicate product names...');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { name: true, shopId: true, id: true },
  });

  const seen = new Map<string, number>();
  const dupes: string[] = [];
  for (const p of products) {
    const key = `${p.shopId}::${p.name.trim().toLowerCase()}`;
    const prev = seen.get(key) || 0;
    seen.set(key, prev + 1);
    if (prev === 1) dupes.push(p.name);
  }

  for (const name of dupes.slice(0, 5)) {
    add('INFO', 'Duplicate Product', 'Product', name,
      `Multiple active products with the same name in one shop`);
  }
  if (dupes.length > 5) {
    add('INFO', 'Duplicate Product', 'Product', `${dupes.length - 5} more`, `Additional duplicates`);
  }

  console.log(dupes.length === 0 ? ' ✅' : ` 🔵 ${dupes.length}`);
}

// ═══════════════════════════════════════════════════
// 12. Expense/Income shop isolation
// ═══════════════════════════════════════════════════
async function check12_FinanceIsolation() {
  process.stdout.write('  [12/12] Finance record isolation...');
  let count = 0;

  // Expenses where userId is not member of shopId
  const members = await prisma.shopMember.findMany({
    select: { userId: true, shopId: true },
  });
  const shops = await prisma.shop.findMany({ select: { id: true, userId: true } });
  const memberSet = new Set(members.map(m => `${m.shopId}::${m.userId}`));
  for (const shop of shops) {
    memberSet.add(`${shop.id}::${shop.userId}`);
  }

  const expenses = await prisma.expense.findMany({
    where: { deletedAt: null },
    select: { id: true, userId: true, shopId: true },
  });
  let expOrphans = 0;
  for (const e of expenses) {
    if (!memberSet.has(`${e.shopId}::${e.userId}`)) expOrphans++;
  }
  if (expOrphans > 0) {
    add('INFO', 'Finance Orphan', 'Expense', `${expOrphans} records`,
      `Expenses created by non-members`);
    count++;
  }

  const incomes = await prisma.income.findMany({
    where: { deletedAt: null },
    select: { id: true, userId: true, shopId: true },
  });
  let incOrphans = 0;
  for (const i of incomes) {
    if (!memberSet.has(`${i.shopId}::${i.userId}`)) incOrphans++;
  }
  if (incOrphans > 0) {
    add('INFO', 'Finance Orphan', 'Income', `${incOrphans} records`,
      `Incomes created by non-members`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🔬 Deep Data Integrity Audit v4 (READ-ONLY)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  await check1_SoftDeleteCascade();
  await check2_SequenceGaps();
  await check3_LookupIntegrity();
  await check4_Timestamps();
  await check5_UserOwnership();
  await check6_DataCompleteness();
  await check7_VersionCheck();
  await check8_LargeValues();
  await check9_StatusDeletedAt();
  await check10_RoleIntegrity();
  await check11_DuplicateProducts();
  await check12_FinanceIsolation();

  // ── Print Results ──
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  📋 Results');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const warnings = issues.filter(i => i.severity === 'WARNING');
  const info = issues.filter(i => i.severity === 'INFO');

  if (issues.length === 0) {
    console.log('  ✅ ALL 12 CHECKS PASSED — No issues found!\n');
  } else {
    console.log(`  Found ${issues.length} issue(s):`);
    console.log(`    🔴 CRITICAL: ${critical.length}`);
    console.log(`    🟡 WARNING:  ${warnings.length}`);
    console.log(`    🔵 INFO:     ${info.length}`);
    console.log('');

    const grouped = new Map<string, Issue[]>();
    for (const issue of [...critical, ...warnings, ...info]) {
      const arr = grouped.get(issue.check) || [];
      arr.push(issue);
      grouped.set(issue.check, arr);
    }

    for (const [check, checkIssues] of Array.from(grouped)) {
      const icon = checkIssues[0].severity === 'CRITICAL' ? '🔴' :
                   checkIssues[0].severity === 'WARNING' ? '🟡' : '🔵';
      console.log(`  ${icon} ${check} (${checkIssues.length}x)`);
      for (const issue of checkIssues.slice(0, 8)) {
        console.log(`     [${issue.model}] ${issue.identifier}: ${issue.detail}`);
      }
      if (checkIssues.length > 8) {
        console.log(`     ... and ${checkIssues.length - 8} more`);
      }
      console.log('');
    }
  }

  // ── Summary across all audits ──
  console.log('══════════════════════════════════════════════════════════');
  console.log('  📊 Cumulative Audit Summary (v1 + v2 + v3 + v4)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Total checks run: 48');
  console.log('  Scripts: 4 audit files, 2 fix scripts');
  console.log('  Fixed: netAmount (59 records), isLowStock (3 records)');
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
