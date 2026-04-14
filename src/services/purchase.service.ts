import { db } from '@/lib/db';
import { Prisma, Purchase } from '@prisma/client';
import { PurchaseInput } from '@/schemas/purchase';
import { StockService } from './stock.service';
import { ServiceError, RequestContext } from './product.service';
import { money, toNumber, calcSubtotal } from '@/lib/money';
import { logger } from '@/lib/logger';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';

export interface GetPurchasesParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}

export const CANCEL_PURCHASE_REASONS = {
  WRONG_ENTRY: 'บันทึกผิดพลาด',
  SUPPLIER_ISSUE: 'ปัญหาจากผู้จำหน่าย',
  DAMAGED: 'สินค้าชำรุด',
  OTHER: 'อื่นๆ',
} as const;

export interface CancelPurchaseInput {
  id: string;
  reasonCode: string;
  reasonDetail?: string;
}

const MAX_PURCHASE_RETRIES = 5;

/**
 * Generate a unique purchase number: PUR-00001, PUR-00002, ...
 */
async function generatePurchaseNumber(shopId: string, tx: Prisma.TransactionClient): Promise<string> {
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

  throw new ServiceError('ไม่สามารถสร้างเลข Purchase ได้ กรุณาลองใหม่');
}

export const PurchaseService = {
  /**
   * ดึงข้อมูลการซื้อทั้งหมด (Pagination)
   */
  async getList(params: GetPurchasesParams = {}, ctx: RequestContext) {
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod } = params;

    const searchFilter = buildSearchFilter(search, ['notes']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where = {
      shopId: ctx.shopId,
      ...(searchFilter && searchFilter),
      ...(dateFilter && { date: dateFilter }),
      ...(paymentMethod && { paymentMethod }),
    };

    const result = await paginatedQuery<any>(db.purchase as any, {
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        supplier: { select: { name: true } },
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
  },

  /**
   * ดึงข้อมูลการซื้อตาม ID
   */
  async getById(id: string, ctx: RequestContext) {
    const purchase = await db.purchase.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        supplier: true,
      },
    });

    if (!purchase) {
      throw new ServiceError('ไม่พบข้อมูลการซื้อ');
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
  },

  /**
   * สร้างการสั่งซื้อเข้าร้าน พร้อมอัปเดตสต็อกและต้นทุน (FIFO / Weighted Avg concept applied here)
   */
  async create(ctx: RequestContext, payload: PurchaseInput, tx?: Prisma.TransactionClient): Promise<any> {
    const { items, ...purchaseData } = payload;
    
    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    const executeTransaction = async (prismaTx: Prisma.TransactionClient) => {
      const totalCost = items.reduce(
        (sum, item) => money.add(sum, calcSubtotal(item.quantity, item.costPrice)),
        0
      );

      const purchaseNumber = await generatePurchaseNumber(ctx.shopId, prismaTx);

      const newPurchase = await prismaTx.purchase.create({
        data: {
          ...purchaseData,
          purchaseNumber,
          date: purchaseData.date ? new Date(purchaseData.date) : new Date(),
          userId: ctx.userId,
          shopId: ctx.shopId,
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
        include: { items: true },
      });

      for (const item of items) {
        await StockService.recordMovement({
          productId: item.productId,
          type: 'PURCHASE',
          quantity: item.quantity,
          userId: ctx.userId,
          shopId: ctx.shopId,
          purchaseId: newPurchase.id,
          note: `ซื้อสินค้า`,
          date: newPurchase.date,
          tx: prismaTx,
        });

        await prismaTx.product.update({
          where: { id: item.productId },
          data: { costPrice: item.costPrice },
        });
      }

      return newPurchase;
    };

    if (tx) {
      return executeTransaction(tx);
    } else {
      return db.$transaction(executeTransaction);
    }
  },

  /**
   * ยกเลิกการซื้อ (คืนสต็อก และลดยอดใช้จ่าย)
   */
  async cancel(input: CancelPurchaseInput, ctx: RequestContext) {
    const { id, reasonCode, reasonDetail } = input;

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    });
    const userName = user?.name || 'Unknown';

    if (!reasonCode) throw new ServiceError('กรุณาเลือกเหตุผลในการยกเลิก');
    if (reasonCode === 'OTHER' && !reasonDetail?.trim()) throw new ServiceError('กรุณากรอกรายละเอียดเหตุผล');

    const cancelReason = reasonCode === 'OTHER'
      ? `${CANCEL_PURCHASE_REASONS.OTHER}: ${reasonDetail}`
      : (CANCEL_PURCHASE_REASONS as Record<string, string>)[reasonCode] || reasonCode;

    await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, shopId: ctx.shopId },
        include: { items: { include: { product: true } } },
      });

      if (!purchase) throw new ServiceError('ไม่พบข้อมูลการซื้อ');
      if (purchase.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

      for (const item of purchase.items) {
        const newStock = item.product.stock - item.quantity;
        if (newStock < 0) {
          throw new ServiceError(
            `ไม่สามารถยกเลิกได้: สต็อก ${item.product.name} จะติดลบ (คงเหลือ ${item.product.stock}, ต้องหัก ${item.quantity})`
          );
        }
      }

      for (const item of purchase.items) {
        await StockService.recordMovement({
          productId: item.productId,
          type: 'PURCHASE_CANCEL',
          quantity: -item.quantity,
          userId: ctx.userId,
          shopId: ctx.shopId,
          purchaseId: purchase.id,
          note: `ยกเลิกการซื้อ - ${cancelReason}`,
          date: new Date(),
          tx,
        });

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
      }

      await tx.purchase.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: userName,
          cancelReason,
        },
      });
    });
  }
};
