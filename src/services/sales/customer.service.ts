import { db } from '@/lib/db';
import { customerSchema, type CustomerInput } from '@/schemas/sales/customer.schema';
import { partnerAddressSchema } from '@/schemas/core/partner-common.schema';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { AuditService } from '@/services/core/system/audit.service';
import { CUSTOMER_AUDIT_POLICIES } from '@/policies/sales/customer.policy';
import type { SerializedCustomer, RequestContext, SerializedPartnerAddress, ActionResponse } from '@/types/domain';

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const CustomerService = {
  async getAll(ctx: RequestContext, params: { page?: number; limit?: number; search?: string; region?: string; groupCode?: string }) {
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

    if (params.region) where.partnerAddresses = { some: { region: params.region, deletedAt: null } };
    if (params.groupCode) where.groupCode = params.groupCode;

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

    return result;
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
      stats: { totalSpend: 0, orderCount: 0, avgOrderValue: 0, lastSaleDate: null },
      topProducts: [],
    };
  },

  async create(ctx: RequestContext, data: CustomerInput): Promise<SerializedCustomer> {
    return AuditService.runWithAudit(
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
  },

  async update(id: string, ctx: RequestContext, data: CustomerInput): Promise<SerializedCustomer> {
    const existing = await this.getById(id, ctx);
    if (!existing) throw new ServiceError('ไม่พบข้อมูลลูกค้า');

    return AuditService.runWithAudit(
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
  },

  async delete(id: string, ctx: RequestContext): Promise<ActionResponse<null>> {
    const existing = await this.getById(id, ctx);
    if (!existing) return { success: false, message: 'ไม่พบข้อมูลลูกค้า' };

    await AuditService.runWithAudit(
      ctx,
      CUSTOMER_AUDIT_POLICIES.DELETE(id, existing.name),
      async () => {
        await db.customer.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      }
    );

    return { success: true, message: 'ลบข้อมูลลูกค้าสำเร็จ', data: null };
  },

  async checkCreditLimit(customerId: string, amount: number, ctx: RequestContext, tx?: any) {
    const prisma = tx || db;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { creditLimit: true }
    });

    if (!customer || !customer.creditLimit || Number(customer.creditLimit) <= 0) return true;

    const sales = await prisma.sale.findMany({
      where: { customerId, shopId: ctx.shopId, status: 'ACTIVE' },
      select: { netAmount: true }
    });

    const currentExposure = sales.reduce((sum: any, sale: any) => sum + Number(sale.netAmount), 0);
    if (currentExposure + amount > Number(customer.creditLimit)) {
      throw new ServiceError(`วงเงินเครดิตไม่เพียงพอ (วงเงิน: ${customer.creditLimit}, ใช้ไปแล้ว: ${currentExposure}, ต้องการใช้เพิ่ม: ${amount})`);
    }

    return true;
  },

  // Address-specific actions (Simplified for ERP UI)
  async getAddresses(customerId: string, ctx: RequestContext): Promise<SerializedPartnerAddress[]> {
    const addresses = await (db as any).partnerAddress.findMany({
      where: { customerId, shopId: ctx.shopId, deletedAt: null },
      include: { contacts: { where: { deletedAt: null } } },
    });
    return addresses as any[];
  },

  async createAddress(customerId: string, ctx: RequestContext, data: any): Promise<SerializedPartnerAddress> {
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
    return addr as any;
  },

  async updateAddress(id: string, ctx: RequestContext, data: any): Promise<void> {
    await (db as any).partnerAddress.update({
      where: { id },
      data,
    });
  },

  async deleteAddress(id: string, ctx: RequestContext): Promise<void> {
    await (db as any).partnerAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
