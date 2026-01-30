/**
 * OCR Service Types
 * Provider Pattern for easy switching between OCR providers
 * Enhanced for detailed Thai receipt extraction
 */

// ============================================
// OCR PROVIDER INTERFACE
// ============================================

export interface IOCRProvider {
  name: string;
  recognize(image: File | Blob | string): Promise<OCRResult>;
}

export interface OCRResult {
  text: string;
  confidence: number; // 0-100
  lines: OCRLine[];
  words: OCRWord[];
  processingTime: number; // ms
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// ============================================
// ENHANCED RECEIPT DATA STRUCTURE
// ============================================

export interface ReceiptData {
  // ─────────────────────────────────────────
  // 🏪 VENDOR INFORMATION
  // ─────────────────────────────────────────
  vendor: string | null;              // ชื่อร้าน/บริษัท
  vendorBranch: string | null;        // สาขา
  vendorAddress: string | null;       // ที่อยู่
  vendorPhone: string | null;         // เบอร์โทร
  vendorEmail: string | null;         // อีเมล
  vendorWebsite: string | null;       // เว็บไซต์
  vendorLogo: string | null;          // URL โลโก้ (ถ้าเจอ)
  
  // ─────────────────────────────────────────
  // 📋 TAX & LEGAL INFORMATION
  // ─────────────────────────────────────────
  taxId: string | null;               // เลขประจำตัวผู้เสียภาษี (13 หลัก)
  vatRegistration: string | null;     // เลขทะเบียนภาษีมูลค่าเพิ่ม
  branchNumber: string | null;        // รหัสสาขา (สำหรับใบกำกับภาษี)
  isHeadOffice: boolean | null;       // สำนักงานใหญ่?
  
  // ─────────────────────────────────────────
  // 📅 TRANSACTION INFORMATION
  // ─────────────────────────────────────────
  date: string | null;                // วันที่ (YYYY-MM-DD)
  time: string | null;                // เวลา (HH:MM)
  receiptNumber: string | null;       // เลขที่ใบเสร็จ
  invoiceNumber: string | null;       // เลขที่ใบกำกับภาษี
  referenceNumber: string | null;     // เลขอ้างอิง
  posNumber: string | null;           // หมายเลขเครื่อง POS
  cashierName: string | null;         // ชื่อพนักงาน/แคชเชียร์
  cashierId: string | null;           // รหัสพนักงาน
  
  // ─────────────────────────────────────────
  // 📦 ITEMS (รายการสินค้า/บริการ)
  // ─────────────────────────────────────────
  items: ReceiptItem[];
  itemCount: number;                  // จำนวนรายการทั้งหมด
  
  // ─────────────────────────────────────────
  // 💰 PRICING & TOTALS
  // ─────────────────────────────────────────
  subtotal: number | null;            // ยอดรวมก่อนภาษี/ส่วนลด
  discount: number | null;            // ส่วนลดรวม
  discountPercent: number | null;     // ส่วนลด %
  discountCode: string | null;        // รหัสส่วนลด/คูปอง
  memberDiscount: number | null;      // ส่วนลดสมาชิก
  promotionName: string | null;       // ชื่อโปรโมชั่น
  
  // VAT & Tax
  taxAmount: number | null;           // ภาษีมูลค่าเพิ่ม (VAT)
  taxRate: number | null;             // อัตราภาษี (เช่น 7%)
  taxableAmount: number | null;       // ยอดที่ต้องเสียภาษี
  nonTaxableAmount: number | null;    // ยอดที่ไม่ต้องเสียภาษี
  withholdingTax: number | null;      // ภาษีหัก ณ ที่จ่าย
  
  // Service Charge
  serviceCharge: number | null;       // ค่าบริการ (Service Charge)
  serviceChargeRate: number | null;   // อัตราค่าบริการ %
  
  // Tips & Extras
  tips: number | null;                // ทิป
  deliveryFee: number | null;         // ค่าจัดส่ง
  packagingFee: number | null;        // ค่าบรรจุภัณฑ์
  
  // Final
  grandTotal: number | null;          // ยอดรวมทั้งหมด (รวมภาษี+บริการ)
  total: number;                      // ยอดที่ต้องชำระ (ต้องมีเสมอ!)
  
  // ─────────────────────────────────────────
  // 💳 PAYMENT INFORMATION
  // ─────────────────────────────────────────
  paymentMethod: string | null;       // วิธีชำระเงิน
  paymentMethods: PaymentDetail[];    // รายละเอียดการชำระ (กรณีหลายช่องทาง)
  
  cashReceived: number | null;        // เงินสดที่รับ
  change: number | null;              // เงินทอน
  
  // Card Payment
  cardType: string | null;            // ประเภทบัตร (VISA, MASTERCARD, etc.)
  cardLast4: string | null;           // 4 หลักท้ายของบัตร
  approvalCode: string | null;        // รหัสอนุมัติ
  terminalId: string | null;          // รหัสเครื่อง EDC
  
  // Digital Payment
  qrType: string | null;              // ประเภท QR (PromptPay, TrueMoney, etc.)
  transactionId: string | null;       // เลขที่ธุรกรรม
  walletName: string | null;          // ชื่อ Wallet
  
  // ─────────────────────────────────────────
  // 👤 CUSTOMER INFORMATION
  // ─────────────────────────────────────────
  customerName: string | null;        // ชื่อลูกค้า
  customerPhone: string | null;       // เบอร์ลูกค้า
  customerAddress: string | null;     // ที่อยู่ลูกค้า
  customerTaxId: string | null;       // เลขผู้เสียภาษีลูกค้า (ใบกำกับ)
  memberId: string | null;            // รหัสสมาชิก
  memberPoints: number | null;        // แต้มสะสม
  pointsEarned: number | null;        // แต้มที่ได้รับ
  pointsRedeemed: number | null;      // แต้มที่ใช้ไป
  memberTier: string | null;          // ระดับสมาชิก
  
  // ─────────────────────────────────────────
  // 🚗 FUEL/UTILITY SPECIFIC
  // ─────────────────────────────────────────
  fuelType: string | null;            // ประเภทน้ำมัน (Gasohol 95, Diesel, etc.)
  fuelAmount: number | null;          // ลิตร
  fuelPricePerLiter: number | null;   // ราคาต่อลิตร
  pumpNumber: string | null;          // หมายเลขหัวจ่าย
  
  electricityUnits: number | null;    // หน่วยไฟฟ้า
  waterUnits: number | null;          // หน่วยน้ำ
  meterNumber: string | null;         // เลขมิเตอร์
  billingPeriod: string | null;       // รอบบิล
  previousReading: number | null;     // เลขมิเตอร์ครั้งก่อน
  currentReading: number | null;      // เลขมิเตอร์ครั้งนี้
  
  // ─────────────────────────────────────────
  // 📱 TELECOM SPECIFIC
  // ─────────────────────────────────────────
  phoneNumber: string | null;         // หมายเลขโทรศัพท์
  planName: string | null;            // ชื่อแพ็กเกจ
  dataPlan: string | null;            // ข้อมูล (เช่น "20GB")
  callMinutes: number | null;         // นาทีโทร
  smsCount: number | null;            // จำนวน SMS
  
  // ─────────────────────────────────────────
  // 🏷️ CLASSIFICATION
  // ─────────────────────────────────────────
  receiptType: ReceiptType;           // ประเภทใบเสร็จ
  suggestedCategory: string | null;   // หมวดหมู่แนะนำ
  tags: string[];                     // แท็กเพิ่มเติม
  
  // ─────────────────────────────────────────
  // 📝 META INFORMATION
  // ─────────────────────────────────────────
  rawText: string;                    // OCR text ดิบ
  confidence: number;                 // ความมั่นใจ 0-100
  warnings: string[];                 // คำเตือน/ข้อสังเกต
  notes: string | null;               // หมายเหตุบนใบเสร็จ
  qrCodeData: string | null;          // ข้อมูลจาก QR Code (ถ้ามี)
  barcodeData: string | null;         // ข้อมูลจาก Barcode (ถ้ามี)
}

// ============================================
// ENHANCED RECEIPT ITEM
// ============================================

export interface ReceiptItem {
  // Basic
  name: string;                       // ชื่อสินค้า/บริการ
  description: string | null;         // รายละเอียดเพิ่มเติม
  sku: string | null;                 // รหัสสินค้า
  barcode: string | null;             // บาร์โค้ด
  
  // Quantity & Price
  quantity: number;                   // จำนวน
  unit: string | null;                // หน่วย (ชิ้น, กก., ลิตร)
  unitPrice: number;                  // ราคาต่อหน่วย
  originalPrice: number | null;       // ราคาเต็ม (ก่อนลด)
  
  // Discounts
  discount: number | null;            // ส่วนลดรายการนี้
  discountPercent: number | null;     // ส่วนลด %
  promotionName: string | null;       // ชื่อโปรโมชั่น
  
  // Tax
  taxIncluded: boolean;               // รวม VAT แล้ว?
  taxAmount: number | null;           // VAT ของรายการนี้
  
  // Total
  total: number;                      // ยอดรวมรายการนี้
  
  // Category
  category: string | null;            // หมวดหมู่สินค้า
}

// ============================================
// PAYMENT DETAIL (สำหรับการชำระหลายช่องทาง)
// ============================================

export interface PaymentDetail {
  method: PaymentMethod;              // วิธีชำระ
  amount: number;                     // จำนวนเงิน
  reference: string | null;           // เลขอ้างอิง
  cardLast4: string | null;           // 4 หลักท้าย (ถ้าเป็นบัตร)
}

// ============================================
// ENUMS
// ============================================

export type ReceiptType = 
  | 'receipt'           // ใบเสร็จรับเงิน
  | 'tax_invoice'       // ใบกำกับภาษี
  | 'abbreviated'       // ใบกำกับภาษีอย่างย่อ
  | 'delivery_note'     // ใบส่งของ
  | 'credit_note'       // ใบลดหนี้
  | 'debit_note'        // ใบเพิ่มหนี้
  | 'utility_bill'      // ใบแจ้งค่าสาธารณูปโภค
  | 'fuel_receipt'      // ใบเสร็จน้ำมัน
  | 'unknown';          // ไม่ทราบประเภท

export type PaymentMethod = 
  | 'CASH'              // เงินสด
  | 'CARD'              // บัตรเครดิต/เดบิต
  | 'QR'                // QR Payment
  | 'PROMPTPAY'         // พร้อมเพย์
  | 'TRANSFER'          // โอนเงิน
  | 'TRUEMONEY'         // TrueMoney Wallet
  | 'LINEPAY'           // LINE Pay
  | 'SHOPEE'            // ShopeePay
  | 'GRAB'              // GrabPay
  | 'LAZADA'            // Lazada Wallet
  | 'CREDIT'            // เครดิต/ค้างชำระ
  | 'VOUCHER'           // คูปอง/บัตรกำนัล
  | 'MIXED'             // ผสมหลายวิธี
  | 'OTHER';            // อื่นๆ

// ============================================
// OCR PROVIDER CONFIG
// ============================================

export type OCRProviderType = 'tesseract' | 'google-vision' | 'azure';

export interface OCRConfig {
  provider: OCRProviderType;
  languages: string[]; // ['tha', 'eng']
  preprocess: boolean; // Image preprocessing
}
