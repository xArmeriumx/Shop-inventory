/**
 * Generate Clean DBML for dbdiagram.io
 * - Removes virtual relation fields (Prisma-only, not real DB columns)
 * - Removes noisy Shop/User/ShopMember refs
 * - Adds TableGroup with Thai descriptions
 * - Adds Note descriptions per table
 */

const fs = require('fs');
const path = require('path');

const input = fs.readFileSync(path.join(__dirname, 'schema.dbml'), 'utf-8');

// ─── Step 1: Parse all table names for filtering virtual fields ───
const allTableNames = new Set();
const tableNameRegex = /^Table\s+(\w+)\s*\{/gm;
let m;
while ((m = tableNameRegex.exec(input)) !== null) {
  allTableNames.add(m[1]);
}

// ─── Step 2: Table descriptions (Thai) ───
const tableNotes = {
  User: 'ผู้ใช้งานระบบ (Login Account)',
  Shop: 'ร้านค้า/บริษัท — ศูนย์กลาง Multi-tenancy',
  ShopMember: 'สมาชิกร้านค้า — เชื่อม User กับ Shop + Role',
  Role: 'บทบาท (Admin, Staff, etc.)',
  OnboardingProgress: 'สถานะการตั้งค่าระบบเริ่มต้น',
  LookupType: 'ประเภทค่าคงที่ (หมวดหมู่, หน่วยนับ)',
  LookupValue: 'ค่าคงที่ในระบบ (สินค้า, ค่าใช้จ่าย)',
  Product: 'สินค้า — Master Data หลัก',
  Warehouse: 'คลังสินค้า (รองรับหลายคลัง)',
  WarehouseStock: 'ยอดสินค้าแยกตามคลัง (Bridge Table)',
  StockLog: 'ประวัติการเคลื่อนไหวสต็อก (Event Log)',
  StockTransfer: 'ใบโอนสินค้าข้ามคลัง',
  StockTransferLine: 'รายการสินค้าในใบโอน',
  StockTakeSession: 'รอบการตรวจนับสต็อก',
  StockTakeItem: 'รายการสินค้าที่ตรวจนับ',
  Customer: 'ลูกค้า',
  Supplier: 'ผู้จำหน่าย/Vendor',
  SupplierProduct: 'แคตตาล็อกสินค้าของ Vendor (ราคา, MOQ, Lead Time)',
  PartnerAddress: 'ที่อยู่คู่ค้า (SSOT — ใช้ร่วม Customer+Supplier)',
  PartnerContact: 'ผู้ติดต่อภายใต้ที่อยู่',
  PartnerTaxProfile: 'ข้อมูลภาษีของคู่ค้า',
  Quotation: 'ใบเสนอราคา',
  QuotationLine: 'รายการสินค้าในใบเสนอราคา',
  OrderRequest: 'ใบสั่งขาย/คำขอสั่งซื้อภายใน',
  OrderRequestLine: 'รายการสินค้าในใบสั่งขาย',
  Sale: 'บิลขาย — จุดรวมรายได้หลัก',
  SaleItem: 'รายการสินค้าในบิลขาย',
  Invoice: 'ใบกำกับภาษี/ใบแจ้งหนี้ (มี Snapshot)',
  InvoiceLine: 'รายการสินค้าในใบกำกับภาษี (มี Snapshot)',
  DeliveryOrder: 'ใบสั่งจัดส่งสินค้า',
  DeliveryOrderLine: 'รายการสินค้าในใบจัดส่ง',
  Shipment: 'ข้อมูลการจัดส่ง + Tracking',
  Return: 'ใบรับคืนสินค้า (ฝั่งขาย)',
  ReturnItem: 'รายการสินค้าที่รับคืน',
  Purchase: 'ใบสั่งซื้อ (PO)',
  PurchaseItem: 'รายการสินค้าใน PO',
  PurchaseReceipt: 'ใบรับสินค้าเข้าคลัง (GR)',
  PurchaseReceiptLine: 'รายการสินค้าที่รับเข้าคลัง',
  PurchaseReturn: 'ใบส่งคืนสินค้า (ฝั่งจัดซื้อ)',
  PurchaseReturnItem: 'รายการสินค้าที่ส่งคืน Vendor',
  Payment: 'การรับ/จ่ายเงิน',
  PaymentAllocation: 'การตัดยอดชำระ (1 Payment → N เอกสาร)',
  Expense: 'รายจ่ายทั่วไป',
  Income: 'รายได้อื่นๆ',
  Account: 'ผังบัญชี (Chart of Accounts) — Self-referencing Hierarchy',
  JournalEntry: 'สมุดรายวัน (Double Entry Ledger)',
  JournalLine: 'รายการเดบิต/เครดิต',
  AccountingPeriod: 'รอบระยะเวลาบัญชี (เปิด/ปิดงบ)',
  BankAccount: 'บัญชีธนาคาร',
  BankStatement: 'รายการเดินบัญชี (Statement)',
  BankLine: 'แต่ละรายการใน Statement (Reconciliation)',
  TaxCode: 'รหัสภาษี (VAT 7%, Exempt)',
  CompanyTaxProfile: 'ข้อมูลภาษีของบริษัทเรา',
  ProductTaxProfile: 'ข้อมูลภาษีของสินค้า',
  SalesTaxEntry: 'สมุดรายงานภาษีขาย (ภ.พ.30)',
  PurchaseTaxEntry: 'สมุดรายงานภาษีซื้อ (ภ.พ.30)',
  PurchaseTaxDocument: 'เอกสารภาษีฝั่งจัดซื้อ',
  PurchaseTaxDocumentLink: 'เชื่อม Tax Doc กับ PO',
  PurchaseTaxLine: 'รายการสินค้าในเอกสารภาษีซื้อ',
  WhtCode: 'รหัสหัก ณ ที่จ่าย',
  WhtEntry: 'รายการหัก ณ ที่จ่าย',
  WhtCertificate: 'หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)',
  ApprovalInstance: 'กระบวนการอนุมัติ (Generic Workflow)',
  ApprovalStep: 'ขั้นตอนอนุมัติแต่ละระดับ',
  DocSequence: 'ระบบรันเลขที่เอกสาร (Atomic Counter)',
  SystemLog: 'บันทึก Error/Info ของระบบ',
  AuditLog: 'ประวัติการแก้ไขข้อมูล (Before/After Snapshot)',
  Notification: 'การแจ้งเตือนผู้ใช้',
  CustomerToShopMember: 'ตารางเชื่อม Customer กับ Salesperson',
};

// ─── Step 3: Noisy ref patterns to remove ───
const noisyRefPatterns = [
  /^Ref:\s+\w+\.shopId\s+[-<>]+\s+Shop\.id.*$/,
  /^Ref:\s+\w+\.userId\s+[-<>]+\s+User\.id.*$/,
  /^Ref:\s+\w+\.memberId\s+[-<>]+\s+ShopMember\.id.*$/,
  /^Ref:\s+Shop\.userId\s+[-<>]+\s+User\.id.*$/,
  /^Ref:\s+\w+\.\w*[Mm]emberId\s+[-<>]+\s+ShopMember\.id.*$/,
];

// ─── Step 4: Process tables — remove virtual relation fields ───
function cleanTable(tableBlock, tableName) {
  const lines = tableBlock.split('\n');
  const cleaned = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip lines that are virtual relation fields (type is another Table name or Table[])
    // Pattern: fieldName TableName or fieldName TableName[]
    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\s/);
    if (fieldMatch) {
      const fieldType = fieldMatch[2];
      if (allTableNames.has(fieldType) && fieldType !== tableName) {
        continue; // skip virtual relation field
      }
    }
    // Also skip standalone relation refs like: shop Shop [not null]
    const simpleRelMatch = trimmed.match(/^(\w+)\s+(\w+)$/);
    if (simpleRelMatch && allTableNames.has(simpleRelMatch[2])) {
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join('\n');
}

// ─── Step 5: Build output ───
let output = '';

// Header
output += `//// ════════════════════════════════════════════════════════════════
//// Shop Inventory ERP — Clean Database Schema
//// ════════════════════════════════════════════════════════════════
//// เอกสารนี้ออกแบบมาเพื่อให้อ่านง่าย:
////   ✅ ลบ Virtual Relation Fields (Prisma-only) ออก → เหลือแค่ Column จริง
////   ✅ ลบเส้น Ref ที่เป็น "ใยแมงมุม" (Shop/User/ShopMember) ออก
////   ✅ เพิ่ม TableGroup แบ่งสี 7 โดเมน
////   ✅ เพิ่ม Note อธิบายภาษาไทยทุกตาราง
////
//// 📌 หมายเหตุ: ทุกตาราง (ยกเว้น User, SystemLog, AuditLog)
////    มี shopId เชื่อมกับ Shop เสมอ — ไม่แสดงเส้นเพื่อลดความรก
//// ════════════════════════════════════════════════════════════════

Project "Shop Inventory ERP" {
  database_type: 'PostgreSQL'
  Note: 'ระบบ ERP สำหรับร้านค้า — รองรับ Multi-tenant, Double Entry Accounting, Thai Tax Compliance'
}

`;

// Table Groups
output += `
//// ──────────────────────────────────────────────────
//// TABLE GROUPS (จัดกลุ่มตาราง 7 โดเมน)
//// ──────────────────────────────────────────────────

TableGroup iam [color: #3498db] {
  // 🔐 Identity & Access Management
  User
  Shop
  ShopMember
  Role
  OnboardingProgress
}

TableGroup master_data [color: #2ecc71] {
  // 📦 Master Data & Configuration
  Product
  LookupType
  LookupValue
  SupplierProduct
  DocSequence
}

TableGroup crm [color: #e67e22] {
  // 👥 CRM & Partners (SSOT Address)
  Customer
  Supplier
  PartnerAddress
  PartnerContact
  PartnerTaxProfile
}

TableGroup inventory [color: #9b59b6] {
  // 🏭 Inventory & Warehouse
  Warehouse
  WarehouseStock
  StockLog
  StockTransfer
  StockTransferLine
  StockTakeSession
  StockTakeItem
}

TableGroup sales [color: #e74c3c] {
  // 💰 Order-to-Cash (งานขาย)
  Quotation
  QuotationLine
  OrderRequest
  OrderRequestLine
  Sale
  SaleItem
  Invoice
  InvoiceLine
  DeliveryOrder
  DeliveryOrderLine
  Shipment
  Return
  ReturnItem
  ApprovalInstance
  ApprovalStep
}

TableGroup purchases [color: #f39c12] {
  // 🛒 Procure-to-Pay (งานจัดซื้อ)
  Purchase
  PurchaseItem
  PurchaseReceipt
  PurchaseReceiptLine
  PurchaseReturn
  PurchaseReturnItem
}

TableGroup finance [color: #1abc9c] {
  // 📊 Finance & Accounting
  Account
  JournalEntry
  JournalLine
  AccountingPeriod
  BankAccount
  BankStatement
  BankLine
  Payment
  PaymentAllocation
  Expense
  Income
}

TableGroup tax [color: #c0392b] {
  // 🧾 Thai Tax Compliance
  TaxCode
  CompanyTaxProfile
  ProductTaxProfile
  SalesTaxEntry
  PurchaseTaxEntry
  PurchaseTaxDocument
  PurchaseTaxDocumentLink
  PurchaseTaxLine
  WhtCode
  WhtEntry
  WhtCertificate
}

TableGroup system [color: #7f8c8d] {
  // ⚙️ System & Audit
  SystemLog
  AuditLog
  Notification
}

`;

// ─── Step 6: Process each table ───
const tableRegex = /^(Table\s+(\w+)\s*\{[\s\S]*?^\})/gm;
let match;
const tables = [];
while ((match = tableRegex.exec(input)) !== null) {
  tables.push({ full: match[1], name: match[2] });
}

for (const t of tables) {
  const cleaned = cleanTable(t.full, t.name);
  const note = tableNotes[t.name];

  // Add section header comment
  output += `\n`;
  if (note) {
    output += `//// 📋 ${t.name}: ${note}\n`;
  }
  output += cleaned + '\n';
}

// ─── Step 7: Enums ───
output += '\n\n//// ══════════════════════════════════════\n';
output += '//// ENUMS (ค่าคงที่ของระบบ)\n';
output += '//// ══════════════════════════════════════\n\n';

const enumRegex = /^(Enum\s+\w+\s*\{[\s\S]*?^\})/gm;
while ((match = enumRegex.exec(input)) !== null) {
  output += match[1] + '\n\n';
}

// ─── Step 8: Clean Refs ───
output += '\n//// ══════════════════════════════════════\n';
output += '//// RELATIONSHIPS (เฉพาะ Business Logic)\n';
output += '//// ลบเส้น Shop/User/ShopMember ออกแล้ว\n';
output += '//// ══════════════════════════════════════\n\n';

const refLines = input.split('\n').filter(l => l.startsWith('Ref:'));
let keptCount = 0;
let removedCount = 0;

for (const refLine of refLines) {
  const isNoisy = noisyRefPatterns.some(p => p.test(refLine.trim()));
  if (!isNoisy) {
    output += refLine + '\n\n';
    keptCount++;
  } else {
    removedCount++;
  }
}

output += `//// ═══════════════════════════════════════════════════\n`;
output += `//// สถิติ: เส้น Ref ที่เก็บไว้ ${keptCount} เส้น / ลบออก ${removedCount} เส้น\n`;
output += `//// ═══════════════════════════════════════════════════\n`;

// Write output
const outPath = path.join(__dirname, 'schema-clean.dbml');
fs.writeFileSync(outPath, output, 'utf-8');

console.log(`\n✅ Clean DBML generated successfully!`);
console.log(`📁 Output: ${outPath}`);
console.log(`📊 Stats:`);
console.log(`   - Tables processed: ${tables.length}`);
console.log(`   - Refs kept (Business Logic): ${keptCount}`);
console.log(`   - Refs removed (Noise): ${removedCount}`);
console.log(`\n💡 วิธีใช้: Copy เนื้อหาในไฟล์ schema-clean.dbml ไปวางใน https://dbdiagram.io`);
