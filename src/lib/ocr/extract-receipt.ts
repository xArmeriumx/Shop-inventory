/**
 * AI Receipt Data Extraction
 * Uses Groq AI to extract structured data from OCR text
 */

import { groq } from '../groq';
import type { ReceiptData, ReceiptItem } from './types';

// Prompt for receipt extraction - optimized for Thai receipts
const RECEIPT_EXTRACTION_PROMPT = `คุณเป็น AI ที่เชี่ยวชาญในการอ่านและวิเคราะห์ใบเสร็จ/ใบกำกับภาษี
คุณต้องดึงข้อมูลจาก OCR text ที่อาจมีข้อผิดพลาดบ้าง และแก้ไขให้ถูกต้อง

ความสามารถ:
1. แก้ไข OCR errors เช่น "วันlhi" → "วันที่", "บn" → "บาท", "O" → "0"
2. รู้จักรูปแบบใบเสร็จหลายประเภท:
   - ใบเสร็จ 7-eleven, Lotus, Big C, Family Mart, Makro
   - ใบเสร็จร้านอาหาร, ร้านกาแฟ
   - ใบกำกับภาษี
   - ใบเสร็จร้านค้าทั่วไป
   - ใบเสร็จปั๊มน้ำมัน (PTT, Shell, Bangchak, etc.)
   - ใบเสร็จค่าสาธารณูปโภค (ค่าน้ำ, ค่าไฟ, ค่าโทรศัพท์)
3. ดึงข้อมูลให้ครบถ้วน

ตอบเป็น JSON เท่านั้น ตามโครงสร้างนี้:
{
  "vendor": "ชื่อร้าน/บริษัท (null ถ้าไม่พบ)",
  "vendorAddress": "ที่อยู่ร้าน (null ถ้าไม่พบ)",
  "vendorPhone": "เบอร์โทร (null ถ้าไม่พบ)",
  "taxId": "เลขประจำตัวผู้เสียภาษี (null ถ้าไม่พบ)",
  "date": "วันที่ในรูปแบบ YYYY-MM-DD (null ถ้าไม่พบ)",
  "time": "เวลา HH:MM (null ถ้าไม่พบ)",
  "receiptNumber": "เลขที่ใบเสร็จ (null ถ้าไม่พบ)",
  "items": [{"name": "ชื่อสินค้า", "quantity": 1, "unitPrice": 0, "total": 0}],
  "subtotal": "ยอดรวมก่อนภาษี (null ถ้าไม่พบ)",
  "taxAmount": "ภาษีมูลค่าเพิ่ม (null ถ้าไม่พบ)",
  "discount": "ส่วนลด (null ถ้าไม่พบ)",
  "total": "ยอดรวมสุทธิ (ต้องมีเสมอ, เดาจากข้อมูลถ้าจำเป็น)",
  "paymentMethod": "วิธีชำระเงิน เช่น CASH, CARD, QR, PROMPTPAY (null ถ้าไม่พบ)",
  "suggestedCategory": "หมวดหมู่ที่แนะนำ เช่น อาหาร, เครื่องดื่ม, ค่าเดินทาง, ค่าสาธารณูปโภค, ค่าใช้จ่ายสำนักงาน",
  "confidence": "ความมั่นใจ 0-100"
}

หมายเหตุ:
- ถ้าไม่พบข้อมูลใด ให้ใส่ null
- total ต้องมีเสมอ ถ้าไม่พบให้เดาจากรายการสินค้า
- แปลงวันที่ไทย (เช่น "15 ม.ค. 68") เป็น ISO format (2025-01-15)
- แปลงปี พ.ศ. เป็น ค.ศ. (2568 → 2025)`;

/**
 * Extract structured data from OCR text using AI
 */
export async function extractReceiptData(ocrText: string): Promise<ReceiptData> {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: RECEIPT_EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: `กรุณาวิเคราะห์ใบเสร็จนี้และดึงข้อมูล:\n\n${ocrText}`,
        },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 2000,
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
    return {
      vendor: null,
      vendorAddress: null,
      vendorPhone: null,
      taxId: null,
      date: null,
      time: null,
      receiptNumber: null,
      items: [],
      subtotal: null,
      taxAmount: null,
      discount: null,
      total: 0,
      paymentMethod: null,
      suggestedCategory: 'อื่นๆ',
      rawText: ocrText,
      confidence: 0,
    };
  }
}

/**
 * Normalize and validate extracted data
 */
function normalizeReceiptData(data: any, rawText: string): ReceiptData {
  // Parse items
  const items: ReceiptItem[] = (data.items || []).map((item: any) => ({
    name: String(item.name || ''),
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    total: Number(item.total) || 0,
  })).filter((item: ReceiptItem) => item.name);

  // Calculate total from items if not provided
  let total = Number(data.total) || 0;
  if (total === 0 && items.length > 0) {
    total = items.reduce((sum, item) => sum + item.total, 0);
  }

  // Normalize date format
  let date = data.date;
  if (date) {
    // Try to parse various date formats
    const parsedDate = parseThaiDate(date);
    date = parsedDate || date;
  }

  return {
    vendor: data.vendor || null,
    vendorAddress: data.vendorAddress || null,
    vendorPhone: data.vendorPhone || null,
    taxId: data.taxId || null,
    date,
    time: data.time || null,
    receiptNumber: data.receiptNumber || null,
    items,
    subtotal: data.subtotal ? Number(data.subtotal) : null,
    taxAmount: data.taxAmount ? Number(data.taxAmount) : null,
    discount: data.discount ? Number(data.discount) : null,
    total,
    paymentMethod: normalizePaymentMethod(data.paymentMethod),
    suggestedCategory: data.suggestedCategory || 'อื่นๆ',
    rawText,
    confidence: Number(data.confidence) || 50,
  };
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
 * Normalize payment method
 */
function normalizePaymentMethod(method: string | null): string | null {
  if (!method) return null;
  
  const normalized = method.toUpperCase().trim();
  
  // Map common variations
  const mappings: { [key: string]: string } = {
    'CASH': 'CASH',
    'เงินสด': 'CASH',
    'CARD': 'CARD',
    'CREDIT': 'CARD',
    'DEBIT': 'CARD',
    'บัตร': 'CARD',
    'QR': 'QR',
    'PROMPTPAY': 'PROMPTPAY',
    'พร้อมเพย์': 'PROMPTPAY',
    'โอน': 'TRANSFER',
    'TRANSFER': 'TRANSFER',
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key.toUpperCase())) {
      return value;
    }
  }

  return method;
}
