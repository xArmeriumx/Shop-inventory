import { db } from '@/lib/db';
import { supplierSchema, type SupplierInput } from '@/schemas/supplier';
import { partnerAddressSchema } from '@/schemas/partner-common';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { AuditService } from '@/services/core/audit.service';
import { Security } from '@/services/core/security.service';
import { SUPPLIER_AUDIT_POLICIES } from '@/services/inventory/supplier.policy';
import type { SerializedSupplier, RequestContext, ActionResponse } from '@/types/domain';

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const SupplierService = {
  async getAll(ctx: RequestContext, params: { page?: number; limit?: number; search?: string; groupCode?: string }) {
    const where: any = {
      shopId: ctx.shopId,
      deletedAt: null,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
        { taxId: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.groupCode) where.groupCode = params.groupCode;

    return paginatedQuery(db.supplier as any, {
      where,
      orderBy: { name: 'asc' },
      include: {
        partnerAddresses: {
          where: { isDefaultBilling: true, deletedAt: null },
          take: 1,
        },
      },
      page: params.page,
      limit: params.limit,
    });
  },

  async getForSelect(ctx: RequestContext) {
    return (db as any).supplier.findMany({
      where: { shopId: ctx.shopId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  },

  async getById(id: string, ctx: RequestContext): Promise<SerializedSupplier | null> {
    const supplier = await db.supplier.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: {
        partnerAddresses: {
          where: { deletedAt: null },
          include: { contacts: { where: { deletedAt: null } } },
        },
      },
    });

    return supplier as SerializedSupplier | null;
  },

  async getProfile(id: string, ctx: RequestContext) {
    const supplier = await this.getById(id, ctx);
    if (!supplier) return null;

    return {
      supplier: supplier as any,
      purchases: [],
      stats: { totalSpend: 0, orderCount: 0, avgOrderValue: 0, lastPurchaseDate: null, avgDaysBetweenOrders: 0 },
      topProducts: [],
    };
  },

  async create(ctx: RequestContext, data: SupplierInput): Promise<SerializedSupplier> {
    return AuditService.runWithAudit(
      ctx,
      SUPPLIER_AUDIT_POLICIES.CREATE(data.name),
      async () => {
        const { partnerAddresses, ...supplierData } = data as any;

        const supplier = await db.$transaction(async (tx) => {
          const s = await tx.supplier.create({
            data: {
              ...supplierData,
              userId: ctx.userId,
              shopId: ctx.shopId,
            } as Prisma.SupplierUncheckedCreateInput,
          });

          if (partnerAddresses && partnerAddresses.length > 0) {
            for (const addr of partnerAddresses) {
              const { contacts, ...addrData } = addr;
              await (tx as any).partnerAddress.create({
                data: {
                  ...addrData,
                  supplierId: s.id,
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

          return s;
        });

        return supplier as any;
      }
    );
  },

  async update(id: string, ctx: RequestContext, data: SupplierInput): Promise<SerializedSupplier> {
    const existing = await this.getById(id, ctx);
    if (!existing) throw new ServiceError('ไม่พบข้อมูลผู้จำหน่าย');

    return AuditService.runWithAudit(
      ctx,
      {
        ...SUPPLIER_AUDIT_POLICIES.UPDATE(id, existing.name),
        beforeSnapshot: () => existing,
        afterSnapshot: () => this.getById(id, ctx),
      },
      async () => {
        const { partnerAddresses, ...supplierData } = data as any;

        const supplier = await db.$transaction(async (tx) => {
          const s = await tx.supplier.update({
            where: { id },
            data: supplierData,
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
                    supplierId: id,
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
          return s;
        });

        return supplier as any;
      }
    );
  },

  async delete(id: string, ctx: RequestContext): Promise<ActionResponse> {
    const existing = await this.getById(id, ctx);
    if (!existing) return { success: false, message: 'ไม่พบข้อมูลผู้จำหน่าย' };

    await AuditService.runWithAudit(
      ctx,
      SUPPLIER_AUDIT_POLICIES.DELETE(id, existing.name),
      async () => {
        await db.supplier.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      }
    );

    return { success: true, message: 'ลบข้อมูลผู้จำหน่ายสำเร็จ' };
  },
};
