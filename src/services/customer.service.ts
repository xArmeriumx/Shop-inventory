import { db } from '@/lib/db';
// Types imported from @/types/domain
import { CustomerInput } from '@/schemas/customer';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { logger } from '@/lib/logger';
import type { Customer } from '@prisma/client';

import {
  RequestContext,
  ServiceError,
  GetCustomersParams,
  SerializedCustomer,
  PaginatedResult,
} from '@/types/domain';
import { AuditService } from './audit.service';
import { CUSTOMER_AUDIT_POLICIES } from './customer.policy';
import { ICustomerService } from '@/types/service-contracts';

export const CustomerService: ICustomerService = {
  async getList(params: GetCustomersParams = {}, ctx: RequestContext): Promise<PaginatedResult<SerializedCustomer>> {
    const { page = 1, limit = 20, search } = params;
    const searchFilter = buildSearchFilter(search, ['name', 'phone', 'address', 'email']);

    const where = {
      shopId: ctx.shopId,
      ...(searchFilter && searchFilter),
      deletedAt: null,
    };

    const result = await paginatedQuery<any>(db.customer, {
      where,
      include: {
        _count: {
          select: { sales: { where: { status: { not: 'CANCELLED' } } } },
        },
      },
      page,
      limit,
      orderBy: { name: 'asc' },
    });

    // Fetch volume (Accumulated Sales) for these specific customers
    const customerIds = result.data.map((c: any) => c.id);
    const volumeData = await db.sale.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        status: { not: 'CANCELLED' },
        shopId: ctx.shopId,
      },
      _sum: { netAmount: true },
    });

    const volumeMap = new Map(volumeData.map(v => [v.customerId, Number(v._sum.netAmount || 0)]));

    return {
      ...result,
      data: result.data.map((c: any) => ({
        ...c,
        creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
        totalVolume: volumeMap.get(c.id) || 0,
      })),
    };
  },

  async getById(id: string, ctx: RequestContext): Promise<SerializedCustomer> {
    const customer = await db.customer.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: {
        salesPersons: {
          select: {
            id: true,
            userId: true,
            departmentCode: true,
            user: { select: { name: true, email: true } }
          }
        }
      }
    });

    if (!customer) {
      throw new ServiceError('ไม่พบข้อมูลลูกค้า');
    }

    return {
      ...customer,
      creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
    };
  },

  async create(ctx: RequestContext, data: CustomerInput): Promise<SerializedCustomer> {
    return AuditService.runWithAudit(
      ctx,
      CUSTOMER_AUDIT_POLICIES.CREATE(data.name),
      async () => {
        // ERP UC 3: Auto-assign Salespersons by Region
        let assignedSalespersons: { id: string }[] = [];
        if (data.region) {
          const salesTeam = await this.getSalespersonsByRegion(data.region, ctx);
          assignedSalespersons = salesTeam.map(s => ({ id: s.id }));
        }

        const customer = await db.customer.create({
          data: {
            ...data,
            name: data.name,
            phone: data.phone || null,
            address: data.address || null,
            taxId: data.taxId || null,
            notes: data.notes || null,
            userId: ctx.userId,
            shopId: ctx.shopId,
            salesPersons: assignedSalespersons.length > 0 ? {
              connect: assignedSalespersons
            } : undefined,
          },
        });

        return {
          ...customer,
          creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
        };
      }
    );
  },

  async update(id: string, ctx: RequestContext, data: CustomerInput): Promise<SerializedCustomer> {
    const existing = await db.customer.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) {
      throw new ServiceError('ไม่พบข้อมูลลูกค้า หรือลูกค้าถูกลบไปแล้ว');
    }

    return AuditService.runWithAudit(
      ctx,
      {
        ...CUSTOMER_AUDIT_POLICIES.UPDATE(id, existing.name),
        beforeSnapshot: () => existing,
        afterSnapshot: () => db.customer.findFirst({ where: { id } }),
      },
      async () => {
        // ERP UC 3: Auto-update Salespersons if Region changed
        let salespersonUpdate: any = undefined;
        if (data.region && data.region !== existing.region) {
          const salesTeam = await this.getSalespersonsByRegion(data.region, ctx);
          salespersonUpdate = {
            set: salesTeam.map(s => ({ id: s.id }))
          };
        }

        const customer = await db.customer.update({
          where: { id },
          data: {
            ...data,
            name: data.name,
            phone: data.phone || null,
            address: data.address || null,
            taxId: data.taxId || null,
            notes: data.notes || null,
            salesPersons: salespersonUpdate,
          },
        });

        return {
          ...customer,
          creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
        };
      }
    );
  },

  async delete(id: string, ctx: RequestContext): Promise<void> {
    const existing = await db.customer.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) {
      throw new ServiceError('ไม่พบข้อมูลลูกค้า');
    }

    await AuditService.runWithAudit(
      ctx,
      {
        ...CUSTOMER_AUDIT_POLICIES.DELETE(id, existing.name),
        beforeSnapshot: () => existing,
      },
      async () => {
        await db.customer.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      }
    );
  },

  async getForSelect(ctx: RequestContext) {
    return db.customer.findMany({
      where: { shopId: ctx.shopId, deletedAt: null },
      select: { id: true, name: true, phone: true, address: true, taxId: true },
      orderBy: { name: 'asc' },
    });
  },

  async getProfile(id: string, ctx: RequestContext) {
    const customer = await db.customer.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: {
        addresses: {
          where: { deletedAt: null },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        sales: {
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            totalAmount: true,
            totalCost: true,
            profit: true,
            paymentMethod: true,
            status: true,
            items: { select: { quantity: true } },
            shipments: {
              select: {
                id: true,
                shipmentNumber: true,
                status: true,
                trackingNumber: true,
                shippingProvider: true,
                shippingCost: true,
                recipientName: true,
                shippingAddress: true,
                shippedAt: true,
                deliveredAt: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new ServiceError('ไม่พบข้อมูลลูกค้า');
    }

    const allShipments = customer.sales.flatMap((sale: any) =>
      sale.shipments.map((s: any) => ({
        ...s,
        shippingCost: s.shippingCost ? Number(s.shippingCost) : null,
        saleInvoice: sale.invoiceNumber,
        saleId: sale.id,
      }))
    );

    const activeSales = customer.sales.filter((s: any) => s.status !== 'CANCELLED');

    const totalSpent = activeSales.reduce((sum: number, s: any) => sum + Number(s.totalAmount), 0);
    const totalProfit = activeSales.reduce((sum: number, s: any) => sum + Number(s.profit), 0);

    const nonCancelledShipments = allShipments.filter((s: any) => s.status !== 'CANCELLED');
    const deliveredCount = allShipments.filter((s: any) => s.status === 'DELIVERED').length;
    const returnedCount = allShipments.filter((s: any) => s.status === 'RETURNED').length;
    const cancelledCount = allShipments.filter((s: any) => s.status === 'CANCELLED').length;
    const pendingCount = allShipments.filter((s: any) => s.status === 'PENDING').length;
    const shippedCount = allShipments.filter((s: any) => s.status === 'SHIPPED').length;

    const deliveryRate = nonCancelledShipments.length > 0
      ? (deliveredCount / nonCancelledShipments.length) * 100
      : 0;

    const shipmentCosts = allShipments
      .filter((s: any) => s.shippingCost && s.status !== 'CANCELLED')
      .map((s: any) => s.shippingCost!);

    const avgShippingCost = shipmentCosts.length > 0
      ? shipmentCosts.reduce((a: number, b: number) => a + b, 0) / shipmentCosts.length
      : 0;

    const totalShippingCost = shipmentCosts.reduce((a: number, b: number) => a + b, 0);

    const providerCounts: Record<string, number> = {};
    allShipments
      .filter((s: any) => s.shippingProvider && s.status !== 'CANCELLED')
      .forEach((s: any) => {
        providerCounts[s.shippingProvider!] = (providerCounts[s.shippingProvider!] || 0) + 1;
      });

    const topProvider = Object.entries(providerCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const saleDates = activeSales.map((s: any) => s.date);
    const firstOrderDate = saleDates.length > 0 ? saleDates[saleDates.length - 1] : null;
    const lastOrderDate = saleDates.length > 0 ? saleDates[0] : null;

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: (customer as any).email as string | null,
        address: customer.address,
        taxId: customer.taxId,
        notes: customer.notes,
        createdAt: customer.createdAt,
      },
      addresses: customer.addresses,
      stats: {
        totalOrders: activeSales.length,
        totalSpent,
        totalProfit,
        totalShipments: allShipments.length,
        deliveredCount,
        returnedCount,
        cancelledCount,
        pendingCount,
        shippedCount,
        deliveryRate,
        avgShippingCost,
        totalShippingCost,
        topProvider,
        providerBreakdown: providerCounts,
        firstOrderDate,
        lastOrderDate,
      },
      sales: customer.sales.map((sale: any) => ({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        date: sale.date,
        totalAmount: Number(sale.totalAmount),
        profit: Number(sale.profit),
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        itemCount: sale.items.reduce((sum: number, i: any) => sum + i.quantity, 0),
        shipmentCount: sale.shipments.length,
        latestShipmentStatus: sale.shipments[0]?.status || null,
      })),
      shipments: allShipments,
    };
  },

  async getAddresses(customerId: string, ctx: RequestContext) {
    return db.customerAddress.findMany({
      where: { customerId, shopId: ctx.shopId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async getAddressById(id: string, ctx: RequestContext) {
    const address = await db.customerAddress.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });
    if (!address) throw new ServiceError('ไม่พบข้อมูลที่อยู่');
    return address;
  },

  async createAddress(customerId: string, ctx: RequestContext, data: any): Promise<any> {
    const customer = await db.customer.findFirst({
      where: { id: customerId, shopId: ctx.shopId, deletedAt: null },
    });

    if (!customer) throw new ServiceError('ไม่พบข้อมูลลูกค้า');

    return AuditService.runWithAudit(
      ctx,
      CUSTOMER_AUDIT_POLICIES.ADDRESS_CREATE(customer.name),
      async () => {
        if (data.isDefault) {
          await db.customerAddress.updateMany({
            where: { customerId, shopId: ctx.shopId, isDefault: true },
            data: { isDefault: false },
          });
        }

        return db.customerAddress.create({
          data: { ...data, customerId, shopId: ctx.shopId },
        });
      }
    );
  },

  async updateAddress(id: string, ctx: RequestContext, data: any): Promise<void> {
    const existing = await db.customerAddress.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: { customer: { select: { name: true } } }
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลที่อยู่');

    await AuditService.runWithAudit(
      ctx,
      {
        ...CUSTOMER_AUDIT_POLICIES.ADDRESS_UPDATE(id, existing.customer.name),
        beforeSnapshot: () => existing,
        afterSnapshot: () => db.customerAddress.findFirst({ where: { id } }),
      },
      async () => {
        if (data.isDefault) {
          await db.customerAddress.updateMany({
            where: {
              customerId: existing.customerId,
              shopId: ctx.shopId,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          });
        }

        await db.customerAddress.update({
          where: { id },
          data,
        });
      }
    );
  },

  async deleteAddress(id: string, ctx: RequestContext): Promise<void> {
    const existing = await db.customerAddress.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: { customer: { select: { name: true } } }
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลที่อยู่');

    await AuditService.runWithAudit(
      ctx,
      {
        ...CUSTOMER_AUDIT_POLICIES.ADDRESS_DELETE(id, existing.customer.name),
        beforeSnapshot: () => existing,
      },
      async () => {
        await db.customerAddress.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      }
    );
  },

  /**
   * REAL: Region-Salesperson Mapping (ERP Module 2 - UC 3)
   * ค้นหาพนักงานขายที่มีความเชี่ยวชาญหรือดูแลภูมิภาคนั้นๆ
   */
  async getSalespersonsByRegion(region: string, ctx: RequestContext) {
    return db.shopMember.findMany({
      where: {
        shopId: ctx.shopId,
        regionIds: { has: region }
      },
      select: {
        id: true,
        userId: true,
        departmentCode: true,
        user: { select: { name: true, email: true } }
      }
    });
  },

  /**
   * UC 12: Contact Import Template (Strict Structure)
   * รักษาโครงสร้างไฟล์ Import ให้คงเดิม 100% ห้ามสลับหรือลดคอลัมน์
   */
  async batchCreate(inputs: any[], ctx: RequestContext) {
    // Expected Columns (Standard Template)
    const REQUIRED_COLUMNS = ['name', 'phone', 'email', 'address', 'region'];

    const results = {
      success: [] as any[],
      failed: [] as any[],
    };

    for (const input of inputs) {
      // Logic: ห้ามสลับ/เพิ่ม/ลดคอลัมน์ (Validate payload keys)
      const inputKeys = Object.keys(input);
      const isStructureValid = REQUIRED_COLUMNS.every(col => inputKeys.includes(col));

      if (!isStructureValid) {
        results.failed.push({
          data: input,
          error: `Structure Mismatch: Missing required columns (${REQUIRED_COLUMNS.filter(c => !inputKeys.includes(c)).join(', ')})`
        });
        continue;
      }
      try {
        const created = await this.create(ctx, input);
        results.success.push(created);
      } catch (err: any) {
        results.failed.push({ data: input, error: err.message });
      }
    }

    return results;
  },

  /**
   * ตรวจสอบสถานะเครดิตของลูกค้า (ERP Rule 6)
   */
  async checkCreditLimit(customerId: string, requestedAmount: number, ctx: RequestContext) {
    const customer = await db.customer.findFirst({
      where: { id: customerId, shopId: ctx.shopId, deletedAt: null },
      select: { creditLimit: true },
    });

    if (!customer) throw new ServiceError('ไม่พบข้อมูลลูกค้า');

    // ถ้าไม่มีการตั้งวงเงิน (null หรือ 0) ถือว่าไม่มีขีดจำกัด (ใช้งานง่ายสำหรับร้านทั่วไป)
    const limit = customer.creditLimit ? Number(customer.creditLimit) : 0;
    if (limit <= 0) {
      return {
        creditLimit: 0,
        currentOutstanding: 0,
        availableCredit: 999999999,
        isWithinLimit: true,
      };
    }

    // คำนวณยอดค้างชำระ (บิลที่ยังไม่ชำระและไม่ได้ยกเลิก)
    const unpaidSales = await db.sale.aggregate({
      where: {
        customerId,
        shopId: ctx.shopId,
        status: { not: 'CANCELLED' },
        billingStatus: { not: 'PAID' },
      },
      _sum: { netAmount: true },
    });

    const currentOutstanding = Number(unpaidSales._sum?.netAmount || 0);
    const availableCredit = limit - currentOutstanding;
    const isWithinLimit = (currentOutstanding + requestedAmount) <= limit;

    return {
      creditLimit: limit,
      currentOutstanding,
      availableCredit,
      isWithinLimit,
    };
  }
};
