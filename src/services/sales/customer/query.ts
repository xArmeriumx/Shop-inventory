import { db } from '@/lib/db';
import { paginatedQuery } from '@/lib/pagination';
import type { 
  SerializedCustomer, 
  RequestContext, 
  GetCustomersParams, 
  PaginatedResult
} from '@/types/domain';

export const CustomerQuery = {
  async getList(params: GetCustomersParams, ctx: RequestContext): Promise<PaginatedResult<SerializedCustomer>> {
    const where: any = {
      shopId: ctx.shopId,
      deletedAt: null,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if ((params as any).region) where.partnerAddresses = { some: { region: (params as any).region, deletedAt: null } };
    if ((params as any).groupCode) where.groupCode = (params as any).groupCode;

    const result = await paginatedQuery(db.customer as any, {
      where,
      orderBy: { name: 'asc' },
      include: {
        partnerAddresses: {
          where: { isDefaultBilling: true, deletedAt: null },
          take: 1,
        },
        sales: {
          where: { status: { not: 'CANCELLED' } },
          select: { netAmount: true },
        },
        _count: {
          select: { sales: true },
        },
      },
      page: params.page,
      limit: params.limit,
    });

    result.data = (result.data as any[]).map((c) => {
      const totalVolume = c.sales?.reduce((sum: number, s: any) => sum + Number(s.netAmount || 0), 0) || 0;
      const { sales, ...customer } = c;
      return {
        ...customer,
        totalVolume,
      };
    });

    return result as any;
  },

  async getForSelect(ctx: RequestContext) {
    return (db as any).customer.findMany({
      where: { shopId: ctx.shopId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  },

  async getById(id: string, ctx: RequestContext): Promise<SerializedCustomer | null> {
    const customer = await db.customer.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: {
        partnerAddresses: {
          where: { deletedAt: null },
          include: { contacts: { where: { deletedAt: null } } },
        },
      },
    });

    return customer as any;
  },

  async getProfile(id: string, ctx: RequestContext) {
    const customer = await this.getById(id, ctx);
    if (!customer) return null;

    return {
      customer: customer as any,
      sales: [],
      addresses: (customer as any).partnerAddresses || [],
      shipments: [],
      stats: { totalSpent: 0, totalOrders: 0, totalProfit: 0, totalShipments: 0, deliveryRate: 0, totalShippingCost: 0, providerBreakdown: {}, firstOrderDate: null },
      topProducts: [],
    };
  },

  async getDeletionImpact(id: string, ctx: RequestContext) {
    const counts = await db.$transaction([
      db.sale.count({ where: { customerId: id, shopId: ctx.shopId, status: { not: 'CANCELLED' } } }),
      db.invoice.count({ where: { customerId: id, shopId: ctx.shopId, status: { not: 'CANCELLED' } } }),
      db.quotation.count({ where: { customerId: id, shopId: ctx.shopId, status: { not: 'CANCELLED' } } }),
    ]);

    const totalTransactions = counts.reduce((a, b) => a + b, 0);
    return {
      canHardDelete: totalTransactions === 0,
      transactionCount: totalTransactions,
      impacts: [
        { label: 'บิลขาย', count: counts[0] },
        { label: 'ใบกำกับภาษี', count: counts[1] },
        { label: 'ใบเสนอราคา', count: counts[2] },
      ].filter(i => i.count > 0),
    };
  }
};
