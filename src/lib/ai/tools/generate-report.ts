// Tool: Generate Report - สรุปรายงาน (Read-only, no confirmation needed)

import { db } from '@/lib/db';
import { AITool, ToolResult, ToolContext } from './types';

export const generateReportTool: AITool = {
  definition: {
    name: 'generate_report',
    description: 'สร้างรายงานสรุปยอดขาย กำไร ค่าใช้จ่าย | Keywords: สรุป, รายงาน, ยอดขาย, กำไร, ผลประกอบการ | Periods: วันนี้(today), สัปดาห์นี้(week), เดือนนี้(month) | ตัวอย่าง: "สรุปยอดขายวันนี้", "รายงานเดือนนี้"',
    parameters: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          description: 'ประเภทรายงาน',
          enum: ['sales', 'profit', 'expenses', 'top_products', 'summary'],
        },
        period: {
          type: 'string',
          description: 'ช่วงเวลา',
          enum: ['today', 'week', 'month'],
        },
      },
      required: ['period'],
    },
  },

  async execute(params, context): Promise<ToolResult> {
    const { period } = params;

    try {
      const now = new Date();
      let startDate: Date;
      let periodName: string;

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          periodName = 'วันนี้';
          break;
        case 'week':
          const dayOfWeek = now.getDay();
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          periodName = 'สัปดาห์นี้';
          break;
        case 'month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          periodName = 'เดือนนี้';
      }

      // Fetch data in parallel
      const [salesData, expenseData, incomeData, topProducts] = await Promise.all([
        // Sales summary
        db.sale.aggregate({
          where: { shopId: context.shopId, createdAt: { gte: startDate } },
          _sum: { totalAmount: true, profit: true },
          _count: true,
        }),
        // Expenses
        db.expense.aggregate({
          where: { shopId: context.shopId, date: { gte: startDate }, deletedAt: null },
          _sum: { amount: true },
          _count: true,
        }),
        // Other incomes
        (db as any).income.aggregate({
          where: { shopId: context.shopId, date: { gte: startDate }, deletedAt: null },
          _sum: { amount: true },
          _count: true,
        }),
        // Top products
        db.saleItem.groupBy({
          by: ['productId'],
          where: {
            sale: { shopId: context.shopId, createdAt: { gte: startDate } },
          },
          _sum: { quantity: true, subtotal: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),
      ]);

      // Get product names
      const productIds = topProducts.map(p => p.productId);
      const productNames = await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(productNames.map(p => [p.id, p.name]));

      // Calculate
      const totalSales = Number(salesData._sum.totalAmount || 0);
      const totalProfit = Number(salesData._sum.profit || 0);
      const totalExpenses = Number(expenseData._sum.amount || 0);
      const totalIncome = Number(incomeData._sum.amount || 0);
      const netProfit = totalProfit - totalExpenses + totalIncome;

      // Format top products with proper types
      const topProductsStr = topProducts.length > 0
        ? topProducts.map((p: { productId: string; _sum: { quantity: number | null; subtotal: unknown } }, i: number) => {
            const name = nameMap.get(p.productId) || 'ไม่ทราบ';
            return `${i + 1}. ${name}: ${p._sum.quantity} ชิ้น (฿${Number(p._sum.subtotal || 0).toLocaleString()})`;
          }).join('\n')
        : '(ยังไม่มีข้อมูล)';

      const report = `
📊 **รายงานสรุป${periodName}**

💵 **ยอดขาย**
• จำนวนบิล: ${salesData._count} บิล
• ยอดขายรวม: ฿${totalSales.toLocaleString()}
• กำไรจากการขาย: ฿${totalProfit.toLocaleString()}

💰 **รายรับ-รายจ่าย**
• ➕ รายได้อื่นๆ: +฿${totalIncome.toLocaleString()} (${incomeData._count} รายการ)
• ➖ ค่าใช้จ่าย: -฿${totalExpenses.toLocaleString()} (${expenseData._count} รายการ)

📈 **สรุปกำไร**
• กำไรจากการขาย: ฿${totalProfit.toLocaleString()}
• + รายได้อื่นๆ: ฿${totalIncome.toLocaleString()}
• - ค่าใช้จ่าย: ฿${totalExpenses.toLocaleString()}
• **กำไรสุทธิ: ฿${netProfit.toLocaleString()}**

🏆 **สินค้าขายดี Top 5**
${topProductsStr}
`;

      return {
        success: true,
        message: report,
        data: { totalSales, totalProfit, totalExpenses, netProfit },
      };
    } catch (error) {
      console.error('Generate report error:', error);
      return {
        success: false,
        message: '❌ เกิดข้อผิดพลาดในการสร้างรายงาน',
      };
    }
  },
};
