/**
 * Purchase Strategy - For purchase orders/invoices (ใบสั่งซื้อ/ใบส่งสินค้า)
 * Examples: SAGASONIC, supplier invoices, wholesale orders
 */

import { OCRStrategy, DocumentType } from './base';

export class PurchaseStrategy implements OCRStrategy {
  documentType: DocumentType = 'purchase';

  getPrompt(): string {
    return `คุณเป็นผู้เชี่ยวชาญอ่านใบสั่งซื้อ/ใบส่งสินค้าไทย วิเคราะห์ภาพและตอบเป็น JSON

═══════════════════════════════
⚠️ กฎสำคัญ
═══════════════════════════════
1. ชื่อสินค้า: ต้องอ่านให้ครบทั้งภาษาไทย/อังกฤษ/จีน (ห้ามว่าง!)
2. รหัสสินค้า (code): อ่านจากคอลัมน์แรก เช่น SA11298, SA10060
3. รุ่น (model): อ่านจากคอลัมน์ถัดไป เช่น JL-301X6, SA-807Q
4. คุณสมบัติ (specs): สี, ขนาด เช่น Red, Yellow, 12V20AH
5. วันที่: แปลง พ.ศ.→ค.ศ. (2568→2025, 2569→2026)

═══════════════════════════════
📋 ตัวอย่าง SAGASONIC ใบสั่งซื้อ
═══════════════════════════════
ถ้าเห็น:
"SAGASONIC
销售发货_การขายและการจัดส่ง
单号No:S18742                     日期วันที่:2026-01-12
客户ลูกค้า:30KPE-H43หนองคาย-SPMเอส.พีมอเตอร์ไบค์(อ.รัตนวาปี)
业务รหัส: 30KPE-HotRock (M)

| code    | 型号แบบ        | 特征คุณสมบัติ      | 单价หน่วย | 单位 | 数量 | 金额จำนวนเงิน |
|---------|---------------|-------------------|----------|------|------|------------|
| SA11298 | JL-301X6      | 红色-Red          | 8900.00B | PCS  | 1    | 8900B      |
| SA11345 | JL-301X6      | 深蓝色-Dark blue  | 8900.00B | PCS  | 1    | 8900B      |
| SA10060 | SA-807Q       | Red               | 5500.00B | PCS  | 1    | 5500B      |
| SA10055 | SA-807Q       | Yellow            | 5500.00B | PCS  | 1    | 5500B      |
| SA10069 | SA-807Q       | Gray              | 5500.00B | PCS  | 1    | 5500B      |
| SA10525 | CWW-12V20AH   | 无                | 650.00B  | PCS  | 8    | 5200B      |
| SA10567 | TN-12V15AH    | Orange            | 450.00B  | PCS  | 12   | 5400B      |

应收ลูกหนี้:46500B   费用ค่าใช้จ่าน: 1600   合计รวม:46500B"

ตอบ:
{
  "vendor":"SAGASONIC",
  "documentType":"purchase_order",
  "documentNumber":"S18742",
  "date":"2026-01-12",
  "customer":{
    "code":"30KPE-H43",
    "name":"หนองคาย-SPMเอส.พีมอเตอร์ไบค์",
    "branch":"อ.รัตนวาปี"
  },
  "salesCode":"30KPE-HotRock (M)",
  "items":[
    {"code":"SA11298","model":"JL-301X6","name":"JL-301X6 แบตเตอรี่","specs":"红色-Red","unit":"PCS","quantity":1,"unitPrice":8900,"total":8900},
    {"code":"SA11345","model":"JL-301X6","name":"JL-301X6 แบตเตอรี่","specs":"深蓝色-Dark blue","unit":"PCS","quantity":1,"unitPrice":8900,"total":8900},
    {"code":"SA10060","model":"SA-807Q","name":"SA-807Q แบตเตอรี่","specs":"Red","unit":"PCS","quantity":1,"unitPrice":5500,"total":5500},
    {"code":"SA10055","model":"SA-807Q","name":"SA-807Q แบตเตอรี่","specs":"Yellow","unit":"PCS","quantity":1,"unitPrice":5500,"total":5500},
    {"code":"SA10069","model":"SA-807Q","name":"SA-807Q แบตเตอรี่","specs":"Gray","unit":"PCS","quantity":1,"unitPrice":5500,"total":5500},
    {"code":"SA10525","model":"CWW-12V20AH(6-DZF-20)","name":"แบตเตอรี่12V20AH","specs":"无","unit":"PCS","quantity":8,"unitPrice":650,"total":5200},
    {"code":"SA10567","model":"TN-12V15AH","name":"แบตเตอรี่12V15AH","specs":"Orange","unit":"PCS","quantity":12,"unitPrice":450,"total":5400}
  ],
  "subtotal":46500,
  "shippingFee":1600,
  "discount":0,
  "total":46500,
  "amountReceivable":46500,
  "expenses":1600,
  "paymentStatus":"pending",
  "confidence":95
}

═══════════════════════════════
📋 ตัวอย่าง 2 (S14217)
═══════════════════════════════
ถ้าเห็น: "S14217, 日期:2025-10-10, SA10532 36V12-28A 充电器, SA10533 48V12-28A 充电器"

ตอบ:
{
  "documentNumber":"S14217",
  "date":"2025-10-10",
  "items":[
    {"code":"SA10532","model":"36V12-28A","name":"充电器 ม้าดำ (Charger)","specs":"无","quantity":2,"unitPrice":260,"total":520},
    {"code":"SA10533","model":"48V12-28A","name":"充电器 ม้าดำ (Charger)","specs":"无","quantity":2,"unitPrice":265,"total":530}
  ],
  "total":1100
}

═══════════════════════════════
📤 JSON Schema
═══════════════════════════════
{
  "vendor":"ชื่อบริษัท/ผู้จำหน่าย",
  "documentType":"purchase_order|delivery_note|invoice",
  "documentNumber":"เลขที่เอกสาร (S18742)",
  "date":"YYYY-MM-DD",
  "customer":{
    "code":"รหัสลูกค้า",
    "name":"ชื่อลูกค้า",
    "branch":"สาขา"
  },
  "salesCode":"รหัสพนักงานขาย",
  "items":[{
    "code":"รหัสสินค้า (SA11298)",
    "model":"รุ่น (JL-301X6)",
    "name":"ชื่อสินค้า (ห้ามว่าง!)",
    "specs":"คุณสมบัติ/สี",
    "unit":"หน่วย (PCS)",
    "quantity":1,
    "unitPrice":0,
    "total":0
  }],
  "subtotal":0,
  "shippingFee":0,
  "discount":0,
  "total":0,
  "amountReceivable":0,
  "expenses":0,
  "paymentStatus":"paid|pending|partial",
  "notes":"หมายเหตุ",
  "confidence":0-100
}`;
  }

  validate(data: any): boolean {
    return !!(data.vendor || data.documentNumber) && data.items?.length > 0;
  }

  getDefaults(): Partial<any> {
    return {
      vendor: '',
      documentType: 'purchase_order',
      documentNumber: '',
      date: new Date().toISOString().split('T')[0],
      items: [],
      total: 0,
      paymentStatus: 'pending',
    };
  }
}

export const purchaseStrategy = new PurchaseStrategy();
