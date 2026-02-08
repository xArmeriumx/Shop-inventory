'use server';

import { db } from '@/lib/db';
import { requireShop } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';

/**
 * Get shop context data for AI
 * This provides relevant data for the AI to answer questions
 */
export async function getShopContextForAI() {
  // All shop members can use AI
  const ctx = await requireShop();
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    // Fetch data in parallel
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
      // Shop info - no assertion needed
      db.shop.findUnique({ where: { id: ctx.shopId } }),
      
      // Today's sales
      db.sale.aggregate({
        where: { shopId: ctx.shopId, createdAt: { gte: startOfToday } },
        _sum: { netAmount: true, profit: true },  // ✅ Revenue = เงินที่ได้รับจริง
        _count: true,
      }),
      
      // This month's sales
      db.sale.aggregate({
        where: { shopId: ctx.shopId, createdAt: { gte: startOfMonth } },
        _sum: { netAmount: true, profit: true },  // ✅ ใช้ netAmount
        _count: true,
      }),
      
      // Product count
      db.product.count({
        where: { shopId: ctx.shopId, deletedAt: null, isActive: true },
      }),
      
      // Low stock products
      db.product.findMany({
        where: { shopId: ctx.shopId, isLowStock: true, deletedAt: null },
        select: { name: true, stock: true, minStock: true },
        take: 5,
      }),
      
      // Top selling products this month
      db.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: { shopId: ctx.shopId, createdAt: { gte: startOfMonth } },
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      
      // This month's expenses
      db.expense.aggregate({
        where: { shopId: ctx.shopId, date: { gte: startOfMonth }, deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
      
      // This month's other incomes
      (db as any).income.aggregate({
        where: { shopId: ctx.shopId, date: { gte: startOfMonth }, deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
      
      // Recent 5 sales
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

    // Get product names for top products
    const topProductIds = topProducts.map(p => p.productId);
    const topProductDetails = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    });
    const productNameMap = new Map(topProductDetails.map(p => [p.id, p.name]));

    // Format top products as string
    const topProductsStr = topProducts
      .map((p, i) => {
        const name = productNameMap.get(p.productId) || 'ไม่ทราบ';
        const qty = p._sum.quantity || 0;
        const amount = Number(p._sum.subtotal || 0).toLocaleString();
        return `${i + 1}. ${name}: ${qty} ชิ้น (฿${amount})`;
      })
      .join('\n');

    // Format low stock products
    const lowStockStr = lowStockProducts
      .map(p => `  - ${p.name}: เหลือ ${p.stock} (ขั้นต่ำ ${p.minStock})`)
      .join('\n');

    // Format recent sales
    const recentSalesStr = recentSales
      .map(s => {
        const amount = Number(s.totalAmount).toLocaleString();
        const items = s._count.items;
        const time = new Date(s.createdAt).toLocaleTimeString('th-TH');
        return `- ฿${amount} (${items} ชิ้น) - ${s.paymentMethod} - ${time}`;
      })
      .join('\n');

    // Format context
    const context = `
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

    return context;
  } catch (error) {
    await logger.error('Error getting shop context for AI', error as Error, { path: 'getShopContextForAI' });
    return `## ข้อมูลร้าน
เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง`;
  }
}
