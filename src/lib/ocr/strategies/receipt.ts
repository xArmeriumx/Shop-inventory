/**
 * Receipt Strategy - For expense receipts (ใบเสร็จค่าใช้จ่าย)
 * Examples: POP MART, 7-Eleven, restaurants, utilities
 */

import { OCRStrategy, DocumentType } from './base';

export class ReceiptStrategy implements OCRStrategy {
  documentType: DocumentType = 'receipt';

  getPrompt(): string {
    return `คุณเป็นผู้เชี่ยวชาญอ่านใบเสร็จไทย วิเคราะห์ภาพและตอบเป็น JSON

═══════════════════════════════
⚠️ กฎสำคัญ
═══════════════════════════════
1. VAT: ราคาสินค้าในไทย = รวม VAT แล้ว, VAT ที่แยกแสดง = แค่แจ้งให้ทราบ ห้ามบวกเพิ่ม!
2. ชื่อสินค้า: ต้องอ่านชื่อภาษาไทยให้ครบ ห้ามเว้นว่าง!
3. วันที่: แปลง พ.ศ.→ค.ศ. (2569→2026)

═══════════════════════════════
📋 ตัวอย่างที่ 1 (ใบเสร็จอังกฤษ)
═══════════════════════════════
ถ้าเห็น:
"POP MART
TAX ID:0105566128393
2026-01-09 19:05:51
1 6976119961843 MOKOKO Sweetheart... 2,190.00
Totals: 4,880.00"

ตอบ:
{"vendor":"POP MART","items":[{"name":"MOKOKO Sweetheart Series","sku":"6976119961843","quantity":1,"unitPrice":2190,"total":2190}],"total":4880}

═══════════════════════════════
📋 ตัวอย่างที่ 2 (ใบเสร็จไทย)
═══════════════════════════════
ถ้าเห็น:
"KT Dream Power For You
บิลเงินสดCASH SALE
16/1/2026
KT-1688-0052
แบตเตอรี่12V12AH/A+ หน่วยละ B400.00 จำนวน 12 จำนวนเงิน B4,800.00
รวมเงิน B4,800.00"

ตอบ:
{"vendor":"KT Dream Power For You","date":"2026-01-16","receiptNumber":"KT-1688-0052","items":[{"name":"แบตเตอรี่12V12AH/A+","sku":"","quantity":12,"unitPrice":400,"total":4800}],"total":4800,"paymentMethod":"CASH","suggestedCategory":"สินค้า"}

⚠️ สังเกต: name="แบตเตอรี่12V12AH/A+" ไม่ใช่ name=""

═══════════════════════════════
📤 JSON Schema
═══════════════════════════════
{
  "vendor":"ชื่อร้าน/บริษัท (ห้ามว่าง)",
  "vendorBranch":"สาขา",
  "vendorAddress":"ที่อยู่",
  "taxId":"เลขภาษี 13 หลัก",
  "date":"YYYY-MM-DD",
  "time":"HH:MM",
  "receiptNumber":"เลขที่ใบเสร็จ",
  "invoiceNumber":"เลขใบกำกับภาษี",
  "items":[{"name":"ชื่อสินค้าภาษาไทย/อังกฤษ (ห้ามว่าง!)","sku":"รหัสสินค้า/บาร์โค้ด","quantity":1,"unitPrice":0,"total":0}],
  "subtotal":0,
  "taxAmount":0,
  "discount":0,
  "total":0,
  "paymentMethod":"CASH|CARD|QR|PROMPTPAY|TRANSFER",
  "cashReceived":0,
  "change":0,
  "suggestedCategory":"อาหาร|เดินทาง|สาธารณูปโภค|สำนักงาน|สินค้า|อื่นๆ",
  "confidence":0-100
}`;
  }

  validate(data: any): boolean {
    return !!(data.vendor && data.total !== undefined);
  }

  getDefaults(): Partial<any> {
    return {
      vendor: '',
      date: new Date().toISOString().split('T')[0],
      items: [],
      total: 0,
      paymentMethod: 'CASH',
      suggestedCategory: 'อื่นๆ',
    };
  }
}

export const receiptStrategy = new ReceiptStrategy();
