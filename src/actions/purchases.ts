'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { purchaseSchema, type PurchaseInput } from '@/schemas/purchase';
import { StockService } from '@/lib/stock-service';

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

  const searchFilter = buildSearchFilter(search, ['notes']);
  const dateFilter = buildDateRangeFilter(startDate, endDate);

  const where = {
    userId,
    ...(searchFilter && searchFilter),
    ...(dateFilter && { date: dateFilter }),
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
    const purchase = await db.$transaction(async (tx: any) => {
      // Calculate total
      const totalCost = items.reduce(
        (sum, item) => sum + item.quantity * item.costPrice,
        0
      );

      // Create purchase
      const newPurchase = await tx.purchase.create({
        data: {
          date: purchaseData.date ? new Date(purchaseData.date) : new Date(),
          userId,
          supplierId: purchaseData.supplierId || null,
          supplierName: purchaseData.supplierName || null,
          notes: purchaseData.notes || null,
          totalCost: totalCost,
          receiptUrl: purchaseData.receiptUrl || null,
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
        // Record stock movement (This updates the stock quantity)
        await StockService.recordMovement({
          productId: item.productId,
          type: 'PURCHASE',
          quantity: item.quantity, // Purchase increases stock
          userId,
          referenceId: newPurchase.id,
          referenceType: 'PURCHASE',
          note: `ซื้อสินค้า ${newPurchase.supplierName || ''}`,
          date: newPurchase.date,
          tx,
        });

        // Update cost price separately as it's not part of standard stock movement
        await tx.product.update({
          where: { id: item.productId },
          data: {
            costPrice: item.costPrice, 
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
    await db.$transaction(async (tx: any) => {
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
