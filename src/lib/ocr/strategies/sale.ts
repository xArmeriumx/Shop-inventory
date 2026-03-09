/**
 * Sale Strategy — Context-Aware Customer & Sale Analyzer
 *
 * รองรับทุกประเภทภาพที่เกี่ยวกับการขาย:
 *   1. ใบแจ้งหนี้/ใบส่งสินค้า (sale invoice) → อ่านรายการสินค้า + ลูกค้า
 *   2. Screenshot แชทลูกค้า (LINE/Facebook) → autofill ชื่อ/เบอร์/ที่อยู่ลูกค้า
 *   3. สลิปโอนเงินจากลูกค้า → จับวันที่/เวลา/ยอดชำระ (ยืนยันการขาย)
 *   4. สั่งซื้อออนไลน์ (Shopee/Lazada order) → อ่าน order + ที่อยู่
 *
 * Philosophy:
 *   - แชทลูกค้า: AI อ่านที่อยู่/ชื่อ/เบอร์ → autofill customer info ทันที
 *   - สลิป: AI จับเวลาชำระ → อัปเดตวันที่ใน form
 *   - รายการสินค้า: AI อ่านมาให้เป็น "draft" → USER ยืนยันเอง (ตรวจทาน)
 */

import { OCRStrategy, DocumentType } from './base';

export class SaleStrategy implements OCRStrategy {
  documentType: DocumentType = 'sale';

  getPrompt(): string {
    return `คุณเป็น Expert Thai Sale & Customer AI — อ่านเอกสารการขายได้ทุกรูปแบบ

═══════════════════════════════════════════════════
📸 ระบุประเภทภาพก่อนเสมอ ("sourceType")
═══════════════════════════════════════════════════

"sale_invoice"     — ใบแจ้งหนี้/ใบส่งสินค้าให้ลูกค้า
"payment_slip"     — สลิปโอนเงินจากลูกค้า → ดึงวันที่/เวลา/ยอดชำระ
"chat_screenshot"  — แชทลูกค้า LINE/Facebook → ดึงชื่อ/เบอร์/ที่อยู่
"order_screenshot" — หน้า Order Shopee/Lazada/TikTok → อ่าน order + ที่อยู่
"quotation"        — ใบเสนอราคา

═══════════════════════════════════════════════════
🧠 Logic ตามประเภทภาพ — อะไรสำคัญที่สุด
═══════════════════════════════════════════════════

【sale_invoice — ใบแจ้งหนี้】
• customerName, customerPhone, customerAddress → autofill customer
• date → วันที่ขาย
• items → อ่านรายการ (draft, user ยืนยัน)
• total, paymentMethod

【payment_slip — สลิปโอนจากลูกค้า】
⚡ ต้องการแค่:
• date = วันโอน (YYYY-MM-DD)
• time = เวลาโอน (HH:MM) ← สำคัญมาก (ยืนยันเวลาชำระ)
• total = ยอดโอน
• senderName = ชื่อผู้โอน (ลูกค้า)
• paymentMethod = "BANK_TRANSFER"
• items = [] (ไม่ต้องอ่านรายการสินค้า)

【chat_screenshot — แชทลูกค้า ← สำคัญที่สุด】
⚡ Priority สูงสุด — autofill ข้อมูลลูกค้า:
• customerName = ชื่อลูกค้าในแชท (ชื่อ LINE / FB / ที่แนะนำตัว)
• customerPhone = เบอร์โทรที่ลูกค้าพิมพ์มา (0XXXXXXXXX)
• customerAddress = ที่อยู่จัดส่งที่ลูกค้าส่งมา
  → มักมีรูปแบบ: "บ้านเลขที่... ถนน... ตำบล... อำเภอ... จังหวัด... รหัสไปรษณีย์..."
  → หรือ "123/45 ม.6 ต.บ้านดี อ.เมือง จ.ขอนแก่น 40000"
• date = วันแชท (ถ้าเห็น timestamp)
• items = รายการที่ลูกค้าสั่ง (ถ้ามีในแชท เช่น "สั่ง แบต 12V x2")
• notes = ข้อความสำคัญ เช่น "รีบด่วน", "ให้แพ็คแบบพิเศษ"

วิธีหาที่อยู่ในแชท:
→ ลูกค้ามักส่งมาในรูป: "ที่อยู่: 123/45...", "จัดส่งที่: ...", "ส่งมาที่..."
→ หรือส่ง LINE address card
→ ถ้าลูกค้าพิมพ์แยกหลายบรรทัด ให้ join รวมกัน

【order_screenshot — Order จาก Platform】
• platform = "Shopee" | "Lazada" | "TikTok"
• customerName = ชื่อผู้ซื้อ
• customerAddress = ที่อยู่จัดส่ง (เต็มๆ)
• customerPhone = เบอร์โทร (ถ้าแสดง)
• items = รายการสินค้าใน order
• total = ยอดรวม
• paymentMethod = วิธีชำระ

═══════════════════════════════════════════════════
📋 ตัวอย่าง 1: สลิปโอนเงินจากลูกค้า
═══════════════════════════════════════════════════
ภาพ:
"SCB โอนเงินสำเร็จ
วันที่ 5 ก.พ. 69  เวลา 14:32
จาก: นาย อมร วงค์สา
ไปยัง: ร้านสมชาย มอเตอร์ไบค์
จำนวน: 8,900 บาท"

ตอบ:
{
  "sourceType": "payment_slip",
  "senderName": "นาย อมร วงค์สา",
  "date": "2026-02-05",
  "time": "14:32",
  "total": 8900,
  "paymentMethod": "BANK_TRANSFER",
  "items": [],
  "confidence": 92
}

═══════════════════════════════════════════════════
📋 ตัวอย่าง 2: แชท LINE ลูกค้าให้ที่อยู่ ← สำคัญมาก
═══════════════════════════════════════════════════
ภาพ:
"[LINE — นุช ลูกค้า]
นุช: สั่งแบต 12V20AH 2 ลูกนะคะ
นุช: ส่งมาที่อยู่นี้ค่ะ
นุช: คุณนุชนาถ สมใจ
      89/12 ม.3 ต.ท่าขอนยาง อ.กันทรวิชัย
      จ.มหาสารคาม 44150
นุช: เบอร์ 0895671234 ค่ะ
นุช: โอนเงินให้แล้วนะคะ 1,300 บาท"

ตอบ:
{
  "sourceType": "chat_screenshot",
  "customerName": "นุชนาถ สมใจ",
  "customerPhone": "0895671234",
  "customerAddress": "89/12 ม.3 ต.ท่าขอนยาง อ.กันทรวิชัย จ.มหาสารคาม 44150",
  "date": null,
  "time": null,
  "items": [
    {"name": "แบต 12V20AH", "quantity": 2, "unitPrice": 650, "total": 1300}
  ],
  "total": 1300,
  "paymentMethod": "BANK_TRANSFER",
  "notes": "โอนเงินแล้ว",
  "confidence": 88
}

═══════════════════════════════════════════════════
📋 ตัวอย่าง 3: ใบแจ้งหนี้ขาย
═══════════════════════════════════════════════════
ภาพ:
"ใบส่งสินค้า วันที่ 15/01/2026
ลูกค้า: นาง อรพิน มาดี เบอร์ 0861234567
ที่อยู่: 45 ถ.มิตรภาพ อ.เมือง จ.ขอนแก่น
เลขที่: INV-2026-001
แบตเตอรี่ 12V20AH  x2  ราคา 800  รวม 1,600
ที่ชาร์จ 48V       x1  ราคา 1,200  รวม 1,200
รวมทั้งสิ้น 2,800 บาท | ชำระเงินสด"

ตอบ:
{
  "sourceType": "sale_invoice",
  "documentNumber": "INV-2026-001",
  "customerName": "นาง อรพิน มาดี",
  "customerPhone": "0861234567",
  "customerAddress": "45 ถ.มิตรภาพ อ.เมือง จ.ขอนแก่น",
  "date": "2026-01-15",
  "time": null,
  "items": [
    {"name": "แบตเตอรี่ 12V20AH", "sku": null, "quantity": 2, "unitPrice": 800, "total": 1600},
    {"name": "ที่ชาร์จ 48V", "sku": null, "quantity": 1, "unitPrice": 1200, "total": 1200}
  ],
  "subtotal": 2800,
  "discount": 0,
  "total": 2800,
  "paymentMethod": "CASH",
  "confidence": 93
}

═══════════════════════════════════════════════════
📋 ตัวอย่าง 4: Order Shopee
═══════════════════════════════════════════════════
ภาพ:
"Shopee — รายละเอียดคำสั่งซื้อ
ชื่อผู้ซื้อ: somchai_shop
ที่อยู่: 10/1 ซ.สุขุมวิท 50 แขวงพระโขนง เขตคลองเตย กรุงเทพฯ 10260
เบอร์: 089-234-5678
สินค้า: แบตเตอรี่มอไซค์ 12V9AH x1 ราคา 450 บาท
ยอดรวม: 450 บาท | Shopee Pay"

ตอบ:
{
  "sourceType": "order_screenshot",
  "platform": "Shopee",
  "customerName": "somchai_shop",
  "customerPhone": "0892345678",
  "customerAddress": "10/1 ซ.สุขุมวิท 50 แขวงพระโขนง เขตคลองเตย กรุงเทพฯ 10260",
  "date": null,
  "items": [
    {"name": "แบตเตอรี่มอไซค์ 12V9AH", "quantity": 1, "unitPrice": 450, "total": 450}
  ],
  "total": 450,
  "paymentMethod": "QR_CODE",
  "confidence": 90
}

═══════════════════════════════════════════════════
📤 JSON Schema (ตอบแค่นี้เท่านั้น)
═══════════════════════════════════════════════════
{
  "sourceType": "sale_invoice|payment_slip|chat_screenshot|order_screenshot|quotation",
  "platform": "Shopee|Lazada|TikTok|null",
  "documentNumber": "เลขเอกสาร (ถ้ามี)",
  "senderName": "ชื่อผู้โอน (สำหรับ payment_slip)",
  "customerName": "ชื่อลูกค้า",
  "customerPhone": "เบอร์โทรลูกค้า",
  "customerAddress": "ที่อยู่จัดส่งเต็ม (รวม รหัสไปรษณีย์)",
  "date": "YYYY-MM-DD",
  "time": "HH:MM (สำคัญสำหรับสลิป)",
  "items": [{
    "name": "ชื่อสินค้า",
    "sku": "รหัสสินค้า (ถ้ามี)",
    "quantity": 1,
    "unitPrice": 0,
    "total": 0
  }],
  "subtotal": 0,
  "discount": 0,
  "total": 0,
  "paymentMethod": "CASH|BANK_TRANSFER|QR_CODE|PROMPTPAY|CREDIT_CARD|null",
  "notes": "ข้อความสำคัญ (ถ้ามี)",
  "confidence": 0
}`;
  }

  validate(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    // Payment slip: just need total
    if (data.sourceType === 'payment_slip') {
      return !!(data.total > 0 || data.date);
    }
    // Chat: need at least customer name or phone
    if (data.sourceType === 'chat_screenshot') {
      return !!(data.customerName || data.customerPhone || data.customerAddress);
    }
    // Invoice/Order: need items or total
    const hasItems = Array.isArray(data.items) && data.items.length > 0;
    const hasTotal = typeof data.total === 'number' && data.total > 0;
    return hasItems || hasTotal || !!(data.customerName);
  }

  getDefaults(): Partial<any> {
    return {
      sourceType: 'sale_invoice',
      platform: null,
      documentNumber: null,
      senderName: null,
      customerName: null,
      customerPhone: null,
      customerAddress: null,
      date: null,
      time: null,
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      paymentMethod: null,
      notes: null,
      confidence: 0,
    };
  }
}

export const saleStrategy = new SaleStrategy();
