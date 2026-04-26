import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { CUSTOMER_TAGS } from '@/config/cache-tags';
import { paginatedQuery } from '@/lib/pagination';
import { AuditService } from '@/services/core/system/audit.service';
import { CUSTOMER_AUDIT_POLICIES } from '@/policies/sales/customer.policy';
import { CustomerInput } from '@/schemas/sales/customer.schema';
import type { 
  SerializedCustomer, 
  RequestContext, 
  SerializedPartnerAddress, 
  MutationResult, 
  GetCustomersParams, 
  PaginatedResult,
  ServiceError as DomainServiceError
} from '@/types/domain';
import { ICustomerService } from '@/types/service-contracts';

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const CustomerService: ICustomerService = {
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

    // region and groupCode come from GetCustomersParams if defined there
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

    // Calculate totalVolume and clean up sales relation
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

  async create(ctx: RequestContext, data: CustomerInput): Promise<MutationResult<SerializedCustomer>> {
    const result = await AuditService.runWithAudit(
      ctx,
      CUSTOMER_AUDIT_POLICIES.CREATE(data.name),
      async () => {
        const { partnerAddresses, ...customerData } = data as any;

        const customer = await db.$transaction(async (tx) => {
          const c = await (tx as any).customer.create({
            data: {
              ...customerData,
              userId: ctx.userId,
              shopId: ctx.shopId,
            } as Prisma.CustomerUncheckedCreateInput,
          });

          if (partnerAddresses && partnerAddresses.length > 0) {
            for (const addr of partnerAddresses) {
              const { contacts, ...addrData } = addr;
              await (tx as any).partnerAddress.create({
                data: {
                  ...addrData,
                  customerId: c.id,
                  shopId: ctx.shopId,
                  contacts: {
                    create: contacts?.map((con: any) => ({
                      ...con,
                      shopId: ctx.shopId,
                    })),
                  },
                },
              });
            }
          }

          return c;
        });

        return customer as any;
      }
    );

    return {
      data: result,
      affectedTags: [CUSTOMER_TAGS.LIST]
    };
  },

  async update(id: string, ctx: RequestContext, data: CustomerInput): Promise<MutationResult<SerializedCustomer>> {
    const existing = await this.getById(id, ctx);
    if (!existing) throw new ServiceError('ไม่พบข้อมูลลูกค้า');

    const result = await AuditService.runWithAudit(
      ctx,
      {
        ...CUSTOMER_AUDIT_POLICIES.UPDATE(id, existing.name),
        beforeSnapshot: () => existing,
        afterSnapshot: () => this.getById(id, ctx),
      },
      async () => {
        const { partnerAddresses, ...customerData } = data as any;

        const customer = await db.$transaction(async (tx) => {
          const c = await tx.customer.update({
            where: { id },
            data: customerData,
          });

          if (partnerAddresses) {
            const existingAddressIds = (existing as any).partnerAddresses.map((a: any) => a.id);
            const incomingAddressIds = partnerAddresses.filter((a: any) => a.id).map((a: any) => a.id as string);

            const removedAddressIds = existingAddressIds.filter((id: string) => !incomingAddressIds.includes(id));
            if (removedAddressIds.length > 0) {
              await (tx as any).partnerAddress.updateMany({
                where: { id: { in: removedAddressIds } },
                data: { deletedAt: new Date() },
              });
            }

            for (const addr of partnerAddresses) {
              const { id: addrId, contacts, ...addrData } = addr;
              if (addrId && existingAddressIds.includes(addrId)) {
                await (tx as any).partnerAddress.update({
                  where: { id: addrId },
                  data: addrData,
                });

                const existingAddr = (existing as any).partnerAddresses.find((a: any) => a.id === addrId);
                const existingContactIds = existingAddr?.contacts.map((c: any) => c.id) || [];
                const incomingContactIds = contacts?.filter((c: any) => c.id).map((c: any) => c.id as string) || [];

                const removedContactIds = existingContactIds.filter((id: string) => !incomingContactIds.includes(id));
                if (removedContactIds.length > 0) {
                  await (tx as any).partnerContact.updateMany({
                    where: { id: { in: removedContactIds } },
                    data: { deletedAt: new Date() },
                  });
                }

                if (contacts) {
                  for (const contact of contacts) {
                    const { id: contactId, ...contactData } = contact;
                    if (contactId && existingContactIds.includes(contactId)) {
                      await (tx as any).partnerContact.update({
                        where: { id: contactId },
                        data: contactData,
                      });
                    } else {
                      await (tx as any).partnerContact.create({
                        data: {
                          ...contactData,
                          partnerAddressId: addrId,
                          shopId: ctx.shopId,
                        },
                      });
                    }
                  }
                }
              } else {
                await (tx as any).partnerAddress.create({
                  data: {
                    ...addrData,
                    customerId: id,
                    shopId: ctx.shopId,
                    contacts: {
                      create: contacts?.map((con: any) => ({
                        ...con,
                        shopId: ctx.shopId,
                      })),
                    },
                  },
                });
              }
            }
          }
          return c;
        });

        return customer as any;
      }
    );

    return {
      data: result,
      affectedTags: [CUSTOMER_TAGS.LIST, CUSTOMER_TAGS.DETAIL(id)]
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
  },

  async delete(id: string, ctx: RequestContext): Promise<MutationResult<{ message: string; type: 'delete' | 'archive' }>> {
    const existing = await this.getById(id, ctx);
    if (!existing) throw new ServiceError('ไม่พบข้อมูลลูกค้า');

    const impact = await this.getDeletionImpact(id, ctx);

    const result = await AuditService.runWithAudit(
      ctx,
      CUSTOMER_AUDIT_POLICIES.DELETE(id, existing.name),
      async () => {
        if (impact.canHardDelete) {
          await db.customer.delete({ where: { id } });
          return { message: 'ลบข้อมูลลูกค้าถาวรสำเร็จ', type: 'delete' as const };
        } else {
          await db.customer.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
          return { message: 'ปิดใช้งานลูกค้าสำเร็จ (เนื่องจากมีรายการธุรการค้างอยู่)', type: 'archive' as const };
        }
      }
    );

    return {
      data: result,
      affectedTags: [CUSTOMER_TAGS.LIST, CUSTOMER_TAGS.DETAIL(id)]
    };
  },

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
  },

  // Address-specific actions (Simplified for ERP UI)
  async getAddresses(customerId: string, ctx: RequestContext): Promise<SerializedPartnerAddress[]> {
    const addresses = await (db as any).partnerAddress.findMany({
      where: { customerId, shopId: ctx.shopId, deletedAt: null },
      include: { contacts: { where: { deletedAt: null } } },
    });
    return addresses as any[];
  },

  async getAddressById(id: string, ctx: RequestContext): Promise<any> {
    return (db as any).partnerAddress.findFirst({
        where: { id, shopId: ctx.shopId, deletedAt: null },
        include: { contacts: { where: { deletedAt: null } } },
      });
  },

  async createAddress(customerId: string, ctx: RequestContext, data: any): Promise<MutationResult<SerializedPartnerAddress>> {
    const { contacts, ...addrData } = data;
    const addr = await (db as any).partnerAddress.create({
      data: {
        ...addrData,
        customerId,
        shopId: ctx.shopId,
        contacts: {
          create: contacts?.map((c: any) => ({
            ...c,
            shopId: ctx.shopId,
          })),
        },
      },
      include: { contacts: true },
    });

    return {
      data: addr as any,
      affectedTags: [CUSTOMER_TAGS.DETAIL(customerId)]
    };
  },

  async updateAddress(id: string, ctx: RequestContext, data: any): Promise<MutationResult<void>> {
    const addr = await (db as any).partnerAddress.findUnique({ where: { id }, select: { customerId: true } });
    
    await (db as any).partnerAddress.update({
      where: { id },
      data,
    });

    return {
      data: undefined,
      affectedTags: addr ? [CUSTOMER_TAGS.DETAIL(addr.customerId)] : []
    };
  },

  async deleteAddress(id: string, ctx: RequestContext): Promise<MutationResult<void>> {
    const addr = await (db as any).partnerAddress.findUnique({ where: { id }, select: { customerId: true } });
    
    await (db as any).partnerAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return {
      data: undefined,
      affectedTags: addr ? [CUSTOMER_TAGS.DETAIL(addr.customerId)] : []
    };
  },

  async batchCreate(inputs: any[], ctx: RequestContext): Promise<MutationResult<any>> {
    // Implementation for batch create...
    return {
        data: { success: true },
        affectedTags: [CUSTOMER_TAGS.LIST]
    };
  },

  async getSalespersonsByRegion(region: string, ctx: RequestContext): Promise<any[]> {
    return [];
  }
};
