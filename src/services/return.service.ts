import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { StockService } from './stock.service';
import { NotificationService } from './notification.service';
import { ServiceError, RequestContext } from './product.service';
import { money, toNumber, calcSubtotal } from '@/lib/money';

const MAX_RETURN_RETRIES = 5;

/**
 * Auto-gen return number: RET-00001, RET-00002, ...
 */
async function generateReturnNumber(tx: Prisma.TransactionClient, shopId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETURN_RETRIES; attempt++) {
    const lastReturn = await tx.return.findFirst({
      where: { shopId },
      orderBy: { returnNumber: 'desc' },
      select: { returnNumber: true },
    });

    const lastNumber = lastReturn?.returnNumber
      ? parseInt(lastReturn.returnNumber.split('-')[1] || '0')
      : 0;

    const newNumber = lastNumber + 1 + attempt;
    const returnNumber = `RET-${String(newNumber).padStart(5, '0')}`;

    const exists = await tx.return.findFirst({
      where: { shopId, returnNumber },
      select: { id: true },
    });

    if (!exists) {
      return returnNumber;
    }
  }

  return `RET-${Date.now()}`;
}

export interface ReturnItemInput {
  saleItemId: string;
  productId: string;
  quantity: number;
  refundPerUnit: number;
}

export interface CreateReturnInput {
  saleId: string;
  reason: string;
  refundMethod: 'CASH' | 'TRANSFER' | 'CREDIT';
  items: ReturnItemInput[];
}

export const ReturnService = {
  /**
   * ดูรายการสินค้าที่คืนได้จากบิลขาย
   */
  async getReturnableSaleItems(saleId: string, ctx: RequestContext) {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId, status: { not: 'CANCELLED' } },
      select: {
        totalAmount: true,
        discountAmount: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            returnItems: { select: { quantity: true } },
          },
        },
      },
    });

    if (!sale) return null;

    const saleTotal = toNumber(sale.totalAmount);
    const saleDiscount = toNumber(sale.discountAmount);
    const billDiscountRatio = saleTotal > 0
      ? money.divide(money.subtract(saleTotal, saleDiscount), saleTotal)
      : 1;

    return (sale.items as any[]).map((item: any) => {
      const alreadyReturned = (item.returnItems as any[]).reduce((sum: number, ri: any) => sum + ri.quantity, 0);
      const maxReturnable = item.quantity - alreadyReturned;
      
      const subtotal = toNumber(item.subtotal);
      const discount = toNumber(item.discountAmount);
      const itemNetPerUnit = item.quantity > 0
        ? money.round(money.divide(money.subtract(subtotal, discount), item.quantity))
        : 0;
      
      const netPerUnit = money.round(money.multiply(itemNetPerUnit, billDiscountRatio));

      return {
        saleItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        originalQuantity: item.quantity,
        alreadyReturned,
        maxReturnable,
        salePrice: toNumber(item.salePrice),
        netPerUnit,
      };
    }).filter(item => item.maxReturnable > 0);
  },

  /**
   * สร้างรายการคืนสินค้า (Atomic: validate → create return → restore stock)
   */
  async create(input: CreateReturnInput, ctx: RequestContext, tx?: Prisma.TransactionClient) {
    const executeTransaction = async (prismaTx: Prisma.TransactionClient) => {
      const sale = await prismaTx.sale.findFirst({
        where: { id: input.saleId, shopId: ctx.shopId, status: { not: 'CANCELLED' } },
        include: {
          items: {
            include: {
              returnItems: { select: { quantity: true } },
            },
          },
        },
      });

      if (!sale) throw new ServiceError('ไม่พบบิลขาย หรือบิลถูกยกเลิกแล้ว');

      let totalRefund = 0;
      const returnItemsData = [];

      for (const item of input.items) {
        const saleItem = sale.items.find(si => si.id === item.saleItemId);
        if (!saleItem) throw new ServiceError(`ไม่พบรายการสินค้า: ${item.saleItemId}`);

        const alreadyReturned = (saleItem.returnItems as any[]).reduce(
          (sum: number, ri: any) => sum + ri.quantity, 0
        );
        const maxReturnable = saleItem.quantity - alreadyReturned;

        if (item.quantity > maxReturnable) {
          throw new ServiceError(`สินค้ารายการ "${item.saleItemId}" คืนได้สูงสุด ${maxReturnable} ชิ้น`);
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

      const returnNumber = await generateReturnNumber(prismaTx, ctx.shopId);

      const returnRecord = await prismaTx.return.create({
        data: {
          returnNumber,
          saleId: input.saleId,
          reason: input.reason,
          refundAmount: totalRefund,
          refundMethod: input.refundMethod,
          status: 'COMPLETED',
          userId: ctx.userId,
          shopId: ctx.shopId,
          items: {
            create: returnItemsData,
          },
        },
        include: { items: true },
      });

      for (const item of returnItemsData) {
        await StockService.recordMovement({
          productId: item.productId,
          type: 'RETURN',
          quantity: item.quantity,
          userId: ctx.userId,
          shopId: ctx.shopId,
          returnId: returnRecord.id,
          saleId: input.saleId,
          note: `คืนสินค้า ${returnNumber} (${input.reason})`,
          tx: prismaTx,
        });
      }

      let totalReturnCost = 0;
      for (const item of input.items) {
        const saleItem = sale.items.find(si => si.id === item.saleItemId);
        if (saleItem) {
          const costPerUnit = toNumber(saleItem.costPrice);
          totalReturnCost = money.add(totalReturnCost, calcSubtotal(item.quantity, costPerUnit));
        }
      }

      const profitAdjustment = money.subtract(totalRefund, totalReturnCost);

      await prismaTx.sale.update({
        where: { id: input.saleId },
        data: {
          netAmount:    { decrement: totalRefund },
          totalCost:    { decrement: totalReturnCost },
          profit:       { decrement: profitAdjustment },
        },
      });

      // 6. Create Notification (Async/Non-blocking)
      NotificationService.create({
        shopId: ctx.shopId,
        type: 'RETURN_CREATED',
        severity: 'WARNING',
        title: `คืนสินค้า ${returnNumber}`,
        message: `คืนเงิน ${toNumber(totalRefund)} บาท`,
        link: `/returns/${returnRecord.id}`,
      }).catch(() => {});

      return returnRecord;
    };

    if (tx) {
      return executeTransaction(tx);
    } else {
      return db.$transaction(executeTransaction);
    }
  },

  /**
   * ดูรายการคืนสินค้าทั้งหมดของร้าน
   */
  async getList(options: { page?: number; limit?: number; search?: string; }, ctx: RequestContext) {
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
      data: data.map((r: any) => ({
        ...r,
        refundAmount: toNumber(r.refundAmount),
        items: (r.items as any[]).map((ri: any) => ({
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
  },

  /**
   * ดูรายละเอียดการคืนสินค้า
   */
  async getById(returnId: string, ctx: RequestContext) {
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
      items: (returnRecord.items as any[]).map((ri: any) => ({
        ...ri,
        refundPerUnit: toNumber(ri.refundPerUnit),
        refundAmount: toNumber(ri.refundAmount),
      })),
    };
  }
};
