'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { StockService } from '@/lib/stock-service';
import { NotificationService } from '@/lib/notification-service';
import type { ActionResponse } from '@/types/action-response';
import { money, toNumber, calcSubtotal } from '@/lib/money';
import { z } from 'zod';

// =============================================================================
// G3: Partial Returns (คืนสินค้าบางส่วน)
// =============================================================================

// ── Schemas ──────────────────────────────────────────────────────────────────

const returnItemSchema = z.object({
  saleItemId: z.string().min(1, 'กรุณาเลือกรายการสินค้า'),
  productId: z.string().min(1, 'ไม่พบสินค้า'),
  quantity: z.number().int().min(1, 'จำนวนต้องมากกว่า 0'),
  refundPerUnit: z.number().min(0, 'ราคาคืนต้องไม่ติดลบ'),
});

const createReturnSchema = z.object({
  saleId: z.string().min(1, 'กรุณาเลือกบิลขาย'),
  reason: z.string().min(1, 'กรุณาระบุเหตุผล').max(500, 'เหตุผลต้องไม่เกิน 500 ตัวอักษร'),
  refundMethod: z.enum(['CASH', 'TRANSFER', 'CREDIT'], {
    errorMap: () => ({ message: 'กรุณาเลือกวิธีคืนเงิน' }),
  }),
  items: z.array(returnItemSchema).min(1, 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'),
});

type CreateReturnInput = z.infer<typeof createReturnSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auto-gen return number: RET-00001, RET-00002, ...
 */
async function generateReturnNumber(tx: any, shopId: string): Promise<string> {
  const lastReturn = await tx.return.findFirst({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    select: { returnNumber: true },
  });

  let nextNum = 1;
  if (lastReturn?.returnNumber) {
    const match = lastReturn.returnNumber.match(/RET-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  return `RET-${String(nextNum).padStart(5, '0')}`;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * ดูรายการสินค้าที่คืนได้จากบิลขาย
 * Returns items with their max returnable quantity
 */
export async function getReturnableSaleItems(saleId: string) {
  const ctx = await requirePermission('RETURN_CREATE');

  const sale = await db.sale.findFirst({
    where: { id: saleId, shopId: ctx.shopId, status: { not: 'CANCELLED' } },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
          returnItems: { select: { quantity: true } },
        },
      },
    },
  });

  if (!sale) return null;

  return sale.items.map(item => {
    const alreadyReturned = item.returnItems.reduce((sum, ri) => sum + ri.quantity, 0);
    const maxReturnable = item.quantity - alreadyReturned;
    
    // Net price per unit = (subtotal - discountAmount) / quantity
    const subtotal = toNumber(item.subtotal);
    const discount = toNumber(item.discountAmount);
    const netPerUnit = item.quantity > 0
      ? money.round(money.divide(money.subtract(subtotal, discount), item.quantity))
      : 0;

    return {
      saleItemId: item.id,
      productId: item.productId,
      productName: item.product.name,
      productSku: item.product.sku,
      originalQuantity: item.quantity,
      alreadyReturned,
      maxReturnable,
      salePrice: toNumber(item.salePrice),
      netPerUnit, // ราคาคืนต่อชิ้น (หลังส่วนลด)
    };
  }).filter(item => item.maxReturnable > 0);
}

/**
 * สร้างรายการคืนสินค้า (Atomic: validate → create return → restore stock)
 */
export async function createReturn(input: CreateReturnInput): Promise<ActionResponse> {
  try {
    const ctx = await requirePermission('RETURN_CREATE');
    const shopId = ctx.shopId;

    // 1. Validate input
    const data = createReturnSchema.parse(input);

    // 2. Atomic transaction
    const result = await db.$transaction(async (tx) => {
      // 2.1 Validate sale exists + belongs to shop
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId, shopId, status: { not: 'CANCELLED' } },
        include: {
          items: {
            include: {
              returnItems: { select: { quantity: true } },
            },
          },
        },
      });

      if (!sale) throw new Error('ไม่พบบิลขาย หรือบิลถูกยกเลิกแล้ว');

      // 2.2 Validate each item: quantity doesn't exceed remaining
      let totalRefund = 0;
      const returnItemsData = [];

      for (const item of data.items) {
        const saleItem = sale.items.find(si => si.id === item.saleItemId);
        if (!saleItem) throw new Error(`ไม่พบรายการสินค้า: ${item.saleItemId}`);

        const alreadyReturned = saleItem.returnItems.reduce(
          (sum, ri) => sum + ri.quantity, 0
        );
        const maxReturnable = saleItem.quantity - alreadyReturned;

        if (item.quantity > maxReturnable) {
          throw new Error(`สินค้ารายการ "${item.saleItemId}" คืนได้สูงสุด ${maxReturnable} ชิ้น`);
        }

        const refundAmount = calcSubtotal(item.quantity, item.refundPerUnit);
        totalRefund = money.add(totalRefund, refundAmount);

        returnItemsData.push({
          saleItemId: item.saleItemId,
          productId: item.productId,
          quantity: item.quantity,
          refundPerUnit: item.refundPerUnit,
          refundAmount,
        });
      }

      // 2.3 Generate return number
      const returnNumber = await generateReturnNumber(tx, shopId);

      // 2.4 Create Return + ReturnItems
      const returnRecord = await tx.return.create({
        data: {
          returnNumber,
          saleId: data.saleId,
          reason: data.reason,
          refundAmount: totalRefund,
          refundMethod: data.refundMethod,
          status: 'COMPLETED',
          userId: ctx.userId,
          shopId,
          items: {
            create: returnItemsData,
          },
        },
        include: { items: true },
      });

      // 2.5 Restore stock for each item
      for (const item of returnItemsData) {
        await StockService.recordMovement({
          productId: item.productId,
          type: 'RETURN',
          quantity: item.quantity, // Positive = add back to stock
          userId: ctx.userId,
          shopId,
          referenceId: returnRecord.id,
          referenceType: 'SALE', // Related to original sale
          note: `คืนสินค้า ${returnNumber} (${data.reason})`,
          tx,
        });
      }

      // 2.6 Adjust original Sale financials (profit, netAmount, totalAmount)
      // Calculate cost of returned items to properly adjust profit
      let totalReturnCost = 0;
      for (const item of data.items) {
        const saleItem = sale.items.find(si => si.id === item.saleItemId);
        if (saleItem) {
          const costPerUnit = toNumber(saleItem.costPrice);
          totalReturnCost = money.add(totalReturnCost, calcSubtotal(item.quantity, costPerUnit));
        }
      }

      // profit adjustment = refund - cost (we're losing the revenue but recovering the cost)
      const profitAdjustment = money.subtract(totalRefund, totalReturnCost);

      await tx.sale.update({
        where: { id: data.saleId },
        data: {
          totalAmount:  { decrement: totalRefund },
          netAmount:    { decrement: totalRefund },
          totalCost:    { decrement: totalReturnCost },
          profit:       { decrement: profitAdjustment },
        },
      });

      return returnRecord;
    });

    revalidatePath('/sales');
    revalidatePath(`/sales/${data.saleId}`);
    revalidatePath('/returns');
    revalidatePath('/dashboard');

    // Notification: Return created (non-blocking)
    NotificationService.create({
      shopId: ctx.shopId,
      type: 'RETURN_CREATED',
      severity: 'WARNING',
      title: `คืนสินค้า ${result.returnNumber}`,
      message: `คืนเงิน ${result.refundAmount} บาท`,
      link: `/returns/${result.id}`,
    }).catch(() => {});

    return {
      success: true,
      message: `บันทึกการคืนสินค้า ${result.returnNumber} สำเร็จ (คืนเงิน ${result.refundAmount} บาท)`,
      data: result,
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message };
    }
    return { success: false, message: error.message || 'เกิดข้อผิดพลาด' };
  }
}

/**
 * ดูรายการคืนสินค้าทั้งหมดของร้าน
 */
export async function getReturns(options?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const ctx = await requirePermission('RETURN_VIEW');
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = { shopId: ctx.shopId };

  if (options?.search) {
    where.OR = [
      { returnNumber: { contains: options.search, mode: 'insensitive' } },
      { reason: { contains: options.search, mode: 'insensitive' } },
      { sale: { invoiceNumber: { contains: options.search, mode: 'insensitive' } } },
    ];
  }

  const [data, total] = await Promise.all([
    db.return.findMany({
      where,
      include: {
        sale: { select: { invoiceNumber: true } },
        user: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.return.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: data.map(r => ({
      ...r,
      refundAmount: toNumber(r.refundAmount),
      items: r.items.map(ri => ({
        ...ri,
        refundPerUnit: toNumber(ri.refundPerUnit),
        refundAmount: toNumber(ri.refundAmount),
      })),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * ดูรายละเอียดการคืนสินค้า
 */
export async function getReturnById(returnId: string) {
  const ctx = await requirePermission('RETURN_VIEW');

  const returnRecord = await db.return.findFirst({
    where: { id: returnId, shopId: ctx.shopId },
    include: {
      sale: {
        select: {
          invoiceNumber: true,
          date: true,
          customerName: true,
          customer: { select: { name: true, phone: true } },
        },
      },
      user: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true } },
        },
      },
    },
  });

  if (!returnRecord) return null;

  return {
    ...returnRecord,
    refundAmount: toNumber(returnRecord.refundAmount),
    items: returnRecord.items.map(ri => ({
      ...ri,
      refundPerUnit: toNumber(ri.refundPerUnit),
      refundAmount: toNumber(ri.refundAmount),
    })),
  };
}
