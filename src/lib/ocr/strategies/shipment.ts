/**
 * Shipment Strategy — Ultra-Flexible Tracking Extractor
 *
 * รองรับทุกประเภทภาพ:
 *   1. ใบเสร็จขนส่ง (Dee Express, Kerry, Flash, J&T, ไปรษณีย์ไทย, EMS, DHL)
 *   2. Screenshot แชทกับลูกค้า (LINE, Facebook Messenger, WhatsApp, Instagram DM)
 *      → อ่านเลข tracking ที่ลูกค้าส่งมาในแชท
 *   3. Screenshot จาก Platform ร้านค้า (Shopee Seller, Lazada Seller, TikTok Shop)
 *      → อ่าน order/tracking จาก UI ของ platform
 *   4. Screenshot จากระบบขนส่ง (Flash Express app, Kerry tracking, J&T tracking)
 *   5. PDF/ใบปะหน้าพัสดุ (shipping label)
 *
 * Key Intelligence:
 *   - Pattern matching สำหรับ tracking format ของแต่ละ courier
 *   - ระบุ source type ว่าเป็น "ใบเสร็จ" หรือ "แชท" หรือ "platform UI"
 *   - อ่านชื่อ+เบอร์โทรผู้รับจากบริบท (แม้จะอยู่ในแชท)
 *   - จับเลขพัสดุหลายอันจากภาพเดียว
 */

import { OCRStrategy, DocumentType } from './base';

/** Thai courier tracking number patterns for validation */
export const TRACKING_PATTERNS: Record<string, RegExp> = {
  'Flash Express':     /^(TH)\d{11}[A-Z]?\d?$/i,
  'J&T Express':       /^[0-9]{12,13}$/,
  'Kerry Express':     /^[A-Z]{2}\d{9}TH$/i,
  'DHL':               /^[0-9]{10,12}$/,
  'EMS / ไปรษณีย์ไทย': /^[A-Z]{2}\d{9}TH$/i,
  'SCG Express':       /^[A-Z0-9]{12,20}$/i,
  'Ninja Van':         /^[A-Z]{2}\d{9}TH$/i,
  'Best Express':      /^[A-Z0-9]{10,15}$/i,
  'Shopee Express':    /^SP[A-Z0-9]{10,18}$/i,
  'Lazada Logistics':  /^LE[A-Z0-9]{10,18}$/i,
};

export class ShipmentStrategy implements OCRStrategy {
  documentType: DocumentType = 'shipment';

  getPrompt(): string {
    return `คุณเป็น Expert Thai Shipment AI — ผู้เชี่ยวชาญจับเลขพัสดุจากทุกประเภทภาพ

═══════════════════════════════════════════════════
📸 ประเภทภาพที่รองรับ (ระบุให้ชัดใน "sourceType")
═══════════════════════════════════════════════════

1. "courier_receipt" — ใบเสร็จขนส่ง (Flash, Kerry, J&T, ไปรษณีย์, Dee Express)
2. "chat_screenshot" — Screenshot แชท LINE/FB/WhatsApp ที่ลูกค้าส่งเลข tracking มา
3. "platform_ui"    — หน้า UI ของ Shopee/Lazada/TikTok Seller Center / Flash App
4. "shipping_label" — ใบปะหน้าพัสดุ (Label)
5. "tracking_app"   — Screenshot จาก app ติดตามพัสดุ

═══════════════════════════════════════════════════
🔍 วิธีอ่านแต่ละประเภท
═══════════════════════════════════════════════════

【ใบเสร็จขนส่ง (courier_receipt)】
• อ่าน tracking number จากบรรทัดที่มีรหัส (เช่น TH01488BG2TN0B หรือ 63-1234567890)
• ชื่อผู้รับ = บรรทัดหลัง "ผู้รับ:" หรือ "To:" หรือ "Name:"
• เบอร์โทร = เลข 10 หลักใกล้ชื่อผู้รับ
• ขนส่ง = ดูจาก Logo หรือชื่อบริษัทในใบเสร็จ

【แชทลูกค้า (chat_screenshot)】
• มองหา "pattern" ที่เป็น tracking number: ตัวอักษร+ตัวเลข ยาว 8-20 ตัว
• ลูกค้ามักพิมพ์ว่า "เลขพัสดุ: TH...", "tracking: ...", "flash: ...", หรือแค่ส่งตัวเลขเปล่าๆ
• ชื่อผู้รับ = ชื่อลูกค้าในแชท (มักอยู่ด้านบนสุดของ chat bubble)
• เบอร์โทร = เลข 10 หลักที่ลูกค้าพิมพ์มาในแชท  
• ⚠️ ห้ามสับสนว่า ID Line / Facebook UID คือ tracking number

【Platform UI (platform_ui)】
• Shopee: หา "เลขพัสดุ" / "Tracking No." / "หมายเลขการติดตาม" → ค่าข้างๆ
• Lazada: หา "Tracking Number" / "AWB No." → ค่าข้างๆ
• TikTok Shop: หา "Tracking Number" → ค่าข้างๆ
• Flash Seller App: หา tracking ในรายการออเดอร์
• ชื่อลูกค้าจาก UI → ใส่เป็น recipientName

═══════════════════════════════════════════════════
📋 Thai Courier Tracking Format Reference
═══════════════════════════════════════════════════

Flash Express:     TH + 11 ตัวเลข + อักษร (เช่น TH01488BG2TN0B)
                   หรือ 63XXXXXXXXXX (12 หลัก ขึ้นต้น 63)
J&T Express:       ตัวเลขล้วน 12-13 หลัก (เช่น 630123456789)
Kerry Express:     ตัวอักษร 2 ตัว + 9 เลข + TH (เช่น KY012345678TH)
EMS/ไปรษณีย์ไทย:  ตัวอักษร 2 ตัว + 9 เลข + TH (เช่น EY012345678TH)
Shopee Express:    SP + 10-18 ตัวอักษร/เลข
DHL:               ตัวเลขล้วน 10-12 หลัก
SCG Express:       ตัวอักษร+เลขผสม 12-20 ตัว
Ninja Van:         ตัวอักษร 2 ตัว + 9 เลข + TH
Best Express:      ตัวอักษร+เลข 10-15 ตัว
Lazada:            LE + ตัวอักษร/เลข 10-18 ตัว

⚠️ ถ้าไม่ชัวร์ provider → ใส่ค่าที่น่าจะเป็นที่สุด อย่าปล่อยว่าง
⚠️ ระวังสับสน: I↔1, O↔0, B↔8, S↔5 ใน tracking number

═══════════════════════════════════════════════════
📤 JSON Schema (ตอบแค่นี้เท่านั้น)
═══════════════════════════════════════════════════

{
  "sourceType": "courier_receipt | chat_screenshot | platform_ui | shipping_label | tracking_app",
  "senderName": "ชื่อผู้ส่ง/ชื่อร้าน (ถ้าอยู่ในภาพ)",
  "receiptNumber": "เลขใบเสร็จ (ถ้ามี)",  
  "date": "YYYY-MM-DD (วันที่ในภาพ — ถ้าไม่มีให้ null)",
  "platform": "Shopee | Lazada | TikTok Shop | Flash App | LINE | Facebook | null",
  "parcels": [
    {
      "trackingNumber": "XXXXXXXXXX (ห้ามว่าง!)",
      "shippingProvider": "Flash Express | J&T | Kerry | EMS | ไปรษณีย์ไทย | DHL | Shopee Express | Lazada | SCG | Ninja Van | Best Express | อื่นๆ",
      "recipientName": "ชื่อผู้รับ (ถ้ามี)",
      "recipientPhone": "0XXXXXXXXX (ถ้ามี)",
      "province": "จังหวัดปลายทาง (ถ้ามี)",
      "shippingCost": 0,
      "weight": "น้ำหนัก เช่น 0.4 kg (ถ้ามี)",
      "size": "ขนาด เช่น 20x30x10 cm (ถ้ามี)",
      "orderReference": "เลข Order/Invoice ที่เชื่อมกับพัสดุนี้ (ถ้ามี)",
      "notes": "ข้อมูลเพิ่มเติม (ถ้ามี)"
    }
  ],
  "totalCost": 0,
  "confidence": 85,
  "confidenceNote": "เหตุผลสั้นๆ ถ้า confidence < 80 เช่น ภาพเบลอ, tracking ไม่ชัด"
}

═══════════════════════════════════════════════════
📋 ตัวอย่าง 1: ใบเสร็จ Dee Express (2 พัสดุ)
═══════════════════════════════════════════════════
ภาพ:
"Dee Express รับฝากส่งพัสดุ
วันที่: 5/3/2026
1. TH01488BG2TN0B (0.4 kg.) | Flash Express
   ผู้รับ: นางจุฑารัตน์ เฮสตี้ (0991649896) กรุงเทพ
   ค่าส่ง: ฿35
2. 630987654321 (1.2 kg.) | J&T
   ผู้รับ: คุณสมชาย ใจดี (0812345678) เชียงใหม่
   ค่าส่ง: ฿55
รวม: ฿90"

ตอบ:
{
  "sourceType": "courier_receipt",
  "date": "2026-03-05",
  "platform": null,
  "parcels": [
    {"trackingNumber": "TH01488BG2TN0B", "shippingProvider": "Flash Express", "recipientName": "นางจุฑารัตน์ เฮสตี้", "recipientPhone": "0991649896", "province": "กรุงเทพ", "shippingCost": 35, "weight": "0.4 kg"},
    {"trackingNumber": "630987654321", "shippingProvider": "J&T Express", "recipientName": "คุณสมชาย ใจดี", "recipientPhone": "0812345678", "province": "เชียงใหม่", "shippingCost": 55, "weight": "1.2 kg"}
  ],
  "totalCost": 90,
  "confidence": 95
}

═══════════════════════════════════════════════════
📋 ตัวอย่าง 2: Screenshot แชท LINE ลูกค้า
═══════════════════════════════════════════════════
ภาพ:
"[LINE Chat — คุณอรทัย]
คุณอรทัย: ขอบคุณค่ะ ได้รับของแล้วนะคะ
คุณอรทัย: เลขพัสดุ: TH0341282F9W4C4 ค่ะ รบกวนช่วยเช็คให้หน่อยนะคะ
คุณอรทัย: เบอร์โทร 0891234567"

ตอบ:
{
  "sourceType": "chat_screenshot",
  "platform": "LINE",
  "date": null,
  "parcels": [
    {"trackingNumber": "TH0341282F9W4C4", "shippingProvider": "Flash Express", "recipientName": "คุณอรทัย", "recipientPhone": "0891234567", "province": null, "shippingCost": null}
  ],
  "totalCost": null,
  "confidence": 88,
  "confidenceNote": "ไม่มีข้อมูลค่าส่งและจังหวัดในแชท"
}

═══════════════════════════════════════════════════
📋 ตัวอย่าง 3: Screenshot Shopee Seller Center
═══════════════════════════════════════════════════
ภาพ:
"Shopee Seller Center
Orders > Order Detail
Order ID: 240305ABCDEF
ผู้ซื้อ: buyer_somchai
Tracking Number: SP123456789TH
Shopee Express | น้ำหนัก 0.5 kg
สถานะ: กำลังจัดส่ง"

ตอบ:
{
  "sourceType": "platform_ui",
  "platform": "Shopee",
  "date": null,
  "parcels": [
    {"trackingNumber": "SP123456789TH", "shippingProvider": "Shopee Express", "recipientName": "buyer_somchai", "recipientPhone": null, "orderReference": "240305ABCDEF", "weight": "0.5 kg", "shippingCost": null}
  ],
  "totalCost": null,
  "confidence": 92
}`;
  }

  validate(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.parcels) || data.parcels.length === 0) return false;

    // At least one parcel must have a tracking number of reasonable length
    return data.parcels.some((p: any) =>
      p.trackingNumber &&
      typeof p.trackingNumber === 'string' &&
      p.trackingNumber.trim().length >= 8
    );
  }

  getDefaults(): Partial<any> {
    return {
      sourceType: 'courier_receipt',
      senderName: null,
      receiptNumber: null,
      date: null,
      platform: null,
      parcels: [],
      totalCost: null,
      confidence: 0,
      confidenceNote: null,
    };
  }
}

export const shipmentStrategy = new ShipmentStrategy();
