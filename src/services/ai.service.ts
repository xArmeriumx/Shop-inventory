import { db } from '@/lib/db';
import { RequestContext } from './product.service';

export const AiService = {
  async getShopContextForAI(ctx: RequestContext) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      shop,
      todaySales,
      monthSales,
      productCount,
      lowStockProducts,
      topProducts,
      monthExpenses,
      monthIncomes,
      recentSales,
    ] = await Promise.all([
      db.shop.findUnique({ where: { id: ctx.shopId } }),
      db.sale.aggregate({
        where: { shopId: ctx.shopId, createdAt: { gte: startOfToday } },
        _sum: { netAmount: true, profit: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { shopId: ctx.shopId, createdAt: { gte: startOfMonth } },
        _sum: { netAmount: true, profit: true },
        _count: true,
      }),
      db.product.count({
        where: { shopId: ctx.shopId, deletedAt: null, isActive: true },
      }),
      db.product.findMany({
        where: { shopId: ctx.shopId, isLowStock: true, deletedAt: null },
        select: { name: true, stock: true, minStock: true },
        take: 5,
      }),
      db.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: { shopId: ctx.shopId, createdAt: { gte: startOfMonth } },
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      db.expense.aggregate({
        where: { shopId: ctx.shopId, date: { gte: startOfMonth }, deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
      (db as any).income.aggregate({
        where: { shopId: ctx.shopId, date: { gte: startOfMonth }, deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
      db.sale.findMany({
        where: { shopId: ctx.shopId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          totalAmount: true,
          profit: true,
          paymentMethod: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    const topProductIds = topProducts.map(p => p.productId);
    const topProductDetails = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    });
    const productNameMap = new Map(topProductDetails.map(p => [p.id, p.name]));

    const topProductsStr = topProducts
      .map((p, i) => {
        const name = productNameMap.get(p.productId) || 'ไม่ทราบ';
        const qty = p._sum.quantity || 0;
        const amount = Number(p._sum.subtotal || 0).toLocaleString();
        return `${i + 1}. ${name}: ${qty} ชิ้น (฿${amount})`;
      })
      .join('\n');

    const lowStockStr = lowStockProducts
      .map(p => `  - ${p.name}: เหลือ ${p.stock} (ขั้นต่ำ ${p.minStock})`)
      .join('\n');

    const recentSalesStr = recentSales
      .map(s => {
        const amount = Number(s.totalAmount).toLocaleString();
        const items = s._count.items;
        const time = new Date(s.createdAt).toLocaleTimeString('th-TH');
        return `- ฿${amount} (${items} ชิ้น) - ${s.paymentMethod} - ${time}`;
      })
      .join('\n');

    return `
## ข้อมูลร้าน: ${shop?.name || 'ไม่ระบุ'}
วันที่: ${now.toLocaleDateString('th-TH', { dateStyle: 'full' })}

## ยอดขายวันนี้
- จำนวนบิล: ${todaySales._count} บิล
- ยอดขาย: ฿${Number(todaySales._sum.netAmount || 0).toLocaleString()}
- กำไร: ฿${Number(todaySales._sum.profit || 0).toLocaleString()}

## ยอดขายเดือนนี้
- จำนวนบิล: ${monthSales._count} บิล
- ยอดขาย: ฿${Number(monthSales._sum.netAmount || 0).toLocaleString()}
- กำไร: ฿${Number(monthSales._sum.profit || 0).toLocaleString()}

## สินค้า
- จำนวนสินค้าทั้งหมด: ${productCount} รายการ
- สินค้าใกล้หมด: ${lowStockProducts.length} รายการ
${lowStockStr}

## สินค้าขายดีเดือนนี้ (Top 5)
${topProductsStr || '(ยังไม่มีข้อมูล)'}

## ค่าใช้จ่ายเดือนนี้
- จำนวน: ${monthExpenses._count} รายการ
- รวม: ฿${Number(monthExpenses._sum.amount || 0).toLocaleString()}

## รายได้อื่นๆ เดือนนี้ (ค่าซ่อม, ค่าบริการ, etc.)
- จำนวน: ${monthIncomes._count} รายการ
- รวม: +฿${Number(monthIncomes._sum.amount || 0).toLocaleString()}

## สรุปกำไรสุทธิเดือนนี้
- กำไรจากการขาย: ฿${Number(monthSales._sum.profit || 0).toLocaleString()}
- + รายได้อื่นๆ: ฿${Number(monthIncomes._sum.amount || 0).toLocaleString()}
- - ค่าใช้จ่าย: ฿${Number(monthExpenses._sum.amount || 0).toLocaleString()}
- **กำไรสุทธิ: ฿${(Number(monthSales._sum.profit || 0) + Number(monthIncomes._sum.amount || 0) - Number(monthExpenses._sum.amount || 0)).toLocaleString()}**

## การขายล่าสุด 5 รายการ
${recentSalesStr || '(ยังไม่มีข้อมูล)'}
`;
  }
};
