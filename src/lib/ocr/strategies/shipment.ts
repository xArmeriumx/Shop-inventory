/**
 * OCR Strategy for Shipping Receipts
 * Extracts tracking numbers, recipient info, and costs from Thai courier receipts
 * (Dee Express, Kerry, Flash Express, J&T, Thailand Post, etc.)
 */

import { OCRStrategy, DocumentType } from './base';

export class ShipmentStrategy implements OCRStrategy {
  documentType: DocumentType = 'shipment';

  getPrompt(): string {
    return `คุณเป็นผู้เชี่ยวชาญอ่านใบเสร็จขนส่งไทย (Dee Express, Kerry, Flash Express, J&T, ไปรษณีย์ไทย, DHL, EMS)

⚠️ กฎสำคัญ:
1. ใบเสร็จ 1 ใบ อาจมีหลาย parcel — ต้องแยกแต่ละ parcel ออกจากกัน
2. Tracking Number: อ่านให้ครบ ตัวอักษร+ตัวเลข (เช่น TH01488BG2TN0B)
3. อ่านชื่อ+เบอร์โทรผู้รับให้ครบถ้วน
4. ระวัง ตัว I กับ 1, ตัว O กับ 0 ใน tracking number

📋 ตัวอย่าง Dee Express:
"1. TH01488BG2TN0B (0.4 kg.)
ขนส่ง: FlashExpress
ผู้รับ: นางจุฑารัตน์ เฮสตี้ (0991649896)
จังหวัด: กรุงเทพ
ค่าขนส่ง: 35.00 บาท"

→ ตอบเป็น JSON เท่านั้น:
{
  "senderName": "ชื่อผู้ส่ง (ถ้ามี)",
  "receiptNumber": "เลขใบเสร็จ (ถ้ามี)",
  "date": "YYYY-MM-DD",
  "parcels": [
    {
      "trackingNumber": "TH01488BG2TN0B",
      "shippingProvider": "FlashExpress",
      "recipientName": "นางจุฑารัตน์ เฮสตี้",
      "recipientPhone": "0991649896",
      "province": "กรุงเทพ",
      "shippingCost": 35.00,
      "weight": "0.4 kg",
      "size": null
    }
  ],
  "totalCost": 35.00,
  "confidence": 85
}

⚠️ ถ้าอ่านไม่ชัด ให้ใส่ค่าที่เป็นไปได้มากที่สุด ห้ามเว้นว่าง tracking number
⚠️ confidence ต้องเป็นตัวเลข 0-100`;
  }

  validate(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.parcels) || data.parcels.length === 0) return false;

    return data.parcels.every((p: any) =>
      p.trackingNumber && typeof p.trackingNumber === 'string' && p.trackingNumber.length > 3
    );
  }

  getDefaults(): Partial<any> {
    return {
      senderName: null,
      receiptNumber: null,
      date: new Date().toISOString().split('T')[0],
      parcels: [],
      totalCost: 0,
      confidence: 0,
    };
  }
}

export const shipmentStrategy = new ShipmentStrategy();
