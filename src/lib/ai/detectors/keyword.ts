// Keyword patterns for fallback matching
// Pure detector logic separated from the AI client.

export const TOOL_KEYWORD_PATTERNS = [
    {
        tool: 'create_expense',
        patterns: [
            /บันทึก.*ค่า/i,
            /ค่าไฟ|ค่าน้ำ|ค่าเช่า|ค่าจ้าง|ค่าขนส่ง|เงินเดือน|ค่าโฆษณา/i,
            /จ่าย.*บาท/i,
            /รายจ่าย/i,
            /ค่าใช้จ่าย/i,
            /หักค่า/i,
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

/**
 * Detect tool from user message (fallback when LLM tools fail or for fast detection)
 */
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
