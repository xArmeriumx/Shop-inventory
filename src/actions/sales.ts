'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { saleSchema, type SaleInput } from '@/schemas/sale';
import type { Sale, SaleItem } from '@prisma/client';
import { StockService } from '@/lib/stock-service';

interface GetSalesParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}

type SaleWithItems = Sale & {
  items: (SaleItem & {
    product: {
      name: string;
    };
  })[];
  customer: {
    name: string;
  } | null;
};

export async function getSales(params: GetSalesParams = {}) {
  const userId = await getCurrentUserId();
  const {
    page = 1,
    limit = 20,
    search,
    startDate,
    endDate,
    paymentMethod,
  } = params;

  const searchFilter = buildSearchFilter(search, ['invoiceNumber', 'customerName', 'notes']);
  const dateFilter = buildDateRangeFilter(startDate, endDate);

  const where = {
    userId,
    ...(searchFilter && searchFilter),
    ...(dateFilter && { date: dateFilter }),
    ...(paymentMethod && { paymentMethod }),
  };

  return paginatedQuery<SaleWithItems>(db.sale as any, {
    where,
    include: {
      items: {
        include: {
          product: {
            select: { name: true },
          },
        },
      },
      customer: {
        select: { name: true },
      },
    },
    page,
    limit,
    orderBy: { date: 'desc' },
  });
}

export async function getSale(id: string) {
  const userId = await getCurrentUserId();

  const sale = await db.sale.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
      customer: true,
    },
  });

  if (!sale) {
    throw new Error('ไม่พบข้อมูลการขาย');
  }

  return sale;
}

export async function createSale(input: SaleInput) {
  const userId = await getCurrentUserId();

  // Validate input
  const validated = saleSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const { items, ...saleData } = validated.data;

  try {
    // Start transaction
    const sale = await db.$transaction(async (tx) => {
      // Check stock availability
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, costPrice: true, name: true },
        });

        if (!product) {
          throw new Error(`ไม่พบสินค้า ID: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`สินค้า "${product.name}" มีสต็อกไม่พอ (เหลือ ${product.stock})`);
        }
      }

      // Generate invoice number
      const lastSale = await tx.sale.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      });

      const lastNumber = lastSale
        ? parseInt(lastSale.invoiceNumber.split('-')[1] || '0')
        : 0;
      const invoiceNumber = `INV-${String(lastNumber + 1).padStart(5, '0')}`;

      // Calculate totals
      let totalAmount = 0;
      let totalCost = 0;

      const calculatedItems = await Promise.all(
        items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { costPrice: true },
          });

          const costPrice = product!.costPrice;
          const subtotal = item.salePrice * item.quantity;
          const itemCost = Number(costPrice) * item.quantity;
          const profit = subtotal - itemCost;

          totalAmount += subtotal;
          totalCost += itemCost;

          return {
            ...item,
            costPrice,
            subtotal,
            profit,
          };
        })
      );

      const profit = totalAmount - totalCost;

      // Handle customer: create if new name provided
      let finalCustomerId = saleData.customerId;
      if (!finalCustomerId && saleData.customerName) {
        // Check if customer with this name already exists
        const existingCustomer = await tx.customer.findFirst({
          where: {
            userId,
            name: saleData.customerName,
            deletedAt: null,
          },
        });

        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        } else {
          // Create new customer
          const newCustomer = await tx.customer.create({
            data: {
              userId,
              name: saleData.customerName,
              address: saleData.customerAddress || null,
            },
          });
          finalCustomerId = newCustomer.id;
        }
      }

      // Create sale
      const newSale = await tx.sale.create({
        data: {
          date: saleData.date ? new Date(saleData.date) : new Date(),
          invoiceNumber,
          userId,
          customerId: finalCustomerId || null,
          customerName: saleData.customerName || null,
          paymentMethod: saleData.paymentMethod,
          notes: saleData.notes || null,
          receiptUrl: saleData.receiptUrl || null,
          totalAmount,
          totalCost,
          profit,
          items: {
            create: calculatedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              salePrice: item.salePrice,
              costPrice: item.costPrice,
              subtotal: item.subtotal,
              profit: item.profit,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Update stock using StockService
      for (const item of calculatedItems) {
        await StockService.recordMovement({
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity, // Sale reduces stock
          userId,
          referenceId: newSale.id,
          referenceType: 'SALE',
          note: `ขายสินค้า INV: ${newSale.invoiceNumber}`,
          date: newSale.date,
          tx,
        });
      }

      return newSale;
    });

    revalidatePath('/sales');
    revalidatePath('/dashboard');
    return { data: sale };
  } catch (error: any) {
    console.error('Create sale error:', error);
    return { error: { _form: [error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function deleteSale(id: string) {
  const userId = await getCurrentUserId();

  try {
    await db.$transaction(async (tx) => {
      // Get sale with items
      const sale = await tx.sale.findFirst({
        where: { id, userId },
        include: { items: true },
      });

      if (!sale) {
        throw new Error('ไม่พบข้อมูลการขาย');
      }

      // Restore stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      // Delete sale (cascade will delete items)
      await tx.sale.delete({
        where: { id },
      });
    });

    revalidatePath('/sales');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Delete sale error:', error);
    return { error: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function getTodaySales() {
  const userId = await getCurrentUserId();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await db.sale.aggregate({
    where: {
      userId,
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
    _sum: {
      totalAmount: true,
      profit: true,
    },
    _count: true,
  });

  return {
    totalAmount: Number(result._sum.totalAmount || 0),
    profit: Number(result._sum.profit || 0),
    count: result._count,
  };
}

export async function getRecentSales(limit: number = 5) {
  const userId = await getCurrentUserId();

  return db.sale.findMany({
    where: { userId },
    include: {
      customer: {
        select: { name: true },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
  });
}
