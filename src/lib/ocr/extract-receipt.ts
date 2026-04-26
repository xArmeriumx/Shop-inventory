/**
 * AI Receipt Data Extraction
 * Uses Groq AI to extract structured data from OCR text
 */

import { groq } from '../ai/client';
import type { ReceiptData, ReceiptItem, PaymentDetail, PaymentMethod } from './types';

// ============================================
// ENHANCED OCR PROMPT WITH FEW-SHOT EXAMPLES
// ============================================

const RECEIPT_EXTRACTION_PROMPT = `คุณเป็น AI ผู้เชี่ยวชาญการอ่านใบเสร็จไทย
ภารกิจ: แปลง OCR text (ที่อาจมี error) → JSON ที่ถูกต้อง

═══════════════════════════════════
📝 OCR ERROR PATTERNS ที่พบบ่อย
═══════════════════════════════════

ตัวอักษร:
• "l" ↔ "1" ↔ "I" (เช่น "l00" → "100")
• "O" ↔ "0" (เช่น "1O0" → "100")
• "S" ↔ "5" (เช่น "S00" → "500")
• "B" ↔ "8" (เช่น "B0" → "80")
• "Z" ↔ "2"
• "G" ↔ "6"

ภาษาไทย:
• "วันlhi" → "วันที่"
• "บn" → "บาท"
• "เงlน" → "เงิน"
• "nวม" → "รวม"  
• "สlนค้า" → "สินค้า"
• "nาคา" → "ราคา"
• "จำนvน" → "จำนวน"
• "เลnที่" → "เลขที่"
• "nับเงlน" → "รับเงิน"
• "ทoน" → "ทอน"

ตัวเลข:
• "฿" อาจเป็น "B" หรือ "8"
• จุดทศนิยมอาจเป็น "," หรือ " "
• หลักพันอาจมี "," หรือไม่มี

═══════════════════════════════════
🏪 รูปแบบใบเสร็จไทยที่รองรับ
═══════════════════════════════════

ร้านสะดวกซื้อ:
• 7-Eleven, FamilyMart, Lawson 108
• CJ Express, Tesco Lotus Express
• Mini Big C, MaxValu

ห้างสรรพสินค้า/ซูเปอร์:
• Lotus's, Big C, Makro
• Tops, Villa Market, Gourmet Market
• The Mall, Central, Robinson

ร้านอาหาร/เครื่องดื่ม:
• McDonald's, KFC, MK, Sizzler
• Starbucks, Café Amazon, Inthanin
• S&P, After You, บ้านไอติม

ปั๊มน้ำมัน:
• PTT, Shell, Bangchak, Caltex
• Susco, PT, IRPC

ค่าสาธารณูปโภค:
• การไฟฟ้านครหลวง (กฟน.)
• การไฟฟ้าส่วนภูมิภาค (กฟภ.)
• การประปานครหลวง (กปน.)
• AIS, TRUE, DTAC

อื่นๆ:
• ร้านค้าทั่วไป, ตลาดนัด
• ร้านขายยา, คลินิก
• ร้านเสริมสวย, ซ่อมรถ

═══════════════════════════════════
📋 ตัวอย่าง #1: ใบเสร็จ 7-Eleven
═══════════════════════════════════

OCR Input:
"""
7-ELEVEN
สาnา สุnุมวlท 23
โทn 02-123-4567
วันที่ 15/O1/68 เวลา 14:32
--------------------------------
นมเปnี่ยว ดัชมlลล์    x1    35.OO
nองกnอบ เลย์        x2    5O.OO
น้ำดื่มสlงห์         x1    1O.OO
--------------------------------
nวม                      95.OO
เงlนสด                  1OO.OO
ทoน                       5.OO
เลnที่: 12345678
"""

JSON Output:
{
  "vendor": "7-Eleven สาขา สุขุมวิท 23",
  "vendorPhone": "02-123-4567",
  "date": "2025-01-15",
  "time": "14:32",
  "receiptNumber": "12345678",
  "items": [
    {"name": "นมเปรี้ยว ดัชมิลล์", "quantity": 1, "unitPrice": 35, "total": 35},
    {"name": "ของกรอบ เลย์", "quantity": 2, "unitPrice": 25, "total": 50},
    {"name": "น้ำดื่มสิงห์", "quantity": 1, "unitPrice": 10, "total": 10}
  ],
  "total": 95,
  "paymentMethod": "CASH",
  "suggestedCategory": "อาหาร",
  "confidence": 90
}

═══════════════════════════════════
📋 ตัวอย่าง #2: ใบเสร็จร้านอาหาร
═══════════════════════════════════

OCR Input:
"""
ร้านอาหาn คnัวบ้าน
123 ถ.พหลโยธlน
TAX ID: 1234567890123
--------------------------------
ข้าวผัดnู       x2    8O.OO
ต้มยำnุ้ง       x1    15O.OO  
ผัดไทย         x1    7O.OO
โค้n           x3    45.OO
--------------------------------
nวมก่อน VAT           345.OO
VAT 7%                24.15
nวมทั้งสl้น           369.15
บัตnเคnดlต
17 ม.ค. 2568
"""

JSON Output:
{
  "vendor": "ร้านอาหาร ครัวบ้าน",
  "vendorAddress": "123 ถ.พหลโยธิน",
  "taxId": "1234567890123",
  "date": "2025-01-17",
  "items": [
    {"name": "ข้าวผัดหมู", "quantity": 2, "unitPrice": 40, "total": 80},
    {"name": "ต้มยำกุ้ง", "quantity": 1, "unitPrice": 150, "total": 150},
    {"name": "ผัดไทย", "quantity": 1, "unitPrice": 70, "total": 70},
    {"name": "โค้ก", "quantity": 3, "unitPrice": 15, "total": 45}
  ],
  "subtotal": 345,
  "taxAmount": 24.15,
  "total": 369.15,
  "paymentMethod": "CARD",
  "suggestedCategory": "อาหาร",
  "confidence": 85
}

═══════════════════════════════════
📋 ตัวอย่าง #3: ใบเสร็จค่าไฟ
═══════════════════════════════════

OCR Input:
"""
กาnไฟฟ้านคnหลวง
METROPOLITAN ELECTRICITY AUTHORITY
ใบเสn็จnับเงlน/ใบnำกับnาษี
เลnที่ผู้ใช้ไฟ: 12O456789O
ชื่อ: บnlษัท ABC จำกัด
หน่วยที่ใช้: 523 หน่วย
ค่าไฟฟ้า          1,567.89
ภาษี 7%            1O9.75
nวม               1,677.64
ชำnะn่าน QR Code
20/O1/68
"""

JSON Output:
{
  "vendor": "การไฟฟ้านครหลวง",
  "receiptNumber": "1204567890",
  "date": "2025-01-20",
  "items": [
    {"name": "ค่าไฟฟ้า 523 หน่วย", "quantity": 1, "unitPrice": 1567.89, "total": 1567.89}
  ],
  "subtotal": 1567.89,
  "taxAmount": 109.75,
  "total": 1677.64,
  "paymentMethod": "QR",
  "suggestedCategory": "ค่าสาธารณูปโภค",
  "confidence": 88
}

═══════════════════════════════════
📤 FULL OUTPUT FORMAT (ดึงข้อมูลให้ครบที่สุด!)
═══════════════════════════════════

ตอบเป็น JSON เท่านั้น (ดึงทุก field ที่เจอ):

{
  // 🏪 ข้อมูลร้านค้า
  "vendor": "ชื่อร้าน/บริษัท",
  "vendorBranch": "สาขา",
  "vendorAddress": "ที่อยู่",
  "vendorPhone": "เบอร์โทร",
  "vendorEmail": "อีเมล",
  "vendorWebsite": "เว็บไซต์",
  
  // 📋 ข้อมูลภาษี
  "taxId": "เลขประจำตัวผู้เสียภาษี 13 หลัก",
  "vatRegistration": "เลขทะเบียน VAT",
  "branchNumber": "รหัสสาขา",
  "isHeadOffice": true/false,
  
  // 📅 ข้อมูลธุรกรรม
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "receiptNumber": "เลขที่ใบเสร็จ",
  "invoiceNumber": "เลขที่ใบกำกับภาษี",
  "referenceNumber": "เลขอ้างอิง",
  "posNumber": "หมายเลขเครื่อง POS",
  "cashierName": "ชื่อแคชเชียร์",
  "cashierId": "รหัสพนักงาน",
  
  // 📦 รายการสินค้า
  "items": [{
    "name": "ชื่อสินค้า",
    "description": "รายละเอียด",
    "sku": "รหัสสินค้า",
    "barcode": "บาร์โค้ด",
    "quantity": 1,
    "unit": "หน่วย (ชิ้น/กก./ลิตร)",
    "unitPrice": 0,
    "originalPrice": "ราคาก่อนลด",
    "discount": "ส่วนลดรายการนี้",
    "discountPercent": "ส่วนลด %",
    "promotionName": "ชื่อโปรโมชั่น",
    "taxIncluded": true,
    "taxAmount": "VAT รายการนี้",
    "total": 0,
    "category": "หมวดหมู่"
  }],
  "itemCount": "จำนวนรายการ",
  
  // 💰 ราคาและยอดรวม
  "subtotal": "ยอดก่อนภาษี/ส่วนลด",
  "discount": "ส่วนลดรวม",
  "discountPercent": "ส่วนลด %",
  "discountCode": "รหัสคูปอง",
  "memberDiscount": "ส่วนลดสมาชิก",
  "promotionName": "ชื่อโปรโมชั่น",
  
  "taxAmount": "VAT",
  "taxRate": "อัตราภาษี (เช่น 7)",
  "taxableAmount": "ยอดที่ต้องเสียภาษี",
  "nonTaxableAmount": "ยอดไม่เสียภาษี",
  "withholdingTax": "ภาษีหัก ณ ที่จ่าย",
  
  "serviceCharge": "ค่าบริการ",
  "serviceChargeRate": "อัตราค่าบริการ %",
  "tips": "ทิป",
  "deliveryFee": "ค่าจัดส่ง",
  "packagingFee": "ค่าบรรจุภัณฑ์",
  
  "grandTotal": "ยอดรวมทั้งหมด",
  "total": "ยอดที่ต้องชำระ (ต้องมีเสมอ!)",
  
  // 💳 การชำระเงิน
  "paymentMethod": "CASH|CARD|QR|PROMPTPAY|TRANSFER|TRUEMONEY|LINEPAY|GRAB|SHOPEE|MIXED",
  "paymentMethods": [{"method": "", "amount": 0, "reference": "", "cardLast4": ""}],
  "cashReceived": "เงินที่รับ",
  "change": "เงินทอน",
  
  "cardType": "VISA|MASTERCARD|JCB|AMEX|UNIONPAY",
  "cardLast4": "4 หลักท้าย",
  "approvalCode": "รหัสอนุมัติ",
  "terminalId": "รหัส EDC",
  
  "qrType": "PromptPay|TrueMoney|LINE|etc",
  "transactionId": "เลขธุรกรรม",
  "walletName": "ชื่อ Wallet",
  
  // 👤 ข้อมูลลูกค้า
  "customerName": "ชื่อลูกค้า",
  "customerPhone": "เบอร์ลูกค้า",
  "customerAddress": "ที่อยู่ลูกค้า",
  "customerTaxId": "เลขผู้เสียภาษีลูกค้า",
  "memberId": "รหัสสมาชิก",
  "memberPoints": "แต้มคงเหลือ",
  "pointsEarned": "แต้มที่ได้รับ",
  "pointsRedeemed": "แต้มที่ใช้",
  "memberTier": "ระดับสมาชิก",
  
  // 🚗 น้ำมัน (ถ้าเป็นปั๊มน้ำมัน)
  "fuelType": "Gasohol 95/E20/Diesel/etc",
  "fuelAmount": "ลิตร",
  "fuelPricePerLiter": "ราคาต่อลิตร",
  "pumpNumber": "หัวจ่ายเลขที่",
  
  // ⚡ สาธารณูปโภค (ถ้าเป็นบิลค่าน้ำ/ค่าไฟ)
  "electricityUnits": "หน่วยไฟฟ้า",
  "waterUnits": "หน่วยน้ำ",
  "meterNumber": "เลขมิเตอร์",
  "billingPeriod": "รอบบิล",
  "previousReading": "เลขมิเตอร์ครั้งก่อน",
  "currentReading": "เลขมิเตอร์ครั้งนี้",
  
  // 📱 โทรศัพท์ (ถ้าเป็นบิลโทรศัพท์)
  "phoneNumber": "หมายเลขโทรศัพท์",
  "planName": "ชื่อแพ็กเกจ",
  "dataPlan": "ข้อมูล (เช่น 20GB)",
  "callMinutes": "นาทีโทร",
  "smsCount": "จำนวน SMS",
  
  // 🏷️ การจัดหมวดหมู่
  "receiptType": "receipt|tax_invoice|abbreviated|utility_bill|fuel_receipt|etc",
  "suggestedCategory": "อาหาร|ค่าเดินทาง|ค่าสาธารณูปโภค|ค่าใช้จ่ายสำนักงาน|etc",
  "tags": ["แท็กเพิ่มเติม"],
  
  // 📝 ข้อมูลเพิ่มเติม
  "notes": "หมายเหตุบนใบเสร็จ",
  "qrCodeData": "ข้อมูลจาก QR Code",
  "barcodeData": "ข้อมูลจาก Barcode",
  "warnings": ["คำเตือน/ข้อสังเกต"],
  "confidence": 0-100
}

กฎสำคัญ:
• ดึงข้อมูลให้ครบที่สุดเท่าที่เจอ!
• แก้ OCR errors ก่อนดึงข้อมูล
• แปลง พ.ศ. → ค.ศ. (2568 → 2025)
• total ต้องมีเสมอ (เดาจาก items ถ้าจำเป็น)
• ถ้าไม่พบข้อมูลใด ให้ใส่ null
• สำหรับใบเสร็จน้ำมัน ให้ดึง fuelType, fuelAmount
• สำหรับบิลค่าไฟ/น้ำ ให้ดึง units และ meterNumber
• สำหรับสมาชิก ให้ดึง memberId และ points`;

/**
 * Extract structured data from OCR text using AI
 */
export async function extractReceiptData(ocrText: string): Promise<ReceiptData> {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', // ใช้ model ใหญ่กว่าสำหรับ OCR extraction (ต้องการความแม่นยำสูง)
      messages: [
        {
          role: 'system',
          content: RECEIPT_EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: `กรุณาวิเคราะห์ใบเสร็จนี้และดึงข้อมูลให้ครบถ้วนที่สุด:\n\n${ocrText}`,
        },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 4000, // เพิ่มเพื่อรองรับ response ที่ใหญ่ขึ้น
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    const extracted = JSON.parse(content);

    // Validate and normalize the response
    return normalizeReceiptData(extracted, ocrText);
  } catch (error) {
    console.error('Receipt extraction error:', error);
    
    // Return minimal data with raw text
    return createEmptyReceiptData(ocrText);
  }
}

/**
 * Create empty receipt data with default values
 */
function createEmptyReceiptData(rawText: string): ReceiptData {
  return {
    // Vendor
    vendor: null,
    vendorBranch: null,
    vendorAddress: null,
    vendorPhone: null,
    vendorEmail: null,
    vendorWebsite: null,
    vendorLogo: null,
    
    // Tax
    taxId: null,
    vatRegistration: null,
    branchNumber: null,
    isHeadOffice: null,
    
    // Transaction
    date: null,
    time: null,
    receiptNumber: null,
    invoiceNumber: null,
    referenceNumber: null,
    posNumber: null,
    cashierName: null,
    cashierId: null,
    
    // Items
    items: [],
    itemCount: 0,
    
    // Pricing
    subtotal: null,
    discount: null,
    discountPercent: null,
    discountCode: null,
    memberDiscount: null,
    promotionName: null,
    
    taxAmount: null,
    taxRate: null,
    taxableAmount: null,
    nonTaxableAmount: null,
    withholdingTax: null,
    
    serviceCharge: null,
    serviceChargeRate: null,
    tips: null,
    deliveryFee: null,
    packagingFee: null,
    
    grandTotal: null,
    total: 0,
    
    // Payment
    paymentMethod: null,
    paymentMethods: [],
    cashReceived: null,
    change: null,
    cardType: null,
    cardLast4: null,
    approvalCode: null,
    terminalId: null,
    qrType: null,
    transactionId: null,
    walletName: null,
    
    // Customer
    customerName: null,
    customerPhone: null,
    customerAddress: null,
    customerTaxId: null,
    memberId: null,
    memberPoints: null,
    pointsEarned: null,
    pointsRedeemed: null,
    memberTier: null,
    
    // Fuel
    fuelType: null,
    fuelAmount: null,
    fuelPricePerLiter: null,
    pumpNumber: null,
    
    // Utility
    electricityUnits: null,
    waterUnits: null,
    meterNumber: null,
    billingPeriod: null,
    previousReading: null,
    currentReading: null,
    
    // Telecom
    phoneNumber: null,
    planName: null,
    dataPlan: null,
    callMinutes: null,
    smsCount: null,
    
    // Classification
    receiptType: 'unknown',
    suggestedCategory: 'อื่นๆ',
    tags: [],
    
    // Meta
    rawText,
    confidence: 0,
    warnings: [],
    notes: null,
    qrCodeData: null,
    barcodeData: null,
  };
}

/**
 * Normalize and validate extracted data
 */
function normalizeReceiptData(data: any, rawText: string): ReceiptData {
  // Parse items with enhanced fields
  const items: ReceiptItem[] = (data.items || []).map((item: any) => ({
    name: String(item.name || ''),
    description: item.description || null,
    sku: item.sku || null,
    barcode: item.barcode || null,
    quantity: Number(item.quantity) || 1,
    unit: item.unit || null,
    unitPrice: Number(item.unitPrice) || 0,
    originalPrice: item.originalPrice ? Number(item.originalPrice) : null,
    discount: item.discount ? Number(item.discount) : null,
    discountPercent: item.discountPercent ? Number(item.discountPercent) : null,
    promotionName: item.promotionName || null,
    taxIncluded: item.taxIncluded !== false, // Default true
    taxAmount: item.taxAmount ? Number(item.taxAmount) : null,
    total: Number(item.total) || 0,
    category: item.category || null,
  })).filter((item: ReceiptItem) => item.name);

  // Calculate total from items if not provided
  let total = Number(data.total) || 0;
  if (total === 0 && items.length > 0) {
    total = items.reduce((sum, item) => sum + item.total, 0);
  }

  // Normalize date format
  let date = data.date;
  if (date) {
    const parsedDate = parseThaiDate(date);
    date = parsedDate || date;
  }

  // Parse payment methods array
  const paymentMethods = (data.paymentMethods || []).map((pm: any) => ({
    method: normalizePaymentMethod(pm.method) || 'OTHER',
    amount: Number(pm.amount) || 0,
    reference: pm.reference || null,
    cardLast4: pm.cardLast4 || null,
  }));

  return {
    // 🏪 Vendor
    vendor: data.vendor || null,
    vendorBranch: data.vendorBranch || null,
    vendorAddress: data.vendorAddress || null,
    vendorPhone: data.vendorPhone || null,
    vendorEmail: data.vendorEmail || null,
    vendorWebsite: data.vendorWebsite || null,
    vendorLogo: data.vendorLogo || null,
    
    // 📋 Tax
    taxId: data.taxId || null,
    vatRegistration: data.vatRegistration || null,
    branchNumber: data.branchNumber || null,
    isHeadOffice: data.isHeadOffice ?? null,
    
    // 📅 Transaction
    date,
    time: data.time || null,
    receiptNumber: data.receiptNumber || null,
    invoiceNumber: data.invoiceNumber || null,
    referenceNumber: data.referenceNumber || null,
    posNumber: data.posNumber || null,
    cashierName: data.cashierName || null,
    cashierId: data.cashierId || null,
    
    // 📦 Items
    items,
    itemCount: items.length,
    
    // 💰 Pricing
    subtotal: data.subtotal ? Number(data.subtotal) : null,
    discount: data.discount ? Number(data.discount) : null,
    discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
    discountCode: data.discountCode || null,
    memberDiscount: data.memberDiscount ? Number(data.memberDiscount) : null,
    promotionName: data.promotionName || null,
    
    taxAmount: data.taxAmount ? Number(data.taxAmount) : null,
    taxRate: data.taxRate ? Number(data.taxRate) : null,
    taxableAmount: data.taxableAmount ? Number(data.taxableAmount) : null,
    nonTaxableAmount: data.nonTaxableAmount ? Number(data.nonTaxableAmount) : null,
    withholdingTax: data.withholdingTax ? Number(data.withholdingTax) : null,
    
    serviceCharge: data.serviceCharge ? Number(data.serviceCharge) : null,
    serviceChargeRate: data.serviceChargeRate ? Number(data.serviceChargeRate) : null,
    tips: data.tips ? Number(data.tips) : null,
    deliveryFee: data.deliveryFee ? Number(data.deliveryFee) : null,
    packagingFee: data.packagingFee ? Number(data.packagingFee) : null,
    
    grandTotal: data.grandTotal ? Number(data.grandTotal) : null,
    total,
    
    // 💳 Payment
    paymentMethod: normalizePaymentMethod(data.paymentMethod),
    paymentMethods,
    cashReceived: data.cashReceived ? Number(data.cashReceived) : null,
    change: data.change ? Number(data.change) : null,
    cardType: data.cardType || null,
    cardLast4: data.cardLast4 || null,
    approvalCode: data.approvalCode || null,
    terminalId: data.terminalId || null,
    qrType: data.qrType || null,
    transactionId: data.transactionId || null,
    walletName: data.walletName || null,
    
    // 👤 Customer
    customerName: data.customerName || null,
    customerPhone: data.customerPhone || null,
    customerAddress: data.customerAddress || null,
    customerTaxId: data.customerTaxId || null,
    memberId: data.memberId || null,
    memberPoints: data.memberPoints ? Number(data.memberPoints) : null,
    pointsEarned: data.pointsEarned ? Number(data.pointsEarned) : null,
    pointsRedeemed: data.pointsRedeemed ? Number(data.pointsRedeemed) : null,
    memberTier: data.memberTier || null,
    
    // 🚗 Fuel
    fuelType: data.fuelType || null,
    fuelAmount: data.fuelAmount ? Number(data.fuelAmount) : null,
    fuelPricePerLiter: data.fuelPricePerLiter ? Number(data.fuelPricePerLiter) : null,
    pumpNumber: data.pumpNumber || null,
    
    // ⚡ Utility
    electricityUnits: data.electricityUnits ? Number(data.electricityUnits) : null,
    waterUnits: data.waterUnits ? Number(data.waterUnits) : null,
    meterNumber: data.meterNumber || null,
    billingPeriod: data.billingPeriod || null,
    previousReading: data.previousReading ? Number(data.previousReading) : null,
    currentReading: data.currentReading ? Number(data.currentReading) : null,
    
    // 📱 Telecom
    phoneNumber: data.phoneNumber || null,
    planName: data.planName || null,
    dataPlan: data.dataPlan || null,
    callMinutes: data.callMinutes ? Number(data.callMinutes) : null,
    smsCount: data.smsCount ? Number(data.smsCount) : null,
    
    // 🏷️ Classification
    receiptType: normalizeReceiptType(data.receiptType),
    suggestedCategory: data.suggestedCategory || 'อื่นๆ',
    tags: Array.isArray(data.tags) ? data.tags : [],
    
    // 📝 Meta
    rawText,
    confidence: Number(data.confidence) || 50,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    notes: data.notes || null,
    qrCodeData: data.qrCodeData || null,
    barcodeData: data.barcodeData || null,
  };
}

/**
 * Normalize receipt type
 */
function normalizeReceiptType(type: string | null): ReceiptData['receiptType'] {
  if (!type) return 'unknown';
  
  const normalized = type.toLowerCase().replace(/[_\s-]/g, '');
  
  const mappings: Record<string, ReceiptData['receiptType']> = {
    'receipt': 'receipt',
    'taxinvoice': 'tax_invoice',
    'abbreviated': 'abbreviated',
    'deliverynote': 'delivery_note',
    'creditnote': 'credit_note',
    'debitnote': 'debit_note',
    'utilitybill': 'utility_bill',
    'fuelreceipt': 'fuel_receipt',
  };
  
  return mappings[normalized] || 'unknown';
}

/**
 * Parse Thai date formats to ISO
 */
function parseThaiDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Thai months
  const thaiMonths: { [key: string]: string } = {
    'ม.ค.': '01', 'มกราคม': '01',
    'ก.พ.': '02', 'กุมภาพันธ์': '02',
    'มี.ค.': '03', 'มีนาคม': '03',
    'เม.ย.': '04', 'เมษายน': '04',
    'พ.ค.': '05', 'พฤษภาคม': '05',
    'มิ.ย.': '06', 'มิถุนายน': '06',
    'ก.ค.': '07', 'กรกฎาคม': '07',
    'ส.ค.': '08', 'สิงหาคม': '08',
    'ก.ย.': '09', 'กันยายน': '09',
    'ต.ค.': '10', 'ตุลาคม': '10',
    'พ.ย.': '11', 'พฤศจิกายน': '11',
    'ธ.ค.': '12', 'ธันวาคม': '12',
  };

  try {
    // Pattern: DD/MM/YYYY or DD-MM-YYYY
    let match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
      let [_, day, month, year] = match;
      // Convert Buddhist Era to CE
      if (year.length === 2) {
        year = (parseInt(year) + 2500 - 43).toString(); // 68 → 2025
      } else if (parseInt(year) > 2500) {
        year = (parseInt(year) - 543).toString();
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Pattern: DD เดือนไทย ปี
    for (const [thaiMonth, monthNum] of Object.entries(thaiMonths)) {
      if (dateStr.includes(thaiMonth)) {
        const numMatch = dateStr.match(/(\d{1,2})/g);
        if (numMatch && numMatch.length >= 2) {
          const day = numMatch[0];
          let year = numMatch[numMatch.length - 1];
          if (year.length === 2) {
            year = (parseInt(year) + 2500 - 43).toString();
          } else if (parseInt(year) > 2500) {
            year = (parseInt(year) - 543).toString();
          }
          return `${year}-${monthNum}-${day.padStart(2, '0')}`;
        }
      }
    }
  } catch (e) {
    console.error('Date parse error:', e);
  }

  return null;
}

/**
 * Normalize payment method - รองรับทุกช่องทางการชำระเงินในไทย
 */
function normalizePaymentMethod(method: string | null): PaymentMethod | null {
  if (!method) return null;
  
  const normalized = method.toUpperCase().trim();
  
  // Map common variations to standard payment methods
  const mappings: { [key: string]: PaymentMethod } = {
    // Cash
    'CASH': 'CASH',
    'เงินสด': 'CASH',
    
    // Card
    'CARD': 'CARD',
    'CREDIT CARD': 'CARD',
    'DEBIT': 'CARD',
    'บัตร': 'CARD',
    'VISA': 'CARD',
    'MASTERCARD': 'CARD',
    'JCB': 'CARD',
    'AMEX': 'CARD',
    'UNIONPAY': 'CARD',
    
    // QR Payment
    'QR': 'QR',
    'QRCODE': 'QR',
    'QR CODE': 'QR',
    
    // PromptPay
    'PROMPTPAY': 'PROMPTPAY',
    'พร้อมเพย์': 'PROMPTPAY',
    'PROMPT PAY': 'PROMPTPAY',
    
    // Bank Transfer
    'โอน': 'TRANSFER',
    'TRANSFER': 'TRANSFER',
    'โอนเงิน': 'TRANSFER',
    'BANK': 'TRANSFER',
    
    // TrueMoney
    'TRUEMONEY': 'TRUEMONEY',
    'TRUE MONEY': 'TRUEMONEY',
    'ทรูมันนี่': 'TRUEMONEY',
    'TRUE WALLET': 'TRUEMONEY',
    
    // LINE Pay
    'LINEPAY': 'LINEPAY',
    'LINE PAY': 'LINEPAY',
    'RABBIT LINE': 'LINEPAY',
    
    // ShopeePay
    'SHOPEE': 'SHOPEE',
    'SHOPEEPAY': 'SHOPEE',
    'SHOPEE PAY': 'SHOPEE',
    
    // GrabPay
    'GRAB': 'GRAB',
    'GRABPAY': 'GRAB',
    'GRAB PAY': 'GRAB',
    
    // Lazada
    'LAZADA': 'LAZADA',
    'LAZWALLET': 'LAZADA',
    
    // Credit/Store Credit
    'CREDIT': 'CREDIT',
    'เครดิต': 'CREDIT',
    'ค้างชำระ': 'CREDIT',
    
    // Voucher
    'VOUCHER': 'VOUCHER',
    'คูปอง': 'VOUCHER',
    'บัตรกำนัล': 'VOUCHER',
    'GIFT CARD': 'VOUCHER',
    
    // Mixed
    'MIXED': 'MIXED',
    'ผสม': 'MIXED',
    'หลายช่องทาง': 'MIXED',
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key.toUpperCase())) {
      return value;
    }
  }

  return 'OTHER';
}
