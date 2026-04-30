import { db } from '@/lib/db';
import type { RequestContext } from '@/types/domain';

export const CustomerCreditEngine = {
  async checkCreditLimit(customerId: string, amount: number, ctx: RequestContext, tx?: any) {
    const prisma = tx || db;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { creditLimit: true }
    });

    if (!customer || !customer.creditLimit || Number(customer.creditLimit) <= 0) return {
      creditLimit: 0,
      currentOutstanding: 0,
      availableCredit: 0,
      isWithinLimit: true
    };

    const sales = await prisma.sale.findMany({
      where: { customerId, shopId: ctx.shopId, status: 'ACTIVE' },
      select: { netAmount: true }
    });

    const currentExposure = sales.reduce((sum: any, sale: any) => sum + Number(sale.netAmount), 0);
    
    return {
      creditLimit: Number(customer.creditLimit),
      currentOutstanding: currentExposure,
      availableCredit: Number(customer.creditLimit) - currentExposure,
      isWithinLimit: currentExposure + amount <= Number(customer.creditLimit)
    };
  }
};
