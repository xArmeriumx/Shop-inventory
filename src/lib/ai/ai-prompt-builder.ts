import { AiShopContextData } from '@/services/ai.service';

/**
 * Pure function to build the system prompt context from structured shop data.
 * No side effects or database calls allowed here.
 */
export const AiPromptBuilder = {
    buildShopContextPrompt(data: AiShopContextData): string {
        const {
            shopName,
            todaySales,
            monthSales,
            productCount,
            lowStockItems,
            topProducts,
            monthExpenses,
            monthIncomes,
            recentSales,
        } = data;

        const lowStockStr = lowStockItems.length > 0
            ? lowStockItems.map(p => `  - ${p.name}: เหลือ ${p.stock} (ขั้นต่ำ ${p.minStock})`).join('\n')
            : '  - ไม่มีสินค้าใกล้หมด';

        const topProductsStr = topProducts.length > 0
            ? topProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.quantity} ชิ้น (฿${p.subtotal.toLocaleString()})`).join('\n')
            : '(ยังไม่มีข้อมูล)';

        const recentSalesStr = recentSales.length > 0
            ? recentSales.map(s => `- ฿${s.amount.toLocaleString()} (${s.items} ชิ้น) - ${s.paymentMethod} - ${s.time}`).join('\n')
            : '(ยังไม่มีข้อมูล)';

        const netProfit = monthSales.profit + monthIncomes.amount - monthExpenses.amount;

        return `
## ข้อมูลร้าน: ${shopName}
วันที่: ${new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}

## ยอดขายวันนี้
- จำนวนบิล: ${todaySales.count} บิล
- ยอดขาย: ฿${todaySales.amount.toLocaleString()}
- กำไร: ฿${todaySales.profit.toLocaleString()}

## ยอดขายเดือนนี้
- จำนวนบิล: ${monthSales.count} บิล
- ยอดขาย: ฿${monthSales.amount.toLocaleString()}
- กำไร: ฿${monthSales.profit.toLocaleString()}

## สินค้า
- จำนวนสินค้าทั้งหมด: ${productCount} รายการ
- สินค้าใกล้หมด: ${lowStockItems.length} รายการ
${lowStockStr}

## สินค้าขายดีเดือนนี้ (Top 5)
${topProductsStr}

## ค่าใช้จ่ายเดือนนี้
- จำนวน: ${monthExpenses.count} รายการ
- รวม: ฿${monthExpenses.amount.toLocaleString()}

## รายได้อื่นๆ เดือนนี้ (ค่าซ่อม, ค่าบริการ, etc.)
- จำนวน: ${monthIncomes.count} รายการ
- รวม: +฿${monthIncomes.amount.toLocaleString()}

## สรุปกำไรสุทธิเดือนนี้
- กำไรจากการขาย: ฿${monthSales.profit.toLocaleString()}
- + รายได้อื่นๆ: ฿${monthIncomes.amount.toLocaleString()}
- - ค่าใช้จ่าย: ฿${monthExpenses.amount.toLocaleString()}
- **กำไรสุทธิ: ฿${netProfit.toLocaleString()}**

## การขายล่าสุด 5 รายการ
${recentSalesStr}
`;
    }
};
