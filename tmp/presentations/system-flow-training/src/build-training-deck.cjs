const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const runtimeNodeModules = '/Users/napat.a/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
process.env.NODE_PATH = runtimeNodeModules;
Module._initPaths();

const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const { chromium } = require('/Users/napat.a/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let SHAPE;

const WORK = path.resolve(__dirname, '..');
const OUT = path.join(WORK, 'output');
const SCRATCH = path.join(WORK, 'scratch');
const ASSETS = path.join(SCRATCH, 'assets');
const MMD = path.join(SCRATCH, 'mermaid');
const PREVIEWS = path.join(SCRATCH, 'previews');
const FINAL = path.join(OUT, 'shop-inventory-system-flow-training.pptx');
const FINAL_PDF = path.join(OUT, 'shop-inventory-system-flow-training.pdf');
const FINAL_HTML = path.join(OUT, 'shop-inventory-system-flow-training.html');

for (const dir of [OUT, SCRATCH, ASSETS, MMD, PREVIEWS]) fs.mkdirSync(dir, { recursive: true });

const palette = {
  ink: '16202A',
  ink2: '2F3C48',
  muted: '6B7A88',
  paper: 'F8FAF7',
  white: 'FFFFFF',
  line: 'D6DED7',
  green: '256F5B',
  green2: '3AA17E',
  gold: 'D49A2A',
  red: 'C84B4B',
  blue: '2D6CDF',
  violet: '7457C8',
  tealSoft: 'E8F4EE',
  goldSoft: 'FFF2D4',
  blueSoft: 'EAF1FF',
  redSoft: 'FDECEC',
  graySoft: 'EEF2F3',
  dark: '0F1720',
};

const slides = [
  {
    no: 1,
    kind: 'cover',
    title: 'Shop Inventory ERP',
    subtitle: 'System Flow Training Deck',
    kicker: 'Project structure • Database • Usage flows',
    note: 'สื่อการสอนสำหรับเข้าใจโครงสร้างและ flow ทั้งระบบ',
  },
  {
    no: 2,
    kind: 'map',
    title: 'เราจะอ่านระบบนี้จาก 5 ชั้น',
    subtitle: 'เริ่มจากผู้ใช้ แล้วค่อยเจาะลงไปถึงฐานข้อมูลและ service กลาง',
    points: [
      ['1', 'Usage Flow', 'ผู้ใช้ทำอะไรในระบบจริง'],
      ['2', 'UI + Actions', 'หน้าจอเรียก server action อย่างไร'],
      ['3', 'Services', 'business logic และ transaction อยู่ที่ไหน'],
      ['4', 'Database', 'โมเดลหลักเชื่อมกันอย่างไร'],
      ['5', 'Core Controls', 'RBAC, audit, sequence, stock, accounting'],
    ],
  },
  {
    no: 3,
    kind: 'diagram',
    title: 'ภาพรวม Architecture',
    subtitle: 'Next.js monolith ที่แยก UI, action, service, DB และ core control ชัดเจน',
    diagram: 'architecture',
    takeaway: 'Service layer คือสมองของระบบ ส่วน Server Actions คือประตูรับข้อมูลจาก UI',
  },
  {
    no: 4,
    kind: 'diagram',
    title: 'โครงสร้างโปรเจกต์ตามหน้าที่',
    subtitle: 'ถ้าจะตาม feature ให้ไล่จาก route/page -> action -> schema -> service -> Prisma model',
    diagram: 'project_structure',
    takeaway: 'โค้ดถูกจัดตาม responsibility มากกว่าจัดตามหน้าอย่างเดียว',
  },
  {
    no: 5,
    kind: 'diagram',
    title: 'Request Lifecycle',
    subtitle: 'ตัวอย่างเส้นทางเมื่อผู้ใช้กดสร้างสินค้าใหม่',
    diagram: 'request_lifecycle',
    takeaway: 'ทุก mutation ควรผ่าน auth, validation, service transaction, audit และ cache revalidation',
  },
  {
    no: 6,
    kind: 'diagram',
    title: 'Auth และ RBAC',
    subtitle: 'NextAuth สร้าง session, getSessionContext เติม shop/member/permission ก่อนเข้า service',
    diagram: 'auth_rbac',
    takeaway: 'Owner ข้าม permission ได้ แต่ Member ต้องผ่าน Role.permissions',
  },
  {
    no: 7,
    kind: 'diagram',
    title: 'Database Domain Map',
    subtitle: 'Shop คือ tenant boundary; domain อื่น ๆ ผูกกับ shopId เพื่อกันข้อมูลข้ามร้าน',
    diagram: 'db_domain_map',
    takeaway: 'อ่าน DB เป็นกลุ่ม domain จะเข้าใจง่ายกว่าอ่านทีละ model',
  },
  {
    no: 8,
    kind: 'diagram',
    title: 'Multi-Tenant Data Boundary',
    subtitle: 'ทุก service ต้องใช้ ctx.shopId เป็น filter หรือ guard ก่อนอ่าน/เขียนข้อมูลธุรกิจ',
    diagram: 'tenant_boundary',
    takeaway: 'shopId คือเส้นแบ่งข้อมูลที่สำคัญที่สุดของระบบ',
  },
  {
    no: 9,
    kind: 'diagram',
    title: 'Inventory: ความจริงของสต็อก',
    subtitle: 'WarehouseStock เป็น source of truth; Product.stock เป็น read cache สำหรับ list/filter/sort',
    diagram: 'inventory_flow',
    takeaway: 'การเปลี่ยน stock ต้องผ่าน StockEngine เพื่อ sync cache และสร้าง StockLog',
  },
  {
    no: 10,
    kind: 'diagram',
    title: 'Sales Flow แบบ End-to-End',
    subtitle: 'หนึ่งบิลขายแตะหลาย subsystem: stock, tax, payment, delivery, accounting และ audit',
    diagram: 'sales_flow',
    takeaway: 'SaleService ทำ orchestration แต่เรียก core services เป็นเจ้าของกฎเฉพาะทาง',
  },
  {
    no: 11,
    kind: 'diagram',
    title: 'Sale DB Normalization และ Mapper Shield',
    subtitle: 'Sale ยังมี legacy fields ขณะเดียวกันก็แยก child tables สำหรับ status, tax และ payment',
    diagram: 'sale_mapper',
    takeaway: 'UI ควรอ่านผ่าน SaleMapper เพื่อได้ DTO flat ที่เสถียร',
  },
  {
    no: 12,
    kind: 'diagram',
    title: 'Procurement Flow',
    subtitle: 'จาก PR/PO ไปจนถึง receiving, purchase tax, stock-in และ accounting posting',
    diagram: 'procurement_flow',
    takeaway: 'รับสินค้าเข้าคลังเป็นจุดเชื่อมสำคัญระหว่าง PurchaseReceipt, StockLog และ Journal',
  },
  {
    no: 13,
    kind: 'diagram',
    title: 'Tax + Accounting Flow',
    subtitle: 'เอกสารธุรกิจถูก resolve ภาษี คำนวณยอด และ post เป็น journal entry',
    diagram: 'tax_accounting',
    takeaway: 'ComputationEngine คุมเลขเงิน ส่วน PostingService คุม debit/credit',
  },
  {
    no: 14,
    kind: 'diagram',
    title: 'AI และ OCR Flow',
    subtitle: 'API route ใช้ withAuth + rate limit ก่อนเรียก Groq, OCR extraction และ ERP tools',
    diagram: 'ai_ocr',
    takeaway: 'AI ไม่ควรข้าม service layer เพราะ tool execution ยังต้องเคารพ shopId และ permission',
  },
  {
    no: 15,
    kind: 'diagram',
    title: 'Usage Flow สำหรับการใช้งานจริง',
    subtitle: 'มุมมองผู้ใช้: ตั้งค่าร้าน -> master data -> ซื้อเข้า -> ขายออก -> ปิดบัญชี/รายงาน',
    diagram: 'usage_flow',
    takeaway: 'flow ธุรกิจหมุนเป็นวงจร ไม่ใช่ feature แยกขาดจากกัน',
  },
  {
    no: 16,
    kind: 'diagram',
    title: 'อ่านโค้ดหรือ Debug Feature อย่างไร',
    subtitle: 'เส้นทางที่เร็วที่สุดเมื่ออยากเข้าใจหรือแก้บั๊กใน feature ใด feature หนึ่ง',
    diagram: 'debug_path',
    takeaway: 'เริ่มจาก route/page แล้วตาม action ไป service และ Prisma model',
  },
  {
    no: 17,
    kind: 'table',
    title: 'จุดที่ควรระวังในโปรเจกต์ปัจจุบัน',
    subtitle: 'ระบบออกแบบดี แต่มีร่องรอย migration/hardening หลายช่วงที่ควรจำไว้',
    rows: [
      ['Docs บางส่วนเก่า', 'เอกสารเดิมพูดถึง 20 models แต่ schema จริงมีมากกว่า'],
      ['Sale มี legacy + child tables', 'อ่านผ่าน SaleMapper เพื่อเลี่ยง field ไม่ครบ'],
      ['Product.stock เป็น cache', 'stock จริงดู WarehouseStock หรือ StockService'],
      ['Phase/backfill comments', 'บางโมดูลอยู่ระหว่าง migration และ cleanup'],
      ['Seed script อาจไม่ตรง', 'package.json ชี้ prisma/seed.ts แต่ไฟล์นี้ไม่อยู่ในรายการปัจจุบัน'],
      ['Test coverage ยังบาง', 'ควรเพิ่ม service tests สำหรับ sales, stock, accounting'],
    ],
  },
  {
    no: 18,
    kind: 'summary',
    title: 'Mental Model จำง่าย',
    subtitle: 'ถ้าจำภาพนี้ได้ จะอ่านระบบต่อเองง่ายขึ้นมาก',
    pairs: [
      ['Shop', 'กรอบข้อมูลของแต่ละร้าน'],
      ['Role / Permission', 'ประตูสิทธิ์'],
      ['Server Action', 'ทางเข้าจาก UI'],
      ['Service', 'สมองของ business logic'],
      ['WarehouseStock', 'ความจริงของสต็อก'],
      ['JournalEntry', 'ความจริงทางบัญชี'],
      ['AuditLog', 'ประวัติว่าใครทำอะไร'],
    ],
  },
];

const diagrams = {
  architecture: {
    mmd: `flowchart TB
    User["ผู้ใช้งาน\\nBrowser / POS / Electron"] --> UI["UI\\nsrc/app + components"]
    UI --> Actions["Server Actions\\nsrc/actions"]
    Actions --> Guard["Auth Guard\\nRBAC + Rate Limit"]
    Actions --> Schemas["Zod Schemas\\nvalidate + sanitize"]
    Guard --> Services["Service Layer\\nsrc/services"]
    Schemas --> Services
    Services --> Core["Core Services\\nAudit / Sequence / Workflow / Security"]
    Services --> Prisma["Prisma Client\\nsrc/lib/db.ts"]
    Prisma --> DB[("PostgreSQL")]
    Services --> Storage["Supabase Storage"]
    Services --> AI["Groq AI / OCR / Tools"]`,
    nodes: [
      ['User', 40, 180, 210, 78, palette.dark],
      ['UI', 305, 180, 210, 78, palette.green],
      ['Actions', 570, 180, 210, 78, palette.blue],
      ['Guard', 835, 85, 210, 78, palette.gold],
      ['Schemas', 835, 275, 210, 78, palette.violet],
      ['Services', 1100, 180, 230, 88, palette.green2],
      ['Core', 1395, 75, 250, 88, palette.ink],
      ['Prisma', 1395, 250, 250, 88, palette.blue],
      ['DB', 1690, 250, 180, 88, palette.ink2],
      ['Storage', 1395, 430, 250, 78, palette.gold],
      ['AI', 1690, 430, 180, 78, palette.violet],
    ],
    edges: [['User','UI'],['UI','Actions'],['Actions','Guard'],['Actions','Schemas'],['Guard','Services'],['Schemas','Services'],['Services','Core'],['Services','Prisma'],['Prisma','DB'],['Services','Storage'],['Services','AI']],
  },
  project_structure: {
    mmd: `flowchart LR
    App["src/app\\nRoutes + Pages"] --> Components["src/components\\nUI ตาม domain"]
    Components --> Actions["src/actions\\nServer Actions"]
    App --> Actions
    Actions --> Schemas["src/schemas\\nValidation"]
    Actions --> Services["src/services\\nBusiness Logic"]
    Services --> Policies["src/policies\\nAudit Policies"]
    Services --> Lib["src/lib\\nShared Infra"]
    Services --> Types["src/types\\nDTO + Contracts"]
    Services --> Prisma["prisma/schema.prisma\\nDatabase Models"]`,
    nodes: [
      ['App', 70, 170, 215, 80, palette.ink],
      ['Components', 335, 170, 240, 80, palette.green],
      ['Actions', 635, 170, 225, 80, palette.blue],
      ['Schemas', 940, 55, 225, 72, palette.violet],
      ['Services', 940, 210, 225, 86, palette.green2],
      ['Policies', 1235, 20, 220, 72, palette.gold],
      ['Lib', 1235, 130, 220, 72, palette.ink2],
      ['Types', 1235, 240, 220, 72, palette.blue],
      ['Prisma', 1500, 190, 305, 86, palette.red],
    ],
    edges: [['App','Components'],['Components','Actions'],['App','Actions'],['Actions','Schemas'],['Actions','Services'],['Services','Policies'],['Services','Lib'],['Services','Types'],['Services','Prisma']],
  },
  request_lifecycle: {
    mmd: `sequenceDiagram
    actor User
    participant UI as Client Component
    participant Action as Server Action
    participant Auth as requirePermission
    participant Zod as Zod Schema
    participant Service as ProductService
    participant Stock as StockEngine
    participant DB as Prisma/PostgreSQL
    User->>UI: Submit form
    UI->>Action: createProduct(input)
    Action->>Auth: session + PRODUCT_CREATE
    Action->>Zod: validate + sanitize
    Action->>Service: create(ctx, payload)
    Service->>DB: create Product transaction
    Service->>Stock: initial stock movement
    Stock->>DB: WarehouseStock + StockLog
    Service-->>Action: data + affectedTags
    Action-->>UI: ActionResponse`,
    type: 'swimlane',
    lanes: ['User', 'UI', 'Action', 'Auth', 'Zod', 'Service', 'Stock', 'DB'],
    steps: [
      [0,1,'Submit form'], [1,2,'createProduct(input)'], [2,3,'session + permission'], [2,4,'validate + sanitize'], [2,5,'create(ctx,payload)'], [5,7,'create Product'], [5,6,'initial stock'], [6,7,'WarehouseStock + Log'], [5,2,'data + tags'], [2,1,'ActionResponse'],
    ],
  },
  auth_rbac: {
    mmd: `flowchart TB
    Login["Login Credentials"] --> JWT["NextAuth JWT Session"]
    JWT --> Middleware["Middleware route guard"]
    Middleware --> Context["getSessionContext()"]
    Context --> Member["ShopMember"]
    Member --> Role["Role.permissions"]
    Role --> Context
    Context --> Action["Server Action"]
    Action --> Service["Service Security.require"]`,
    nodes: [
      ['Login', 80, 210, 240, 72, palette.ink],
      ['JWT', 380, 210, 250, 72, palette.blue],
      ['Middleware', 690, 210, 250, 72, palette.gold],
      ['Context', 1010, 210, 250, 72, palette.green],
      ['Member', 1010, 380, 250, 72, palette.ink2],
      ['Role', 1320, 380, 250, 72, palette.violet],
      ['Action', 1320, 210, 250, 72, palette.blue],
      ['Service', 1630, 210, 250, 72, palette.green2],
    ],
    edges: [['Login','JWT'],['JWT','Middleware'],['Middleware','Context'],['Context','Member'],['Member','Role'],['Role','Context'],['Context','Action'],['Action','Service']],
  },
  db_domain_map: {
    mmd: `flowchart TB
    Shop["Shop / Tenant"] --> IAM["IAM\\nUser Role Member"]
    Shop --> Master["Master Data\\nProduct Customer Supplier"]
    Shop --> Inventory["Inventory\\nWarehouseStock StockLog"]
    Shop --> Sales["Sales\\nSale Invoice Payment"]
    Shop --> Procurement["Procurement\\nPurchase Receiving"]
    Shop --> Tax["Tax\\nVAT WHT TaxCode"]
    Shop --> Accounting["Accounting\\nAccount Journal Bank"]
    Shop --> Core["Core\\nAudit Sequence Approval"]
    Master --> Inventory
    Inventory --> Sales
    Procurement --> Inventory
    Sales --> Tax
    Procurement --> Tax
    Sales --> Accounting
    Procurement --> Accounting
    Core --> Sales`,
    nodes: [
      ['Shop', 815, 40, 280, 80, palette.dark],
      ['IAM', 105, 220, 250, 80, palette.ink2],
      ['Master', 405, 220, 260, 80, palette.green],
      ['Inventory', 705, 220, 260, 80, palette.gold],
      ['Sales', 1005, 220, 260, 80, palette.blue],
      ['Procurement', 1305, 220, 260, 80, palette.green2],
      ['Tax', 555, 430, 260, 80, palette.violet],
      ['Accounting', 875, 430, 260, 80, palette.red],
      ['Core', 1195, 430, 260, 80, palette.ink],
    ],
    edges: [['Shop','IAM'],['Shop','Master'],['Shop','Inventory'],['Shop','Sales'],['Shop','Procurement'],['Shop','Tax'],['Shop','Accounting'],['Shop','Core'],['Master','Inventory'],['Inventory','Sales'],['Procurement','Inventory'],['Sales','Tax'],['Procurement','Tax'],['Sales','Accounting'],['Procurement','Accounting'],['Core','Sales']],
  },
  tenant_boundary: {
    mmd: `flowchart LR
    Session["SessionContext\\nuserId shopId memberId"] --> Service["Service Method"]
    Service --> Guard["Security.assertSameShop"]
    Service --> Query["Prisma where: { shopId: ctx.shopId }"]
    Query --> Data[("Tenant Data")]
    Guard --> Audit["Audit denied if cross-tenant"]`,
    nodes: [
      ['Session', 120, 230, 300, 95, palette.dark],
      ['Service', 520, 230, 260, 95, palette.green],
      ['Guard', 900, 105, 310, 90, palette.gold],
      ['Query', 900, 345, 310, 90, palette.blue],
      ['Data', 1325, 345, 260, 90, palette.ink2],
      ['Audit', 1325, 105, 300, 90, palette.red],
    ],
    edges: [['Session','Service'],['Service','Guard'],['Service','Query'],['Query','Data'],['Guard','Audit']],
  },
  inventory_flow: {
    mmd: `flowchart LR
    Movement["Movement Request\\nSALE PURCHASE ADJUSTMENT TRANSFER"] --> Engine["StockEngine.executeMovement"]
    Engine --> Resolve["resolveWarehouse"]
    Resolve --> Validate["Validate Stock\\nSTRICT / WARN / ALLOW_NEGATIVE"]
    Validate --> Upsert["Upsert WarehouseStock\\nSource of Truth"]
    Upsert --> Sync["Sync Product.stock\\nRead Cache"]
    Sync --> Log["Create StockLog\\nAudit Trail"]`,
    nodes: [
      ['Movement', 160, 80, 330, 86, palette.dark],
      ['Engine', 620, 80, 310, 86, palette.green],
      ['Resolve', 1080, 80, 280, 86, palette.blue],
      ['Validate', 160, 330, 330, 92, palette.gold],
      ['Upsert', 620, 330, 310, 92, palette.green2],
      ['Sync', 1080, 330, 280, 92, palette.violet],
      ['Log', 1450, 330, 280, 92, palette.ink2],
    ],
    edges: [['Movement','Engine'],['Engine','Resolve'],['Resolve','Validate'],['Validate','Upsert'],['Upsert','Sync'],['Sync','Log']],
  },
  sales_flow: {
    mmd: `flowchart LR
    Start["POS / ERP Sale\\nCustomer + Items"]
    Start --> Validate["Validate + Calculate\\nStock / VAT / Profit"]
    Validate --> Sale["Create Sale\\nSaleItem + Child Tables"]
    Sale --> Reserve["Reserve Stock"]
    Sale --> Invoice["Invoice"]
    Invoice --> Payment["Payment"]
    Invoice --> Delivery["Delivery / Shipment"]
    Delivery --> Deduct["Deduct Stock"]
    Payment --> Journal["JournalEntry"]
    Deduct --> Journal
    Sale --> Audit["Audit + Notification"]`,
    nodes: [
      ['Start', 90, 60, 230, 68, palette.dark], ['Customer', 380, 60, 250, 68, palette.green], ['Items', 690, 60, 250, 68, palette.green2],
      ['Stock', 1000, 60, 250, 68, palette.gold], ['Calc', 1310, 60, 270, 78, palette.blue], ['Seq', 1640, 60, 230, 78, palette.violet],
      ['Sale', 740, 245, 330, 86, palette.ink], ['Reserve', 420, 430, 230, 68, palette.gold], ['Invoice', 760, 430, 230, 68, palette.blue],
      ['Payment', 570, 600, 230, 68, palette.green], ['Delivery', 920, 600, 250, 68, palette.green2], ['Deduct', 1260, 600, 230, 68, palette.red],
      ['Journal', 905, 775, 260, 68, palette.ink2], ['Audit', 1210, 430, 260, 68, palette.violet],
    ],
    edges: [['Start','Customer'],['Customer','Items'],['Items','Stock'],['Stock','Calc'],['Calc','Seq'],['Seq','Sale'],['Sale','Reserve'],['Sale','Invoice'],['Invoice','Payment'],['Invoice','Delivery'],['Delivery','Deduct'],['Payment','Journal'],['Deduct','Journal'],['Sale','Audit']],
  },
  sale_mapper: {
    mmd: `flowchart LR
    DB["Sale DB Record"] --> Legacy["Legacy Fields\\nstatus tax payment"]
    DB --> Child["Child Tables\\nSaleStatus SaleTaxSummary SalePaymentDetail"]
    Legacy --> Mapper["SaleMapper\\nresolve with fallback"]
    Child --> Mapper
    Mapper --> DTO["Flat DTO for UI\\nSaleListDTO / SaleDetailDTO"]
    DTO --> UI["UI Components"]`,
    nodes: [
      ['DB', 90, 240, 250, 85, palette.dark],
      ['Legacy', 450, 130, 310, 85, palette.gold],
      ['Child', 450, 355, 330, 95, palette.blue],
      ['Mapper', 900, 240, 310, 90, palette.green],
      ['DTO', 1320, 240, 300, 90, palette.violet],
      ['UI', 1710, 240, 160, 90, palette.ink2],
    ],
    edges: [['DB','Legacy'],['DB','Child'],['Legacy','Mapper'],['Child','Mapper'],['Mapper','DTO'],['DTO','UI']],
  },
  procurement_flow: {
    mmd: `flowchart LR
    PR["Order Request / PR"] --> Approval["Approval Workflow"]
    Approval --> PO["Purchase Order"]
    PO --> Supplier["Supplier + SupplierProduct"]
    PO --> Receive["Purchase Receiving"]
    Receive --> Receipt["PurchaseReceipt + Lines"]
    Receipt --> StockIn["StockEngine PURCHASE"]
    StockIn --> Cost["Update Cost / Inventory Value"]
    Receipt --> Tax["Purchase Tax Document"]
    Receipt --> AP["Accounting AP / Inventory Posting"]
    PO --> Audit["AuditLog"]`,
    nodes: [
      ['PR', 100, 80, 250, 72, palette.dark], ['Approval', 420, 80, 260, 72, palette.gold], ['PO', 750, 80, 250, 72, palette.green],
      ['Supplier', 1080, 80, 290, 72, palette.ink2], ['Receive', 750, 270, 260, 72, palette.blue], ['Receipt', 1070, 270, 290, 72, palette.green2],
      ['StockIn', 300, 500, 300, 78, palette.gold], ['Cost', 680, 500, 300, 78, palette.violet], ['Tax', 1060, 500, 300, 78, palette.blue], ['AP', 1440, 500, 330, 78, palette.red], ['Audit', 1440, 80, 260, 72, palette.ink],
    ],
    edges: [['PR','Approval'],['Approval','PO'],['PO','Supplier'],['PO','Receive'],['Receive','Receipt'],['Receipt','StockIn'],['StockIn','Cost'],['Receipt','Tax'],['Receipt','AP'],['PO','Audit']],
  },
  tax_accounting: {
    mmd: `flowchart LR
    Doc["Business Document\\nInvoice Payment Purchase Return"] --> TaxResolution["TaxResolutionService"]
    TaxResolution --> Compute["ComputationEngine"]
    Compute --> TaxEntries["SalesTax / PurchaseTax / WHT"]
    Doc --> Posting["PostingService\\npreview / post"]
    Posting --> Mapping["Account Mapping"]
    Mapping --> Period["AccountingPeriod Lock"]
    Period --> Journal["JournalEntry + JournalLine"]
    Journal --> Reports["Financial Reports"]
    TaxEntries --> Reports`,
    nodes: [
      ['Doc', 110, 160, 330, 86, palette.dark], ['TaxResolution', 570, 70, 300, 78, palette.violet], ['Compute', 1000, 70, 280, 78, palette.blue],
      ['TaxEntries', 1410, 70, 320, 78, palette.gold], ['Posting', 570, 320, 300, 86, palette.green], ['Mapping', 1000, 320, 280, 78, palette.ink2],
      ['Period', 1410, 320, 320, 78, palette.red], ['Journal', 1000, 560, 320, 78, palette.green2], ['Reports', 1410, 560, 320, 78, palette.dark],
    ],
    edges: [['Doc','TaxResolution'],['TaxResolution','Compute'],['Compute','TaxEntries'],['Doc','Posting'],['Posting','Mapping'],['Mapping','Period'],['Period','Journal'],['Journal','Reports'],['TaxEntries','Reports']],
  },
  ai_ocr: {
    mmd: `flowchart TB
    User["ผู้ใช้ถาม AI / Upload OCR"] --> API["API Route\\n/api/ai/chat / api/ocr"]
    API --> Auth["withAuth + Rate Limit"]
    Auth --> Context["Shop Context"]
    Context --> Groq["Groq LLM"]
    Groq --> Tools["ERP AI Tools"]
    Tools --> Services["ERP Services"]
    Services --> DB[("Database")]
    Groq --> Response["Stream / JSON Response"]
    Tools --> Response`,
    nodes: [
      ['User', 110, 160, 300, 78, palette.dark], ['API', 520, 160, 300, 78, palette.blue], ['Auth', 930, 160, 300, 78, palette.gold], ['Context', 1340, 160, 300, 78, palette.green],
      ['Groq', 720, 400, 280, 78, palette.violet], ['Tools', 1100, 400, 280, 78, palette.green2], ['Services', 1480, 400, 280, 78, palette.ink2], ['DB', 1480, 610, 280, 78, palette.dark], ['Response', 720, 610, 300, 78, palette.blue],
    ],
    edges: [['User','API'],['API','Auth'],['Auth','Context'],['Context','Groq'],['Groq','Tools'],['Tools','Services'],['Services','DB'],['Groq','Response'],['Tools','Response']],
  },
  usage_flow: {
    mmd: `flowchart LR
    Setup["ตั้งค่าร้าน\\nShop Role Warehouse Tax COA"] --> Master["Master Data\\nProduct Customer Supplier"]
    Master --> Buy["ซื้อเข้า\\nPR -> PO -> Receiving"]
    Buy --> StockIn["Stock In\\nWarehouseStock + StockLog"]
    StockIn --> Sell["ขายออก\\nPOS/Sale -> Invoice -> Payment"]
    Sell --> StockOut["Stock Out\\nDelivery / Shipment"]
    Sell --> Finance["Accounting + Tax\\nJournal VAT WHT"]
    StockOut --> Finance
    Finance --> Report["Dashboard / Reports / Audit"]
    Report --> Master`,
    nodes: [
      ['Setup', 190, 90, 340, 86, palette.dark], ['Master', 700, 90, 340, 86, palette.green], ['Buy', 1210, 90, 340, 86, palette.blue],
      ['StockIn', 1210, 310, 340, 86, palette.gold], ['Sell', 700, 310, 340, 86, palette.green2], ['StockOut', 190, 310, 340, 86, palette.red],
      ['Finance', 450, 565, 340, 86, palette.violet], ['Report', 955, 565, 340, 86, palette.ink2],
    ],
    edges: [['Setup','Master'],['Master','Buy'],['Buy','StockIn'],['StockIn','Sell'],['Sell','StockOut'],['Sell','Finance'],['StockOut','Finance'],['Finance','Report'],['Report','Master']],
  },
  debug_path: {
    mmd: `flowchart LR
    Route["1 Route/Page"] --> Component["2 Component"]
    Component --> Action["3 Server Action"]
    Action --> Schema["4 Zod Schema"]
    Schema --> Service["5 Service"]
    Service --> Model["6 Prisma Model"]
    Model --> Core["7 Core Side Effects\\nAudit Stock Accounting Cache"]`,
    nodes: [
      ['Route', 70, 250, 210, 72, palette.dark], ['Component', 330, 250, 220, 72, palette.green], ['Action', 600, 250, 220, 72, palette.blue],
      ['Schema', 870, 250, 220, 72, palette.violet], ['Service', 1140, 250, 220, 72, palette.green2], ['Model', 1410, 250, 220, 72, palette.gold], ['Core', 1680, 235, 220, 102, palette.ink2],
    ],
    edges: [['Route','Component'],['Component','Action'],['Action','Schema'],['Schema','Service'],['Service','Model'],['Model','Core']],
  },
};

function hexToCss(hex) { return `#${hex}`; }

function wrapLabel(label) {
  return label.replace(/\\n/g, '\n');
}

function makeSvgDiagram(diagram, title) {
  const w = 1920, h = 760;
  const nodeMap = new Map((diagram.nodes || []).map(n => [n[0], n]));
  const defs = `<defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
      <path d="M2,2 L10,6 L2,10 Z" fill="#6B7A88"/>
    </marker>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#16202A" flood-opacity=".12"/>
    </filter>
  </defs>`;
  let body = `<rect width="${w}" height="${h}" rx="28" fill="#F8FAF7"/><text x="72" y="62" font-family="Sarabun, Arial" font-size="30" font-weight="700" fill="#16202A">${escapeXml(title)}</text>`;
  if (diagram.type === 'swimlane') {
    const x0 = 70, y0 = 120, laneW = 210, gap = 10, laneH = 560;
    diagram.lanes.forEach((lane, i) => {
      const x = x0 + i * (laneW + gap);
      body += `<rect x="${x}" y="${y0}" width="${laneW}" height="${laneH}" rx="18" fill="${i % 2 ? '#EEF2F3' : '#E8F4EE'}" stroke="#D6DED7"/>
        <text x="${x + laneW/2}" y="${y0 + 42}" text-anchor="middle" font-family="Sarabun, Arial" font-size="22" font-weight="700" fill="#16202A">${escapeXml(lane)}</text>`;
    });
    diagram.steps.forEach((s, idx) => {
      const [from, to, label] = s;
      const y = y0 + 95 + idx * 42;
      const x1 = x0 + from * (laneW + gap) + laneW/2;
      const x2 = x0 + to * (laneW + gap) + laneW/2;
      const color = from <= to ? '#256F5B' : '#2D6CDF';
      body += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="3" marker-end="url(#arrow)"/>
        <text x="${(x1+x2)/2}" y="${y-8}" text-anchor="middle" font-family="Sarabun, Arial" font-size="16" fill="#2F3C48">${escapeXml(label)}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${body}</svg>`;
  }
  for (const [a,b] of diagram.edges || []) {
    const na = nodeMap.get(a), nb = nodeMap.get(b);
    if (!na || !nb) continue;
    const ax = na[1] + na[3]/2, ay = na[2] + na[4]/2;
    const bx = nb[1] + nb[3]/2, by = nb[2] + nb[4]/2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const sx = ax + dx/len * (Math.min(na[3], na[4])/2 + 6);
    const sy = ay + dy/len * (Math.min(na[3], na[4])/2 + 6);
    const ex = bx - dx/len * (Math.min(nb[3], nb[4])/2 + 12);
    const ey = by - dy/len * (Math.min(nb[3], nb[4])/2 + 12);
    body += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#6B7A88" stroke-width="4" marker-end="url(#arrow)" opacity=".85"/>`;
  }
  for (const [key,x,y,nw,nh,color] of diagram.nodes || []) {
    const label = key;
    body += `<rect x="${x}" y="${y}" width="${nw}" height="${nh}" rx="20" fill="#${color}" filter="url(#soft)"/>`;
    const lines = wrapLabel(label).split('\n');
    const lineH = lines.length > 1 ? 25 : 30;
    const startY = y + nh/2 - ((lines.length-1)*lineH)/2 + 8;
    lines.forEach((line, i) => {
      body += `<text x="${x+nw/2}" y="${startY + i*lineH}" text-anchor="middle" font-family="Sarabun, Arial" font-size="${lines.length>1?21:24}" font-weight="700" fill="#FFFFFF">${escapeXml(line)}</text>`;
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${body}</svg>`;
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
}

async function writeMermaidAndRender() {
  const rendered = {};
  for (const [key, diagram] of Object.entries(diagrams)) {
    const mmdPath = path.join(MMD, `${key}.mmd`);
    const svgPath = path.join(ASSETS, `${key}.svg`);
    const pngPath = path.join(ASSETS, `${key}.png`);
    fs.writeFileSync(mmdPath, diagram.mmd, 'utf8');
    let renderedBy = 'fallback-svg';
    let needsSvgConvert = true;
    const mmdc = path.join(WORK, 'node_modules', '.bin', 'mmdc');
    if (fs.existsSync(mmdc)) {
      try {
        const puppeteerConfig = path.join(SCRATCH, 'puppeteer-config.json');
        const mermaidConfig = path.join(SCRATCH, 'mermaid-config.json');
        fs.writeFileSync(puppeteerConfig, JSON.stringify({
          executablePath: '/Users/napat.a/.cache/puppeteer/chrome-headless-shell/mac_arm-131.0.6778.204/chrome-headless-shell-mac-arm64/chrome-headless-shell',
          args: ['--no-sandbox']
        }, null, 2), 'utf8');
        fs.writeFileSync(mermaidConfig, JSON.stringify({
          theme: 'base',
          themeVariables: {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            primaryColor: '#E8F4EE',
            primaryBorderColor: '#7C6BEA',
            primaryTextColor: '#16202A',
            lineColor: '#2F3C48',
            clusterBkg: '#F8FAF7',
            clusterBorder: '#D6DED7'
          },
          flowchart: { htmlLabels: true, nodeSpacing: 70, rankSpacing: 95 },
          sequence: { actorFontSize: 18, messageFontSize: 16, noteFontSize: 16 }
        }, null, 2), 'utf8');
        execFileSync(mmdc, ['-i', mmdPath, '-o', pngPath, '-b', 'transparent', '-p', puppeteerConfig, '-c', mermaidConfig, '-w', '1800', '-s', '2'], { cwd: WORK, stdio: 'pipe' });
        execFileSync(mmdc, ['-i', mmdPath, '-o', svgPath, '-b', 'transparent', '-p', puppeteerConfig, '-c', mermaidConfig, '-w', '1800'], { cwd: WORK, stdio: 'pipe' });
        renderedBy = 'mermaid-cli';
        needsSvgConvert = false;
      } catch (err) {
        fs.writeFileSync(svgPath, makeSvgDiagram(diagram, key.replace(/_/g, ' ')), 'utf8');
      }
    } else {
      fs.writeFileSync(svgPath, makeSvgDiagram(diagram, key.replace(/_/g, ' ')), 'utf8');
    }
    if (needsSvgConvert) await returnOrConvert(svgPath, pngPath);
    rendered[key] = { mmdPath, svgPath, pngPath, renderedBy };
  }
  fs.writeFileSync(path.join(SCRATCH, 'mermaid-render-report.json'), JSON.stringify(rendered, null, 2), 'utf8');
  return rendered;
}

function returnOrConvert(svgPath, pngPath) {
  const svg = fs.readFileSync(svgPath);
  return sharp(svg, { density: 180 }).resize(1800, null, { withoutEnlargement: true }).png().toFile(pngPath);
}

function addFooter(slide, no) {
  slide.addText('Shop Inventory ERP • System Flow Training', { x: 0.45, y: 7.15, w: 8.8, h: 0.18, fontFace: 'Sarabun', fontSize: 7.5, color: palette.muted, margin: 0 });
  slide.addText(String(no).padStart(2, '0'), { x: 12.6, y: 7.08, w: 0.3, h: 0.2, fontFace: 'Aptos', fontSize: 8, bold: true, color: palette.muted, align: 'right', margin: 0 });
}

function addTitle(slide, s) {
  slide.addText(s.title, { x: 0.55, y: 0.36, w: 7.8, h: 0.42, fontFace: 'Sarabun', fontSize: 23, bold: true, color: palette.ink, margin: 0 });
  slide.addText(s.subtitle || '', { x: 0.56, y: 0.86, w: 8.2, h: 0.34, fontFace: 'Sarabun', fontSize: 11.8, color: palette.ink2, margin: 0 });
  slide.addShape(SHAPE.line, { x: 0.56, y: 1.25, w: 1.15, h: 0, line: { color: palette.green, width: 2.4 } });
}

function buildPptx(rendered) {
  const pptx = new pptxgen();
  SHAPE = pptx.ShapeType;
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'OpenAI Codex';
  pptx.subject = 'Shop Inventory ERP System Flow Training';
  pptx.title = 'Shop Inventory ERP System Flow Training';
  pptx.company = 'Shop Inventory';
  pptx.lang = 'th-TH';
  pptx.theme = {
    headFontFace: 'Sarabun',
    bodyFontFace: 'Sarabun',
    lang: 'th-TH',
  };

  for (const s of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: palette.paper };
      slide.addShape(SHAPE.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: palette.paper }, line: { color: palette.paper } });
    if (s.kind === 'cover') {
      slide.background = { color: palette.dark };
      slide.addShape(SHAPE.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: palette.dark }, line: { color: palette.dark } });
      slide.addShape(SHAPE.arc, { x: 8.9, y: -0.7, w: 5.5, h: 5.5, line: { color: palette.green2, transparency: 15, width: 4 }, adjustPoint: 0.18, rotate: 10 });
      slide.addShape(SHAPE.line, { x: 0.8, y: 1.05, w: 2.0, h: 0, line: { color: palette.gold, width: 4 } });
      slide.addText(s.kicker, { x: 0.82, y: 1.23, w: 6.2, h: 0.32, fontFace: 'Sarabun', fontSize: 13, bold: true, color: palette.gold, charSpace: 0.8, margin: 0 });
      slide.addText(s.title, { x: 0.78, y: 2.0, w: 8.5, h: 0.95, fontFace: 'Sarabun', fontSize: 43, bold: true, color: palette.white, margin: 0 });
      slide.addText(s.subtitle, { x: 0.82, y: 3.05, w: 7.8, h: 0.56, fontFace: 'Sarabun', fontSize: 25, color: 'D7EFE4', margin: 0 });
      slide.addText(s.note, { x: 0.85, y: 4.34, w: 6.0, h: 0.52, fontFace: 'Sarabun', fontSize: 14, color: 'B9C7C0', margin: 0 });
      slide.addText('For developers, trainers, and operators', { x: 0.85, y: 6.85, w: 4.2, h: 0.24, fontFace: 'Sarabun', fontSize: 9.5, color: '9FB7AF', margin: 0 });
      continue;
    }
    addTitle(slide, s);
    if (s.kind === 'map') {
      slide.addText('Mental Model', { x: 9.1, y: 0.48, w: 2.1, h: 0.2, fontFace: 'Sarabun', fontSize: 9, bold: true, color: palette.green, margin: 0 });
      const startY = 1.55;
      s.points.forEach((p, i) => {
        const y = startY + i * 0.9;
        slide.addShape(SHAPE.ellipse, { x: 0.86, y, w: 0.48, h: 0.48, fill: { color: i % 2 ? palette.blue : palette.green }, line: { color: i % 2 ? palette.blue : palette.green } });
        slide.addText(p[0], { x: 0.86, y: y + 0.1, w: 0.48, h: 0.15, fontFace: 'Aptos', fontSize: 10, bold: true, color: palette.white, align: 'center', margin: 0 });
        slide.addText(p[1], { x: 1.58, y: y - 0.02, w: 3.2, h: 0.25, fontFace: 'Sarabun', fontSize: 16, bold: true, color: palette.ink, margin: 0 });
        slide.addText(p[2], { x: 1.6, y: y + 0.32, w: 4.8, h: 0.22, fontFace: 'Sarabun', fontSize: 10.6, color: palette.ink2, margin: 0 });
        if (i < s.points.length - 1) slide.addShape(SHAPE.line, { x: 1.1, y: y + 0.5, w: 0, h: 0.34, line: { color: palette.line, width: 2 } });
      });
      slide.addText('ใช้สไลด์นี้เป็นเส้นทางนำเรียน: จาก flow ที่ผู้ใช้เห็น ไปถึงโครงสร้างด้านในที่ developer ต้องเข้าใจ', {
        x: 7.45, y: 2.0, w: 4.7, h: 1.05, fontFace: 'Sarabun', fontSize: 20, bold: true, color: palette.ink, margin: 0.02, breakLine: false,
      });
      slide.addText('Deck นี้แยกเนื้อหาเป็นภาพใหญ่หลายชั้น เพื่อให้คุยกันได้ทั้งมุม business process และมุม code/database.', {
        x: 7.48, y: 3.35, w: 4.1, h: 0.75, fontFace: 'Sarabun', fontSize: 12, color: palette.ink2, margin: 0,
      });
    } else if (s.kind === 'diagram') {
      const img = rendered[s.diagram].pngPath;
      slide.addImage({ path: img, x: 0.58, y: 1.45, w: 9.05, h: 4.96, sizing: { type: 'contain', x: 0.58, y: 1.45, w: 9.05, h: 4.96 } });
      slide.addShape(SHAPE.line, { x: 10.05, y: 1.56, w: 0, h: 4.75, line: { color: palette.line, width: 1.4 } });
      slide.addText('Key takeaway', { x: 10.35, y: 1.56, w: 1.4, h: 0.24, fontFace: 'Sarabun', fontSize: 9, bold: true, color: palette.green, margin: 0 });
      slide.addText(s.takeaway, { x: 10.35, y: 1.98, w: 2.25, h: 1.15, fontFace: 'Sarabun', fontSize: 16, bold: true, color: palette.ink, margin: 0.02 });
      slide.addText(`Mermaid source: scratch/mermaid/${s.diagram}.mmd`, { x: 10.36, y: 5.72, w: 2.45, h: 0.22, fontFace: 'Aptos', fontSize: 6.8, color: palette.muted, margin: 0 });
    } else if (s.kind === 'table') {
      const x = 0.75, y = 1.55;
      s.rows.forEach((r, i) => {
        const yy = y + i * 0.74;
        slide.addShape(SHAPE.line, { x, y: yy - 0.08, w: 11.7, h: 0, line: { color: i === 0 ? palette.green : palette.line, width: i === 0 ? 2.2 : 0.8 } });
        slide.addText(r[0], { x, y: yy, w: 3.35, h: 0.35, fontFace: 'Sarabun', fontSize: 13.2, bold: true, color: palette.ink, margin: 0 });
        slide.addText(r[1], { x: x + 3.85, y: yy, w: 7.2, h: 0.35, fontFace: 'Sarabun', fontSize: 12.2, color: palette.ink2, margin: 0 });
      });
    } else if (s.kind === 'summary') {
      slide.addText('ภาพจำสุดท้าย', { x: 0.72, y: 1.55, w: 2.2, h: 0.25, fontFace: 'Sarabun', fontSize: 10, bold: true, color: palette.green, margin: 0 });
      const left = s.pairs.slice(0, 4), right = s.pairs.slice(4);
      const drawPair = (pair, x, y, color) => {
        slide.addText(pair[0], { x, y, w: 2.4, h: 0.26, fontFace: 'Aptos', fontSize: 16, bold: true, color, margin: 0 });
        slide.addText(pair[1], { x: x + 2.7, y: y + 0.02, w: 3.2, h: 0.24, fontFace: 'Sarabun', fontSize: 12, color: palette.ink2, margin: 0 });
        slide.addShape(SHAPE.line, { x, y: y + 0.42, w: 5.65, h: 0, line: { color: palette.line, width: 0.8 } });
      };
      left.forEach((p, i) => drawPair(p, 0.9, 2.0 + i * 0.82, i % 2 ? palette.blue : palette.green));
      right.forEach((p, i) => drawPair(p, 7.0, 2.0 + i * 0.82, i % 2 ? palette.violet : palette.gold));
      slide.addText('ถ้า feature ใดดูซับซ้อน ให้ถามก่อนว่า “ใครเป็นเจ้าของความจริงของข้อมูลนี้?” แล้วตามไปที่ service/model นั้น', {
        x: 1.2, y: 6.0, w: 10.2, h: 0.48, fontFace: 'Sarabun', fontSize: 18, bold: true, color: palette.ink, align: 'center', margin: 0,
      });
    }
    addFooter(slide, s.no);
  }
  return pptx.writeFile({ fileName: FINAL });
}

function buildHtml(rendered) {
  const slideHtml = slides.map(s => {
    if (s.kind === 'cover') {
      return `<section class="slide cover"><div class="accent"></div><p class="kicker">${s.kicker}</p><h1>${s.title}</h1><h2>${s.subtitle}</h2><p>${s.note}</p><footer>For developers, trainers, and operators</footer></section>`;
    }
    if (s.kind === 'map') {
      return `<section class="slide"><h1>${s.title}</h1><p class="sub">${s.subtitle}</p><div class="timeline">${s.points.map(p => `<div><b>${p[0]}</b><strong>${p[1]}</strong><span>${p[2]}</span></div>`).join('')}</div></section>`;
    }
    if (s.kind === 'diagram') {
      const rel = path.relative(OUT, rendered[s.diagram].pngPath).split(path.sep).join('/');
      return `<section class="slide"><h1>${s.title}</h1><p class="sub">${s.subtitle}</p><div class="diagram"><img src="${rel}"></div><aside><b>Key takeaway</b><strong>${s.takeaway}</strong><small>Mermaid: scratch/mermaid/${s.diagram}.mmd</small></aside></section>`;
    }
    if (s.kind === 'table') {
      return `<section class="slide"><h1>${s.title}</h1><p class="sub">${s.subtitle}</p><table>${s.rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</table></section>`;
    }
    return `<section class="slide"><h1>${s.title}</h1><p class="sub">${s.subtitle}</p><div class="pairs">${s.pairs.map(p => `<div><strong>${p[0]}</strong><span>${p[1]}</span></div>`).join('')}</div><p class="closing">ถ้า feature ใดดูซับซ้อน ให้ถามก่อนว่า “ใครเป็นเจ้าของความจริงของข้อมูลนี้?” แล้วตามไปที่ service/model นั้น</p></section>`;
  }).join('\n');
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Shop Inventory System Flow Training</title><style>
  @page{size:16in 9in;margin:0}*{box-sizing:border-box}body{margin:0;background:#111;font-family:Sarabun,Arial,sans-serif}.slide{position:relative;width:16in;height:9in;page-break-after:always;background:#F8FAF7;color:#16202A;padding:.55in .7in;overflow:hidden}.cover{background:#0F1720;color:#fff;padding:1.3in 1in}.cover .accent{position:absolute;right:-1in;top:-1in;width:5in;height:5in;border:7px solid #3AA17E;border-radius:50%}.cover .kicker{color:#D49A2A;font-weight:700;letter-spacing:.03em}.cover h1{font-size:56pt;margin:.65in 0 .08in}.cover h2{font-size:30pt;color:#D7EFE4;margin:0}.cover p:not(.kicker){font-size:17pt;color:#B9C7C0;margin-top:.65in}.cover footer{position:absolute;left:1in;bottom:.55in;color:#9FB7AF;font-size:11pt}.slide h1{font-size:29pt;margin:0}.sub{font-size:14pt;color:#2F3C48;margin:.13in 0 .2in}.diagram{position:absolute;left:.62in;top:1.65in;width:10.8in;height:5.95in;display:flex;align-items:center;justify-content:center}.diagram img{max-width:100%;max-height:100%;object-fit:contain}aside{position:absolute;right:.72in;top:1.85in;width:3in;border-left:2px solid #D6DED7;padding-left:.35in}aside b{display:block;color:#256F5B;font-size:10pt;text-transform:uppercase;letter-spacing:.05em}aside strong{display:block;margin-top:.25in;font-size:18pt;line-height:1.25}aside small{display:block;position:absolute;top:4.6in;color:#6B7A88;font-size:8pt}.timeline{margin-top:.4in;width:8in}.timeline div{display:grid;grid-template-columns:.65in 2.8in 5in;gap:.18in;align-items:start;margin:.22in 0}.timeline b{width:.42in;height:.42in;background:#256F5B;border-radius:50%;color:#fff;text-align:center;line-height:.42in}.timeline strong{font-size:19pt}.timeline span{font-size:13pt;color:#2F3C48}table{border-collapse:collapse;margin-top:.45in;width:13.5in;font-size:14pt}tr{border-top:1px solid #D6DED7}tr:first-child{border-top:3px solid #256F5B}th{text-align:left;width:4in;padding:.18in 0;font-size:16pt}td{padding:.18in .1in;color:#2F3C48}.pairs{display:grid;grid-template-columns:1fr 1fr;gap:.25in .7in;margin-top:.55in}.pairs div{border-bottom:1px solid #D6DED7;padding:.12in 0}.pairs strong{display:inline-block;width:2.5in;color:#256F5B;font-size:21pt}.pairs span{font-size:15pt;color:#2F3C48}.closing{position:absolute;left:1.3in;right:1.3in;bottom:.8in;text-align:center;font-size:22pt;font-weight:700}</style></head><body>${slideHtml}</body></html>`;
  fs.writeFileSync(FINAL_HTML, html, 'utf8');
}

async function renderPdfAndPreviews() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/napat.a/.cache/puppeteer/chrome-headless-shell/mac_arm-131.0.6778.204/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('file://' + FINAL_HTML);
  await page.pdf({ path: FINAL_PDF, width: '16in', height: '9in', printBackground: true, preferCSSPageSize: true });
  const count = await page.locator('.slide').count();
  for (let i = 0; i < count; i++) {
    await page.locator('.slide').nth(i).screenshot({ path: path.join(PREVIEWS, `slide-${String(i+1).padStart(2,'0')}.png`) });
  }
  await browser.close();
}

async function inspectPreviews() {
  const results = [];
  for (const file of fs.readdirSync(PREVIEWS).filter(f => f.endsWith('.png')).sort()) {
    const imgPath = path.join(PREVIEWS, file);
    const meta = await sharp(imgPath).metadata();
    const stats = await sharp(imgPath).resize(1,1).raw().toBuffer();
    results.push({ file, width: meta.width, height: meta.height, avgRgb: [...stats] });
  }
  fs.writeFileSync(path.join(SCRATCH, 'preview-inspection.json'), JSON.stringify(results, null, 2), 'utf8');
}

(async () => {
  const rendered = await writeMermaidAndRender();
  await Promise.all(Object.values(rendered).map(x => fs.promises.copyFile(x.pngPath, path.join(OUT, path.basename(x.pngPath)))));
  buildHtml(rendered);
  await buildPptx(rendered);
  await renderPdfAndPreviews();
  await inspectPreviews();
  console.log(JSON.stringify({ pptx: FINAL, pdf: FINAL_PDF, html: FINAL_HTML, previews: PREVIEWS, mermaid: MMD }, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
