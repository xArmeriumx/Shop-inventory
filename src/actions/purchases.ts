'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requireAuth, requirePermission, getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { purchaseSchema, type PurchaseInput } from '@/schemas/purchase';
import type { Purchase } from '@prisma/client';
import { StockService } from '@/lib/stock-service';
import type { ActionResponse } from '@/types/action-response';
import { money, toNumber, calcSubtotal } from '@/lib/money';
import { Prisma } from '@prisma/client';

// =============================================================================
// PURCHASE NUMBER GENERATION (Race-condition safe)
// =============================================================================

const MAX_PURCHASE_RETRIES = 5;

/**
 * Generate a unique purchase number: PUR-00001, PUR-00002, ...
 * Race-condition safe with retry + collision check.
 */
async function generatePurchaseNumber(
  tx: Prisma.TransactionClient,
  shopId: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_PURCHASE_RETRIES; attempt++) {
    const lastPurchase = await tx.purchase.findFirst({
      where: { shopId, purchaseNumber: { not: null } },
      orderBy: { purchaseNumber: 'desc' },
      select: { purchaseNumber: true },
    });

    const lastNumber = lastPurchase?.purchaseNumber
      ? parseInt(lastPurchase.purchaseNumber.split('-')[1] || '0')
      : 0;

    const newNumber = lastNumber + 1 + attempt;
    const purchaseNumber = `PUR-${String(newNumber).padStart(5, '0')}`;

    const exists = await tx.purchase.findFirst({
      where: { shopId, purchaseNumber },
      select: { id: true },
    });

    if (!exists) {
      return purchaseNumber;
    }

    await logger.warn('Purchase number collision, retrying', {
      purchaseNumber,
      attempt,
      shopId,
    });
  }

  throw new Error('ไม่สามารถสร้างเลข Purchase ได้ กรุณาลองใหม่');
}

interface GetPurchasesParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}

export async function getPurchases(params: GetPurchasesParams = {}) {
  const ctx = await requirePermission('PURCHASE_VIEW');
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
    shopId: ctx.shopId,
    ...(searchFilter && searchFilter),
    ...(dateFilter && { date: dateFilter }),
    ...(paymentMethod && { paymentMethod }),
  };

  const result = await paginatedQuery(db.purchase, {
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

  return {
    ...result,
    data: result.data.map((p: any) => ({
      ...p,
      totalCost: toNumber(p.totalCost),
      items: p.items.map((i: any) => ({
        ...i,
        costPrice: toNumber(i.costPrice),
        subtotal: toNumber(i.subtotal),
      })),
    })),
  };
}

// Get Purchase (ดึงข้อมูลการซื้อ)
export async function getPurchase(id: string) {
  const ctx = await requirePermission('PURCHASE_VIEW');

  const purchase = await db.purchase.findFirst({
    where: { id, shopId: ctx.shopId },
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

  return {
    ...purchase,
    totalCost: toNumber(purchase.totalCost),
    items: purchase.items.map((i: any) => ({
      ...i,
      costPrice: toNumber(i.costPrice),
      subtotal: toNumber(i.subtotal),
    })),
  };
}

// Create Purchase (สร้างการซื้อ)
export async function createPurchase(input: PurchaseInput): Promise<ActionResponse<Purchase>> {
  // RBAC: Require PURCHASE_CREATE permission
  const ctx = await requirePermission('PURCHASE_CREATE');

  const validated = purchaseSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการสั่งซื้อไม่ถูกต้อง',
    };
  }

  const { items, ...purchaseData } = validated.data;
  if (items.length === 0) {
    return {
      success: false,
      message: 'ต้องมีสินค้าอย่างน้อย 1 รายการ',
    };
  }

  // 1. Create Purchase & PurchaseItems
  // 2. Loop update Stock & Cost Price

  try {
    const purchase = await db.$transaction(async (tx: any) => {
      // Calculate total
      const totalCost = items.reduce(
        (sum, item) => money.add(sum, calcSubtotal(item.quantity, item.costPrice)),
        0
      );

      // Generate purchase number
      const purchaseNumber = await generatePurchaseNumber(tx, ctx.shopId);

      // Create purchase
      const newPurchase = await tx.purchase.create({
        data: {
          ...purchaseData,
          purchaseNumber,
          date: purchaseData.date ? new Date(purchaseData.date) : new Date(),
          userId: ctx.userId,
          shopId: ctx.shopId,  // RBAC: Set shopId for new purchase
          supplierId: purchaseData.supplierId || null,
          notes: purchaseData.notes || null,
          totalCost: totalCost,
          receiptUrl: purchaseData.receiptUrl || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              subtotal: calcSubtotal(item.quantity, item.costPrice),
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
          userId: ctx.userId,
          shopId: ctx.shopId,  // RBAC: Set shopId for stock log
          referenceId: newPurchase.id,
          referenceType: 'PURCHASE',
          note: `ซื้อสินค้า`,
          date: newPurchase.date,
          tx,
        });

        // Update cost price separately as it's not part of standard stock movement
        await tx.product.update({
          where: { id: item.productId },
          data: {
            costPrice: item.costPrice, //ราคาต้นทุน
          },
        });
      }

      return newPurchase;
    });

    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      message: 'บันทึกการสั่งซื้อสำเร็จ',
      data: {
        ...purchase,
        totalCost: toNumber(purchase.totalCost),
        items: purchase.items.map((i: any) => ({
          ...i,
          costPrice: toNumber(i.costPrice),
          subtotal: toNumber(i.subtotal),
        })),
      },
    };
  } catch (error: any) {
    await logger.error('Failed to create purchase', error, { 
      path: 'createPurchase', 
      userId: ctx.userId,
      input 
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการบันทึกการสั่งซื้อ',
    };
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

export async function cancelPurchase(input: CancelPurchaseInput): Promise<ActionResponse> {
  // RBAC: Require PURCHASE_CANCEL permission
  const ctx = await requirePermission('PURCHASE_CANCEL');
  const { id, reasonCode, reasonDetail } = input;

  // Validate: Cancel reason is required
  if (!reasonCode) {
    return {
      success: false,
      message: 'กรุณาเลือกเหตุผลในการยกเลิก',
    };
  }

  // Validate: If 'OTHER', reasonDetail is required
  if (reasonCode === 'OTHER' && !reasonDetail?.trim()) {
    return {
      success: false,
      message: 'กรุณากรอกรายละเอียดเหตุผล',
    };
  }

  const cancelReason = reasonCode === 'OTHER'
    ? `${CANCEL_REASONS.OTHER}: ${reasonDetail}`
    : (CANCEL_REASONS as Record<string, string>)[reasonCode] || reasonCode;

  try {
    // Get current user name for audit
    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    });

    await db.$transaction(async (tx: any) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, shopId: ctx.shopId },
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

      // Reduce stock + revert costPrice for each item
      for (const item of purchase.items) {
        // 1. Reduce stock with movement log
        await StockService.recordMovement({
          productId: item.productId,
          type: 'PURCHASE_CANCEL',
          quantity: -item.quantity, // Negative = reduce
          userId: ctx.userId,
          shopId: ctx.shopId,  // RBAC: Set shopId for stock log
          referenceId: purchase.id,
          referenceType: 'PURCHASE_CANCEL',
          note: `ยกเลิกการซื้อ - ${cancelReason}`,
          date: new Date(),
          tx,
        });

        // 2. Revert costPrice to previous purchase's cost
        // Find the most recent non-cancelled purchase item for this product
        // (excluding the current purchase being cancelled)
        const previousPurchaseItem = await tx.purchaseItem.findFirst({
          where: {
            productId: item.productId,
            purchase: {
              id: { not: purchase.id },
              status: { not: 'CANCELLED' },
              shopId: ctx.shopId,
            },
          },
          orderBy: { purchase: { date: 'desc' } },
          select: { costPrice: true },
        });

        if (previousPurchaseItem) {
          await tx.product.update({
            where: { id: item.productId },
            data: { costPrice: previousPurchaseItem.costPrice },
          });
        }
        // If no previous purchase exists, keep current costPrice as-is
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
    
    return {
      success: true,
      message: 'ยกเลิกรายการซื้อสำเร็จ',
    };
  } catch (error: any) {
    await logger.error('Failed to cancel purchase', error, { 
      path: 'cancelPurchase', 
      userId: ctx.userId,
      purchaseId: id,
      reason: cancelReason 
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการยกเลิกรายการ',
    };
  }
}
