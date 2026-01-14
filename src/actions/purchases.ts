'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { purchaseSchema, type PurchaseInput } from '@/schemas/purchase';

interface GetPurchasesParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}

export async function getPurchases(params: GetPurchasesParams = {}) {
  const userId = await getCurrentUserId();
  const {
    page = 1,
    limit = 20,
    search,
    startDate,
    endDate,
    paymentMethod,
  } = params;

  const searchFilter = buildSearchFilter(search, ['referenceNumber', 'supplierName', 'notes']);
  const dateFilter = buildDateRangeFilter(startDate, endDate);

  const where = {
    userId,
    ...(searchFilter && searchFilter),
    ...(dateFilter && { date: dateFilter }),
    ...(paymentMethod && { paymentMethod }),
  };

  return paginatedQuery(db.purchase, {
    where,
    include: {
      items: {
        include: {
          product: {
            select: { name: true },
          },
        },
      },
      supplier: {
        select: { name: true },
      },
    },
    page,
    limit,
    orderBy: { date: 'desc' },
  });
}

export async function getPurchase(id: string) {
  const userId = await getCurrentUserId();

  const purchase = await db.purchase.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
      supplier: true,
    },
  });

  if (!purchase) {
    throw new Error('ไม่พบข้อมูลการซื้อ');
  }

  return purchase;
}

export async function createPurchase(input: PurchaseInput) {
  const userId = await getCurrentUserId();

  const validated = purchaseSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const { items, ...purchaseData } = validated.data;

  try {
    const purchase = await db.$transaction(async (tx) => {
      // Generate reference number
      const lastPurchase = await tx.purchase.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { referenceNumber: true },
      });

      const lastNumber = lastPurchase
        ? parseInt(lastPurchase.referenceNumber.split('-')[1] || '0')
        : 0;
      const referenceNumber = `PO-${String(lastNumber + 1).padStart(5, '0')}`;

      // Calculate total
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.costPrice,
        0
      );

      // Create purchase
      const newPurchase = await tx.purchase.create({
        data: {
          referenceNumber,
          userId,
          supplierId: purchaseData.supplierId || null,
          supplierName: purchaseData.supplierName || null,
          paymentMethod: purchaseData.paymentMethod,
          notes: purchaseData.notes || null,
          totalAmount,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              subtotal: item.quantity * item.costPrice,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Update product stock and cost price
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            costPrice: item.costPrice, // Update cost price to latest
          },
        });
      }

      return newPurchase;
    });

    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { data: purchase };
  } catch (error: any) {
    console.error('Create purchase error:', error);
    return { error: { _form: [error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function deletePurchase(id: string) {
  const userId = await getCurrentUserId();

  try {
    await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, userId },
        include: { items: true },
      });

      if (!purchase) {
        throw new Error('ไม่พบข้อมูลการซื้อ');
      }

      // Restore stock
      for (const item of purchase.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
          },
        });
      }

      await tx.purchase.delete({
        where: { id },
      });
    });

    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Delete purchase error:', error);
    return { error: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}
