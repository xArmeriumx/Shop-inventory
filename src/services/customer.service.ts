import { db } from '@/lib/db';
import { RequestContext, ServiceError } from './product.service';
import { CustomerInput } from '@/schemas/customer';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { logger } from '@/lib/logger';
import type { Customer } from '@prisma/client';

export interface GetCustomersParams { 
  page?: number;
  limit?: number;
  search?: string;
}

export const CustomerService = {
  async getList(params: GetCustomersParams = {}, ctx: RequestContext) {
    const { page = 1, limit = 20, search } = params;
    const searchFilter = buildSearchFilter(search, ['name', 'phone', 'address', 'email']);

    const where = {
      shopId: ctx.shopId, 
      ...(searchFilter && searchFilter),
      deletedAt: null,
    };

    return paginatedQuery<Customer>(db.customer, {
      where,
      page,
      limit,
      orderBy: { name: 'asc' },
    });
  },

  async getById(id: string, ctx: RequestContext) {
    const customer = await db.customer.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!customer) {
      throw new ServiceError('ไม่พบข้อมูลลูกค้า');
    }

    return customer;
  },

  async create(data: CustomerInput, ctx: RequestContext) {
    return db.customer.create({
      data: {
        ...data,
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        taxId: data.taxId || null,
        notes: data.notes || null,
        userId: ctx.userId,
        shopId: ctx.shopId,
      },
    });
  },

  async update(id: string, data: CustomerInput, ctx: RequestContext) {
    const existing = await db.customer.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) {
      throw new ServiceError('ไม่พบข้อมูลลูกค้า หรือลูกค้าถูกลบไปแล้ว');
    }

    return db.customer.update({
      where: { id },
      data: {
        ...data,
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        taxId: data.taxId || null,
        notes: data.notes || null,
      },
    });
  },

  async delete(id: string, ctx: RequestContext) {
    const existing = await db.customer.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) {
      throw new ServiceError('ไม่พบข้อมูลลูกค้า');
    }

    return db.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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

  async createAddress(data: any, ctx: RequestContext) {
    const customer = await db.customer.findFirst({
      where: { id: data.customerId, shopId: ctx.shopId, deletedAt: null },
    });

    if (!customer) throw new ServiceError('ไม่พบข้อมูลลูกค้า');

    if (data.isDefault) {
      await db.customerAddress.updateMany({
        where: { customerId: data.customerId, shopId: ctx.shopId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return db.customerAddress.create({
      data: { ...data, shopId: ctx.shopId },
    });
  },

  async updateAddress(id: string, data: any, ctx: RequestContext) {
    const existing = await db.customerAddress.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลที่อยู่');

    if (data.isDefault) {
      await db.customerAddress.updateMany({
        where: {
          customerId: data.customerId,
          shopId: ctx.shopId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    return db.customerAddress.update({
      where: { id },
      data,
    });
  },

  async deleteAddress(id: string, ctx: RequestContext) {
    const existing = await db.customerAddress.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลที่อยู่');

    return db.customerAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
};
