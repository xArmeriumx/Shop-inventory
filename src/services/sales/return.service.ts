import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { StockService } from '@/services/inventory/stock.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { NotificationService } from '@/services/core/intelligence/notification.service';
import {
  ServiceError,
  RequestContext,
  DocumentType,
  MutationResult,
  PaginatedResult,
} from '@/types/domain';
import { paginatedQuery } from '@/lib/pagination';
import {
  SerializedReturn,
  SerializedReturnItem
} from '@/types/serialized';
import { money, toNumber, calcSubtotal } from '@/lib/money';
import { AuditService } from '@/services/core/system/audit.service';
import { RETURN_AUDIT_POLICIES } from '@/policies/sales/return.policy';
import { SequenceService } from '@/services/core/system/sequence.service';
import { serializeReturn, serializeReturnItem } from '@/lib/mappers';
import { SALES_TAGS, INVENTORY_TAGS, RETURNS_TAGS } from '@/config/cache-tags';

export interface ReturnItemInput {
  saleItemId: string;
  productId: string;
  quantity: number;
  refundPerUnit: number;
  warehouseId?: string | null;
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
  async create(input: CreateReturnInput, ctx: RequestContext, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedReturn>> {
    const saleMatch = await db.sale.findFirst({
      where: { id: input.saleId, shopId: ctx.shopId },
      select: { invoiceNumber: true }
    });
    if (!saleMatch) throw new ServiceError('ไม่พบบิลขาย');

    const result = await AuditService.runWithAudit(
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
              warehouseId: item.warehouseId || (saleItem as any).warehouseId || null, // Priority: Input > Origin
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
          for (const item of returnItemsData) {
            await StockEngine.executeMovement(ctx, {
              warehouseId: item.warehouseId || (await StockEngine.resolveWarehouse(ctx, undefined, prisma)),
              productId: item.productId,
              delta: item.quantity,
              type: 'RETURN',
              note: `คืนสินค้า ${returnRecord.returnNumber} (${input.reason})`,
              returnId: returnRecord.id,
              saleId: input.saleId,
            }, prisma);
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

          await prisma.sale.update({
            where: { id: input.saleId },
            data: {
              netAmount: { decrement: totalRefund },
              totalCost: { decrement: totalReturnCost },
              profit: { decrement: profitAdjustment },
            },
          });

          // ERP: Automated Financial Posting (Phase 6)
          const { PostingService } = await import('@/services/accounting/posting-engine.service');
          await PostingService.postSalesReturn(ctx, returnRecord, totalReturnCost, prisma);

          return serializeReturn(returnRecord);
        });
      }
    );

    const affectedTags: string[] = [RETURNS_TAGS.LIST, SALES_TAGS.DETAIL(input.saleId), SALES_TAGS.LIST];
    input.items.forEach(item => {
      affectedTags.push(INVENTORY_TAGS.STOCK(item.productId));
    });

    return {
      data: result,
      affectedTags
    };
  },

  /**
   * ดูรายการคืนสินค้าทั้งหมดของร้าน
   */
  async getList(options: { page?: number; limit?: number; search?: string; }, ctx: RequestContext): Promise<PaginatedResult<any>> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const where: Prisma.ReturnWhereInput = { shopId: ctx.shopId };

    if (options?.search) {
      where.OR = [
        { returnNumber: { contains: options.search, mode: 'insensitive' } },
        { reason: { contains: options.search, mode: 'insensitive' } },
        { sale: { invoiceNumber: { contains: options.search, mode: 'insensitive' } } },
      ];
    }

    const result = await paginatedQuery(db.return as any, {
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
      page,
      limit,
    });

    return {
      ...result,
      data: result.data.map((r: any) => ({
        ...serializeReturn(r),
        items: ((r as any).items || []).map((ri: any) => serializeReturnItem(ri)),
        sale: (r as any).sale || null,
        user: (r as any).user || null
      })),
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
      items: ((returnRecord as any).items || []).map((ri: any) => serializeReturnItem(ri)),
      sale: (returnRecord as any).sale || null,
      user: (returnRecord as any).user || null
    };
  }
};
