import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';

export const DashboardStuckDocsQuery = {
  async getStaleDocuments(ctx: RequestContext) {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 3);

    const [staleSales, stalePurchases] = await Promise.all([
      db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          status: { in: ['DRAFT', 'CONFIRMED'] },
          createdAt: { lt: limitDate }
        },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50
      }),
      db.purchase.findMany({
        where: {
          shopId: ctx.shopId,
          status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'] },
          createdAt: { lt: limitDate }
        },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50
      })
    ]);

    return {
      sales: staleSales.map(s => ({
        id: s.id,
        number: s.invoiceNumber,
        date: s.date,
        createdAt: s.createdAt,
        status: s.status,
        partner: s.customer?.name || s.customerName || 'ลูกค้าทั่วไป',
        amount: Number(s.netAmount),
        type: 'SALE'
      })),
      purchases: stalePurchases.map(p => ({
        id: p.id,
        number: p.purchaseNumber,
        date: p.date,
        createdAt: p.createdAt,
        status: p.status,
        partner: p.supplier?.name || 'ไม่ระบุผู้ขาย',
        amount: Number(p.totalCost),
        type: p.docType === 'REQUEST' ? 'PR' : 'PO'
      }))
    };
  }
};
