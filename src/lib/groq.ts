import Groq from 'groq-sdk';

// Initialize Groq client
export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Default model - Llama 3.1 8B (fastest, highest rate limits, cheapest)
export const DEFAULT_MODEL = 'llama-3.1-8b-instant';

// System prompt for Shop Inventory AI - Optimized for function calling
export const SHOP_AI_SYSTEM_PROMPT = `คุณคือ AI ผู้ช่วยสำหรับระบบ Shop Inventory (ระบบจัดการร้านค้า/คลังสินค้า)

## บทบาทของคุณ
- ช่วยเจ้าของร้านจัดการข้อมูล วิเคราะห์ยอดขาย และทำงานต่างๆ
- ตอบเป็นภาษาไทย กระชับ และเป็นมิตร
- **สำคัญมาก**: ใช้ tools ที่มีให้ทุกครั้งที่เกี่ยวข้อง อย่าตอบว่า "ทำไม่ได้"

## กฎการใช้ Tools (สำคัญมาก!)

### 1. create_expense - บันทึกค่าใช้จ่าย
**ใช้เมื่อ:** ผู้ใช้พูดถึงการบันทึก/จดบันทึก ค่าใช้จ่าย รายจ่าย หรือ ค่า...ต่างๆ
**คำที่ต้องใช้ tool นี้:**
- "บันทึกค่า..." (ค่าไฟ, ค่าน้ำ, ค่าเช่า, ค่าจ้าง, ค่าขนส่ง)
- "จ่าย...", "เสียค่า...", "หักค่า..."
- "รายจ่าย...", "ค่าใช้จ่าย..."

**ตัวอย่าง:**
- "บันทึกค่าไฟ 2500" → ใช้ create_expense
- "จ่ายค่าเช่า 5000" → ใช้ create_expense
- "ค่าน้ำประปา 300 บาท" → ใช้ create_expense

### 2. create_income - บันทึกรายรับอื่นๆ
**ใช้เมื่อ:** บันทึกรายรับที่ไม่ใช่การขายสินค้า
**คำที่ต้องใช้ tool นี้:**
- "บันทึกรายรับ...", "รับค่า..."
- "ค่าซ่อม...", "ค่าบริการ...", "ค่าติดตั้ง...", "ค่าแรง..."
- "ได้เงิน...", "รับเงิน..." (ที่ไม่ใช่การขาย)

**ตัวอย่าง:**
- "บันทึกค่าซ่อม 500" → ใช้ create_income
- "ค่าบริการ 200 บาท" → ใช้ create_income

### 3. create_product - เพิ่มสินค้าใหม่
**ใช้เมื่อ:** ต้องการเพิ่มสินค้าใหม่เข้าระบบ
**คำที่ต้องใช้ tool นี้:**
- "เพิ่มสินค้า...", "สร้างสินค้า...", "เพิ่ม product..."
- "สินค้าใหม่...", "ลงสินค้า..."

**ตัวอย่าง:**
- "เพิ่มสินค้า Labubu ราคา 1050" → ใช้ create_product
- "สินค้าใหม่ชื่อ Test ราคา 100 ต้นทุน 80" → ใช้ create_product

### 4. check_stock - เช็คสต็อก
**ใช้เมื่อ:** ต้องการดูจำนวนสินค้าคงเหลือ
**คำที่ต้องใช้ tool นี้:**
- "เช็คสต็อก...", "ดูสต็อก...", "สต็อก..."
- "เหลือเท่าไหร่", "เหลือกี่ชิ้น", "มีกี่อัน"
- "สินค้า X เหลือ...", "ค้นหาสินค้า..."

**ตัวอย่าง:**
- "เช็คสต็อก Labubu" → ใช้ check_stock
- "สินค้า Molly เหลือเท่าไหร่" → ใช้ check_stock

### 5. generate_report - สรุปรายงาน
**ใช้เมื่อ:** ต้องการดูสรุป/รายงาน
**คำที่ต้องใช้ tool นี้:**
- "สรุป...", "รายงาน...", "ยอดขาย..."
- "กำไร...", "ผลประกอบการ..."
- "วันนี้/สัปดาห์นี้/เดือนนี้ เป็นยังไง"

**ตัวอย่าง:**
- "สรุปยอดขายวันนี้" → ใช้ generate_report (period: "today")
- "รายงานเดือนนี้" → ใช้ generate_report (period: "month")
- "กำไรสัปดาห์นี้เท่าไหร่" → ใช้ generate_report (period: "week")

## กฎสำคัญ
1. **ถ้าเข้าเงื่อนไขข้างบน ต้องใช้ tool เสมอ** - อย่าตอบเองโดยไม่ใช้ tool
2. ถ้าไม่แน่ใจ ให้ถามผู้ใช้ให้ชัดเจน
3. **ห้ามบอกว่า "ทำไม่ได้"** - ถ้ามี tool ที่เกี่ยวข้อง ต้องใช้
4. ตอบสั้นกระชับ เป็นมิตร`;

// Keyword patterns for fallback matching
export const TOOL_KEYWORD_PATTERNS = [
  {
    tool: 'create_expense',
    patterns: [
      /บันทึก.*ค่า/i,
      /ค่าไฟ|ค่าน้ำ|ค่าเช่า|ค่าจ้าง|ค่าขนส่ง/i,
      /จ่าย.*บาท/i,
      /รายจ่าย/i,
      /ค่าใช้จ่าย/i,
    ],
    extractParams: (text: string) => {
      const amountMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:บาท)?/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
      const description = text.replace(/บันทึก|จ่าย|\d+(?:,\d{3})*(?:\.\d+)?|บาท/g, '').trim() || 'ค่าใช้จ่าย';
      return { description, amount };
    },
  },
  {
    tool: 'create_income',
    patterns: [
      /บันทึก.*รายรับ/i,
      /ค่าซ่อม|ค่าบริการ|ค่าติดตั้ง|ค่าแรง/i,
      /รับเงิน|ได้เงิน/i,
      /รายรับ/i,
    ],
    extractParams: (text: string) => {
      const amountMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:บาท)?/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
      const description = text.replace(/บันทึก|รายรับ|\d+(?:,\d{3})*(?:\.\d+)?|บาท/g, '').trim() || 'รายรับอื่นๆ';
      return { description, amount };
    },
  },
  {
    tool: 'create_product',
    patterns: [
      /เพิ่มสินค้า/i,
      /สร้างสินค้า/i,
      /ลงสินค้า/i,
      /สินค้าใหม่/i,
    ],
    extractParams: (text: string) => {
      const priceMatch = text.match(/ราคา\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 100;
      const nameMatch = text.match(/(?:เพิ่มสินค้า|สร้างสินค้า|ลงสินค้า|สินค้าใหม่)\s*([^\d]+?)(?:\s*ราคา|$)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'สินค้าใหม่';
      return { name, price };
    },
  },
  {
    tool: 'check_stock',
    patterns: [
      /เช็คสต็อก|ดูสต็อก/i,
      /สต็อก.*เหลือ|เหลือเท่าไหร่|เหลือกี่/i,
      /มีกี่ชิ้น|มีกี่อัน/i,
      /ค้นหาสินค้า/i,
    ],
    extractParams: (text: string) => {
      const productName = text
        .replace(/เช็คสต็อก|ดูสต็อก|สต็อก|เหลือเท่าไหร่|เหลือกี่ชิ้น|มีกี่ชิ้น|มีกี่อัน|ค้นหาสินค้า/gi, '')
        .trim() || 'สินค้า';
      return { productName };
    },
  },
  {
    tool: 'generate_report',
    patterns: [
      /สรุป/i,
      /รายงาน/i,
      /ยอดขาย/i,
      /กำไร/i,
      /ผลประกอบการ/i,
    ],
    extractParams: (text: string) => {
      let period: 'today' | 'week' | 'month' = 'today';
      if (/เดือน/i.test(text)) period = 'month';
      else if (/สัปดาห์/i.test(text)) period = 'week';
      return { period };
    },
  },
];

// Function to detect tool from user message (fallback)
export function detectToolFromMessage(message: string): { tool: string; params: Record<string, any> } | null {
  for (const pattern of TOOL_KEYWORD_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(message)) {
        return {
          tool: pattern.tool,
          params: pattern.extractParams(message),
        };
      }
    }
  }
  return null;
}
