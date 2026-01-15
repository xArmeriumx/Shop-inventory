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

// Cancel Reasons for Audit (internal use only)
const CANCEL_REASONS = {
  WRONG_ENTRY: 'บันทึกผิดพลาด',
  SUPPLIER_ISSUE: 'ปัญหาจากผู้จำหน่าย',
  DAMAGED: 'สินค้าชำรุด',
  OTHER: 'อื่นๆ',
} as const;

interface CancelPurchaseInput {
  id: string;
  reasonCode: string;
  reasonDetail?: string;
}

export async function cancelPurchase(input: CancelPurchaseInput) {
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

  const cancelReason = reasonCode === 'OTHER'
    ? `${CANCEL_REASONS.OTHER}: ${reasonDetail}`
    : (CANCEL_REASONS as Record<string, string>)[reasonCode] || reasonCode;

  try {
    // Get current user name for audit
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await db.$transaction(async (tx: any) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, userId },
        include: { items: { include: { product: true } } },
      });

      if (!purchase) {
        throw new Error('ไม่พบข้อมูลการซื้อ');
      }

      // Check if already cancelled
      if (purchase.status === 'CANCELLED') {
        throw new Error('รายการนี้ถูกยกเลิกไปแล้ว');
      }

      // Validate: Check if stock would go negative
      for (const item of purchase.items) {
        const newStock = item.product.stock - item.quantity;
        if (newStock < 0) {
          throw new Error(
            `ไม่สามารถยกเลิกได้: สต็อก ${item.product.name} จะติดลบ (คงเหลือ ${item.product.stock}, ต้องหัก ${item.quantity})`
          );
        }
      }

      // Reduce stock with movement log
      for (const item of purchase.items) {
        await StockService.recordMovement({
          productId: item.productId,
          type: 'PURCHASE_CANCEL',
          quantity: -item.quantity, // Negative = reduce
          userId,
          referenceId: purchase.id,
          referenceType: 'PURCHASE_CANCEL',
          note: `ยกเลิกการซื้อ - ${cancelReason}`,
          date: new Date(),
          tx,
        });
      }

      // Mark purchase as cancelled (not delete)
      await tx.purchase.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user?.name || 'Unknown',
          cancelReason,
        },
      });
    });

    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Cancel purchase error:', error);
    return { error: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}
