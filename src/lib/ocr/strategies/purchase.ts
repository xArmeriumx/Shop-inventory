/**
 * Purchase Strategy — Context-Aware Document Analyzer
 *
 * รองรับทุกประเภทภาพที่เกี่ยวกับการสั่งซื้อ:
 *   1. ใบสั่งซื้อ/ใบส่งสินค้าจากซัพพลายเออร์ (SAGASONIC, ผู้จำหน่าย)
 *   2. Screenshot แชท LINE/Facebook คุยกับซัพพลายเออร์ (จับราคา/รายการสั่ง)
 *   3. สลิปโอนเงินค่าสินค้า → จับวันที่/เวลาชำระ
 *   4. Screenshot platform ซัพพลายเออร์ (Alibaba, แพลตฟอร์ม B2B)
 *
 * Philosophy:
 *   - AI ดูบริบท → ตัดสินใจว่าจะ extract อะไร
 *   - ข้อมูลที่มั่นใจ: supplier, date, total, document number → autofill
 *   - รายการสินค้า: AI อ่านมาให้แต่ USER ต้องยืนยัน (ตรวจทาน)
 */

import { OCRStrategy, DocumentType } from './base';

export class PurchaseStrategy implements OCRStrategy {
  documentType: DocumentType = 'purchase';

  getPrompt(): string {
    return `คุณเป็น Expert Thai Purchase Document AI — อ่านเอกสารการจัดซื้อได้ทุกรูปแบบ

═══════════════════════════════════════════════════
📸 ระบุประเภทภาพก่อนเสมอ ("sourceType")
═══════════════════════════════════════════════════

"purchase_invoice"  — ใบสั่งซื้อ/ใบส่งสินค้าจากซัพพลายเออร์ (เช่น SAGASONIC, supplier invoice)
"payment_slip"     — สลิปโอนเงินค่าสินค้า → ดึงวันที่/เวลา/ยอดชำระเท่านั้น
"chat_screenshot"  — แชท LINE/FB คุยกับซัพพลายเออร์ → ดึงชื่อ/เบอร์/ราคา/รายการที่ตกลง
"platform_screenshot" — Alibaba, แพลตฟอร์ม B2B order page
"handwritten_note" — บันทึกมือ รายการสั่งซื้อ

═══════════════════════════════════════════════════
🧠 Logic ตามประเภทภาพ
═══════════════════════════════════════════════════

【purchase_invoice — ใบสั่งซื้อ/ใบส่งสินค้า】
• vendor = ชื่อบริษัท/ผู้จำหน่าย (Logo หรือหัวเอกสาร)
• documentNumber = เลขที่เอกสาร (S18742, INV-001 ฯลฯ)
• date = วันที่ในเอกสาร
• items = อ่านทุกรายการจากตาราง (code, model, specs, quantity, unitPrice, total)
• total = ยอดรวมสุทธิ
• shippingFee = ค่าขนส่ง (ถ้ามี)

【payment_slip — สลิปโอนเงิน】
⚡ ต้องการแค่:
• date = วันที่โอน (YYYY-MM-DD)
• time = เวลาโอน (HH:MM)
• total = ยอดโอน
• vendor = ชื่อผู้รับเงิน (ซัพพลายเออร์)
• paymentStatus = "paid"
• items = [] (ไม่ต้องอ่านรายการ เพราะสลิปไม่มี)

【chat_screenshot — แชทคุยกับซัพพลายเออร์】
⚡ ต้องการ:
• vendor = ชื่อซัพพลายเออร์ (จากชื่อแชท หรือที่แนะนำตัว)
• supplierPhone = เบอร์โทรซัพพลายเออร์ (ถ้ามีในแชท)
• date = วันที่แชท (ถ้าเห็น timestamp)
• items = รายการที่ตกลงซื้อขาย (ชื่อสินค้า, จำนวน, ราคาต่อชิ้น)
  → อ่านจากข้อความในแชทที่มีตัวเลขราคา เช่น "แบต 12V20AH x5 ตัว ตัวละ 650"
• total = ยอดรวม (ถ้าระบุในแชท)
• notes = ข้อความสำคัญอื่นๆ เช่น "ส่งพรุ่งนี้", "โอนก่อนส่ง"

═══════════════════════════════════════════════════
📋 ตัวอย่าง 1: ใบส่งสินค้า SAGASONIC
═══════════════════════════════════════════════════
ภาพ:
"SAGASONIC 销售发货_การขายและการจัดส่ง
S18742  วันที่: 2026-01-12
ลูกค้า: หนองคาย-SPM (อ.รัตนวาปี)
SA11298 | JL-301X6 | Red    | 1 PCS | 8,900 B
SA10525 | CWW-12V20AH | -   | 8 PCS | 650 B | 5,200 B
รวม: 46,500 B  ค่าส่ง: 1,600 B"

ตอบ:
{
  "sourceType": "purchase_invoice",
  "vendor": "SAGASONIC",
  "documentNumber": "S18742",
  "date": "2026-01-12",
  "time": null,
  "supplierPhone": null,
  "items": [
    {"code": "SA11298", "model": "JL-301X6", "name": "JL-301X6", "specs": "Red", "quantity": 1, "unitPrice": 8900, "total": 8900},
    {"code": "SA10525", "model": "CWW-12V20AH", "name": "แบตเตอรี่ 12V20AH", "specs": null, "quantity": 8, "unitPrice": 650, "total": 5200}
  ],
  "subtotal": 46500,
  "shippingFee": 1600,
  "discount": 0,
  "total": 46500,
  "paymentStatus": "pending",
  "confidence": 95
}

═══════════════════════════════════════════════════
📋 ตัวอย่าง 2: สลิปโอนเงินค่าสินค้า
═══════════════════════════════════════════════════
ภาพ:
"KBank โอนเงินสำเร็จ
วันที่ 5 มี.ค. 69  เวลา 09:43
จาก: นาย สมชาย ร้านมอเตอร์
ไปยัง: บริษัท SAGASONIC
จำนวน: 46,500 บาท"

ตอบ:
{
  "sourceType": "payment_slip",
  "vendor": "SAGASONIC",
  "date": "2026-03-05",
  "time": "09:43",
  "items": [],
  "total": 46500,
  "paymentStatus": "paid",
  "confidence": 90
}

═══════════════════════════════════════════════════
📋 ตัวอย่าง 3: แชท LINE คุยกับซัพพลายเออร์
═══════════════════════════════════════════════════
ภาพ:
"[LINE — SAGA อาร์ม 0812345678]
SAGA อาร์ม: ออเดอร์รับแล้วนะครับ
SAGA อาร์ม: รายการวันนี้ 5 มี.ค.
SAGA อาร์ม: แบต 12V20AH x 10 ชิ้น ราคา 650/ชิ้น = 6,500
SAGA อาร์ม: ที่ชาร์จ 48V x 5 ชิ้น ราคา 265/ชิ้น = 1,325
SAGA อาร์ม: รวม 7,825 บาท โอนก่อนส่งนะครับ"

ตอบ:
{
  "sourceType": "chat_screenshot",
  "vendor": "SAGA อาร์ม",
  "supplierPhone": "0812345678",
  "date": "2026-03-05",
  "time": null,
  "items": [
    {"name": "แบต 12V20AH", "quantity": 10, "unitPrice": 650, "total": 6500},
    {"name": "ที่ชาร์จ 48V", "quantity": 5, "unitPrice": 265, "total": 1325}
  ],
  "total": 7825,
  "paymentStatus": "pending",
  "notes": "โอนก่อนส่ง",
  "confidence": 82
}

═══════════════════════════════════════════════════
📤 JSON Schema (ตอบแค่นี้เท่านั้น)
═══════════════════════════════════════════════════
{
  "sourceType": "purchase_invoice|payment_slip|chat_screenshot|platform_screenshot|handwritten_note",
  "vendor": "ชื่อซัพพลายเออร์/ผู้จำหน่าย",
  "supplierPhone": "เบอร์โทรซัพพลายเออร์ (ถ้ามี)",
  "documentNumber": "เลขที่เอกสาร (ถ้ามี)",
  "date": "YYYY-MM-DD",
  "time": "HH:MM หรือ null",
  "items": [{
    "code": "รหัสสินค้า (ถ้ามี)",
    "model": "รุ่น (ถ้ามี)",
    "name": "ชื่อสินค้า (ห้ามว่าง!)",
    "specs": "สี/คุณสมบัติ (ถ้ามี)",
    "unit": "หน่วย (ถ้ามี)",
    "quantity": 1,
    "unitPrice": 0,
    "total": 0
  }],
  "subtotal": 0,
  "shippingFee": 0,
  "discount": 0,
  "total": 0,
  "paymentStatus": "paid|pending|partial",
  "notes": "หมายเหตุ (ถ้ามี)",
  "confidence": 0
}`;
  }

  validate(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    // For payment slips: just vendor + total is enough
    if (data.sourceType === 'payment_slip') {
      return !!(data.vendor || data.total > 0);
    }
    // For invoices/chat: need vendor or document number
    return !!(data.vendor || data.documentNumber);
  }

  getDefaults(): Partial<any> {
    return {
      sourceType: 'purchase_invoice',
      vendor: '',
      supplierPhone: null,
      documentType: 'purchase_order',
      documentNumber: null,
      date: new Date().toISOString().split('T')[0],
      time: null,
      items: [],
      subtotal: 0,
      shippingFee: 0,
      discount: 0,
      total: 0,
      paymentStatus: 'pending',
      notes: null,
      confidence: 0,
    };
  }
}

export const purchaseStrategy = new PurchaseStrategy();
