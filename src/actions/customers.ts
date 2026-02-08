'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { customerSchema, type CustomerInput } from '@/schemas/customer';
import type { Customer } from '@prisma/client';
import type { ActionResponse } from '@/types/action-response';

interface GetCustomersParams { 
  page?: number;
  limit?: number;
  search?: string;
}

export async function getCustomers(params: GetCustomersParams = {}) {
  const ctx = await requirePermission('CUSTOMER_VIEW'); //require permission
  const { page = 1, limit = 20, search } = params;

  const searchFilter = buildSearchFilter(search, ['name', 'phone', 'address', 'email']);

  const where = {
    shopId: ctx.shopId, 
    ...(searchFilter && searchFilter),
    deletedAt: null, // Only active customers
  };

  return paginatedQuery<Customer>(db.customer, { //Customer list
    where,
    page,
    limit,
    orderBy: { name: 'asc' },
  });
}

export async function getCustomer(id: string) { 
  const ctx = await requirePermission('CUSTOMER_VIEW');

  const customer = await db.customer.findFirst({ //select one customer
    where: { id, shopId: ctx.shopId, deletedAt: null }, //ID,shopid,session,deletedAt
  });

  if (!customer) {
    throw new Error('ไม่พบข้อมูลลูกค้า');
  }

  return customer;
}

//Create customer
export async function createCustomer(input: CustomerInput): Promise<ActionResponse<Customer>> {
  // RBAC: Require CUSTOMER_CREATE permission
  const ctx = await requirePermission('CUSTOMER_CREATE');

  const validated = customerSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบความถูกต้อง',
    };
  }

  try {
    const customer = await db.customer.create({
      data: {
        ...validated.data,
        name: validated.data.name,
        phone: validated.data.phone || null,
        address: validated.data.address || null,
        taxId: validated.data.taxId || null,
        notes: validated.data.notes || null,
        userId: ctx.userId,
        shopId: ctx.shopId,  // RBAC: Set shopId for new customer
      },
    });

    revalidatePath('/customers');
    return {
      success: true,
      message: 'บันทึกข้อมูลลูกค้าสำเร็จ',
      data: customer,
    };
  } catch (error) {
    await logger.error('Create customer error', error as Error, { path: 'createCustomer', userId: ctx.userId });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง',
    };
  }
}

//Update customer
export async function updateCustomer(id: string, input: CustomerInput): Promise<ActionResponse<Customer>> {
  // RBAC: Require CUSTOMER_EDIT permission
  const ctx = await requirePermission('CUSTOMER_EDIT');

  const validated = customerSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบความถูกต้อง',
    };
  }

  const existing = await db.customer.findFirst({
    where: { id, shopId: ctx.shopId, deletedAt: null },
  });

  if (!existing) {
    return {
      success: false,
      message: 'ไม่พบข้อมูลลูกค้า หรือลูกค้าถูกลบไปแล้ว',
    };
  }

  try {
    const customer = await db.customer.update({ //update customer
      where: { id },
      data: {
        ...validated.data,
        name: validated.data.name,
        phone: validated.data.phone || null,
        address: validated.data.address || null,
        taxId: validated.data.taxId || null,
        notes: validated.data.notes || null,
      },
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    
    return {
      success: true,
      message: 'อัปเดตข้อมูลลูกค้าสำเร็จ',
      data: customer,
    };
  } catch (error) {
    await logger.error('Update customer error', error as Error, { path: 'updateCustomer', userId: ctx.userId, customerId: id });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล',
    };
  }
}

//Delete customer
export async function deleteCustomer(id: string): Promise<ActionResponse> {
  // RBAC: Require CUSTOMER_DELETE permission
  const ctx = await requirePermission('CUSTOMER_DELETE');

  const existing = await db.customer.findFirst({
    where: { id, shopId: ctx.shopId, deletedAt: null },
  });

  if (!existing) {
    return {
      success: false,
      message: 'ไม่พบข้อมูลลูกค้า',
    };
  }

  try {
    // Soft delete (log deletedAt)
    await db.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath('/customers');
    return {
      success: true,
      message: 'ลบข้อมูลลูกค้าสำเร็จ',
    };
  } catch (error) {
    await logger.error('Delete customer error', error as Error, { path: 'deleteCustomer', userId: ctx.userId, customerId: id });
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบข้อมูล (อาจมีการใช้งานลูกค้ารายนี้ในรายการขาย)',
    };
  }
}

//Select customer (Dropdown)
export async function getCustomersForSelect() { 
  const ctx = await requirePermission('CUSTOMER_VIEW');

  return db.customer.findMany({
    where: { shopId: ctx.shopId, deletedAt: null },
    select: { id: true, name: true, phone: true, address: true, taxId: true },
    orderBy: { name: 'asc' },
  });
}

// =============================================================================
// CUSTOMER PROFILE (Full detail with sales + shipments + stats)
// =============================================================================

export async function getCustomerProfile(id: string) {
  const ctx = await requirePermission('CUSTOMER_VIEW');

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
    throw new Error('ไม่พบข้อมูลลูกค้า');
  }

  // Flatten all shipments from sales chain
  const allShipments = customer.sales.flatMap((sale) =>
    sale.shipments.map((s) => ({
      ...s,
      shippingCost: s.shippingCost ? Number(s.shippingCost) : null,
      saleInvoice: sale.invoiceNumber,
      saleId: sale.id,
    }))
  );

  // Active sales only (for stats)
  const activeSales = customer.sales.filter((s) => s.status !== 'CANCELLED');

  // Compute stats
  const totalSpent = activeSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const totalProfit = activeSales.reduce((sum, s) => sum + Number(s.profit), 0);

  // Shipment stats (exclude cancelled for rate calc)
  const nonCancelledShipments = allShipments.filter((s) => s.status !== 'CANCELLED');
  const deliveredCount = allShipments.filter((s) => s.status === 'DELIVERED').length;
  const returnedCount = allShipments.filter((s) => s.status === 'RETURNED').length;
  const cancelledCount = allShipments.filter((s) => s.status === 'CANCELLED').length;
  const pendingCount = allShipments.filter((s) => s.status === 'PENDING').length;
  const shippedCount = allShipments.filter((s) => s.status === 'SHIPPED').length;

  const deliveryRate = nonCancelledShipments.length > 0
    ? (deliveredCount / nonCancelledShipments.length) * 100
    : 0;

  // Average shipping cost
  const shipmentCosts = allShipments
    .filter((s) => s.shippingCost && s.status !== 'CANCELLED')
    .map((s) => s.shippingCost!);
  const avgShippingCost = shipmentCosts.length > 0
    ? shipmentCosts.reduce((a, b) => a + b, 0) / shipmentCosts.length
    : 0;
  const totalShippingCost = shipmentCosts.reduce((a, b) => a + b, 0);

  // Top provider
  const providerCounts: Record<string, number> = {};
  allShipments
    .filter((s) => s.shippingProvider && s.status !== 'CANCELLED')
    .forEach((s) => {
      providerCounts[s.shippingProvider!] = (providerCounts[s.shippingProvider!] || 0) + 1;
    });
  const topProvider = Object.entries(providerCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Date range
  const saleDates = activeSales.map((s) => s.date);
  const firstOrderDate = saleDates.length > 0 ? saleDates[saleDates.length - 1] : null;
  const lastOrderDate = saleDates.length > 0 ? saleDates[0] : null;

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: (customer as any).email as string | null,  // Prisma type inference issue with nested select
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
    sales: customer.sales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: sale.date,
      totalAmount: Number(sale.totalAmount),
      profit: Number(sale.profit),
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      itemCount: sale.items.reduce((sum, i) => sum + i.quantity, 0),
      shipmentCount: sale.shipments.length,
      latestShipmentStatus: sale.shipments[0]?.status || null,
    })),
    shipments: allShipments,
  };
}
