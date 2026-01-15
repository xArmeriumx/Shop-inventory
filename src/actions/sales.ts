'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { saleSchema, type SaleInput } from '@/schemas/sale';
import type { Sale, SaleItem } from '@prisma/client';
import { StockService } from '@/lib/stock-service';
import type { ActionResponse } from '@/types/action-response';

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

export async function createSale(input: SaleInput): Promise<ActionResponse<Sale>> {
  const userId = await getCurrentUserId();

  // Validate input
  const validated = saleSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการขายไม่ถูกต้อง',
    };
  }

  const { items, customerAddress, ...saleData } = validated.data;

  // Validate items
  if (items.length === 0) {
    return {
      success: false,
      message: 'ต้องมีสินค้าอย่างน้อย 1 รายการ',
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Check stock for all items
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, name: true },
        });

        if (!product) {
          throw new Error(`ไม่พบสินค้า ID: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`สินค้า "${product.name}" มีสต็อกไม่พอ (เหลือ ${product.stock})`);
        }
      }

      // 2. Generate invoice number
      const lastSale = await tx.sale.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      });

      const lastNumber = lastSale
        ? parseInt(lastSale.invoiceNumber.split('-')[1] || '0')
        : 0;
      const invoiceNumber = `INV-${String(lastNumber + 1).padStart(5, '0')}`;

      // 3. Calculate totals & Prepare items
      let totalAmount = 0;
      let totalCost = 0;
      
      const saleItemsToCreate = [];

      for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { costPrice: true },
          });

          const costPrice = Number(product?.costPrice || 0);
          const subtotal = item.salePrice * item.quantity;
          const itemCost = costPrice * item.quantity;
          const profit = subtotal - itemCost;

          totalAmount += subtotal;
          totalCost += itemCost;
          
          saleItemsToCreate.push({
              productId: item.productId,
              quantity: item.quantity,
              salePrice: item.salePrice,
              costPrice: costPrice,
              subtotal: subtotal,
              profit: profit
          });
      }
      
      const profit = totalAmount - totalCost;

      // 4. Handle Customer
      let finalCustomerId = saleData.customerId;
      if (!finalCustomerId && saleData.customerName) {
         const existing = await tx.customer.findFirst({
            where: { userId, name: saleData.customerName, deletedAt: null }
         });
         
         if (existing) {
            finalCustomerId = existing.id;
         } else {
            const newC = await tx.customer.create({
               data: {
                  userId,
                  name: saleData.customerName,
                  address: customerAddress || null
               }
            });
            finalCustomerId = newC.id;
         }
      }

      // 5. Create Sale
      const sale = await tx.sale.create({
        data: {
          ...saleData,
          customerId: finalCustomerId || null,
          customerName: saleData.customerName || 'ลูกค้าทั่วไป',
          userId,
          invoiceNumber,
          totalAmount,
          totalCost,
          profit,
          items: {
            create: saleItemsToCreate.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                salePrice: item.salePrice,
                costPrice: item.costPrice,
                subtotal: item.subtotal,
                profit: item.profit
            }))
          },
        },
        include: { items: true },
      });

      // 6. Record Stock Movements
      for (const item of sale.items) {
        await StockService.recordMovement({
            productId: item.productId,
            type: 'SALE',
            quantity: item.quantity,
            referenceId: sale.id,
            referenceType: 'SALE',
            note: `ขาย: ${sale.invoiceNumber}`,
            date: sale.date,
            tx,
            userId,
          });
      }

      return sale;
    });

    revalidatePath('/sales');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: 'บันทึกการขายสำเร็จ',
      data: result,
    };
  } catch (error: any) {
    console.error('Create sale error:', error);
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการบันทึกการขาย',
    };
  }
}

// Cancel Reasons for Audit (internal use only)
const CANCEL_REASONS = {
  WRONG_ENTRY: 'บันทึกผิดพลาด',
  CUSTOMER_REQUEST: 'ลูกค้าขอยกเลิก',
  DAMAGED: 'สินค้าชำรุด',
  OTHER: 'อื่นๆ',
} as const;

interface CancelSaleInput {
  id: string;
  reasonCode: string;
  reasonDetail?: string; // Required if reasonCode is 'OTHER'
}

export async function cancelSale(input: CancelSaleInput) {
  const userId = await getCurrentUserId();
  const { id, reasonCode, reasonDetail } = input;

  // Validate: Cancel reason is required
  if (!reasonCode) {
    return { error: 'กรุณาเลือกเหตุผลในการยกเลิก' };
  }

  // Validate: If 'OTHER', reasonDetail is required
  if (reasonCode === 'OTHER' && !reasonDetail?.trim()) {
    return { error: 'กรุณากรอกรายละเอียดเหตุผล' };
  }

  // Build cancel reason text
  const cancelReason = reasonCode === 'OTHER' 
    ? `${CANCEL_REASONS.OTHER}: ${reasonDetail}` 
    : (CANCEL_REASONS as Record<string, string>)[reasonCode] || reasonCode;

  try {
    // Get current user name for audit
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await db.$transaction(async (tx) => {
      // Get sale with items
      const sale = await tx.sale.findFirst({
        where: { id, userId },
        include: { items: true },
      });

      if (!sale) {
        throw new Error('ไม่พบข้อมูลการขาย');
      }

      // Check if already cancelled
      if (sale.status === 'CANCELLED') {
        throw new Error('รายการนี้ถูกยกเลิกไปแล้ว');
      }

      // Restore stock with movement log
      for (const item of sale.items) {
        await StockService.recordMovement({
          productId: item.productId,
          type: 'SALE_CANCEL',
          quantity: item.quantity, // Positive = restore
          userId,
          referenceId: sale.id,
          referenceType: 'SALE_CANCEL',
          note: `ยกเลิกการขาย ${sale.invoiceNumber} - ${cancelReason}`,
          date: new Date(),
          tx,
        });
      }

      // Mark sale as cancelled (not delete)
      await tx.sale.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user?.name || 'Unknown',
          cancelReason,
        },
      });
    });

    revalidatePath('/sales');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Cancel sale error:', error);
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
