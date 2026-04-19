import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { StockService } from './stock.service';
import { NotificationService } from './notification.service';
import {
  ServiceError,
  RequestContext,
  DocumentType,
} from '@/types/domain';
import {
  SerializedReturn,
  SerializedReturnItem
} from '@/types/serialized';
import { money, toNumber, calcSubtotal } from '@/lib/money';
import { AuditService } from './audit.service';
import { RETURN_AUDIT_POLICIES } from './return.policy';
import { SequenceService } from './sequence.service';
import { serializeReturn, serializeReturnItem } from '@/lib/mappers';

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
   * สร้างรายการคืนสินค้า
   */
  async create(input: CreateReturnInput, ctx: RequestContext, tx?: Prisma.TransactionClient): Promise<SerializedReturn> {
    const saleMatch = await db.sale.findFirst({
      where: { id: input.saleId, shopId: ctx.shopId },
      select: { invoiceNumber: true }
    });
    if (!saleMatch) throw new ServiceError('ไม่พบบิลขาย');

    return AuditService.runWithAudit(
      ctx,
      RETURN_AUDIT_POLICIES.CREATE('PENDING_RET', saleMatch.invoiceNumber),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const sale = await prisma.sale.findFirst({
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
              throw new ServiceError(`สินค้ารายการ "${saleItem.productId}" คืนได้สูงสุด ${maxReturnable} ชิ้น`);
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

          const returnNumber = await SequenceService.generate(ctx, DocumentType.RETURN, prisma);

          const returnRecord = await prisma.return.create({
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

          // Stock restoration logic
          await StockService.recordMovements(
            ctx,
            returnItemsData.map(item => ({
              productId: item.productId,
              type: 'RETURN' as const,
              quantity: item.quantity,
              userId: ctx.userId,
              shopId: ctx.shopId,
              returnId: returnRecord.id,
              saleId: input.saleId,
              note: `คืนสินค้า ${returnRecord.returnNumber} (${input.reason})`,
            })),
            prisma
          );

          let totalReturnCost = 0;
          for (const item of input.items) {
            const saleItem = sale.items.find(si => si.id === item.saleItemId);
            if (saleItem) {
              const costPerUnit = toNumber(saleItem.costPrice);
              totalReturnCost = money.add(totalReturnCost, calcSubtotal(item.quantity, costPerUnit));
            }
          }

          const profitAdjustment = money.subtract(totalRefund, totalReturnCost);

          await prisma.sale.update({
            where: { id: input.saleId },
            data: {
              netAmount: { decrement: totalRefund },
              totalCost: { decrement: totalReturnCost },
              profit: { decrement: profitAdjustment },
            },
          });

          // Notification (Async)
          NotificationService.create({
            shopId: ctx.shopId,
            type: 'RETURN_CREATED',
            severity: 'WARNING',
            title: `คืนสินค้า ${returnRecord.returnNumber}`,
            message: `คืนเงิน ${totalRefund} บาท`,
            link: `/returns/${returnRecord.id}`,
          }).catch(() => { });

          return serializeReturn(returnRecord);
        });
      }
    );
  },

  /**
   * ดูรายการคืนสินค้าทั้งหมดของร้าน
   */
  async getList(options: { page?: number; limit?: number; search?: string; }, ctx: RequestContext) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReturnWhereInput = { shopId: ctx.shopId };

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
        ...serializeReturn(r),
        items: (r as any).items.map((ri: any) => serializeReturnItem(ri)),
        sale: (r as any).sale,
        user: (r as any).user
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
      ...serializeReturn(returnRecord),
      items: (returnRecord as any).items.map((ri: any) => serializeReturnItem(ri)),
      sale: (returnRecord as any).sale,
      user: (returnRecord as any).user
    };
  }
};
