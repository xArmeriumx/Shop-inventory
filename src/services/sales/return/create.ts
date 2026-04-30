import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import {
  ServiceError,
  RequestContext,
  DocumentType,
  MutationResult,
} from '@/types/domain';
import {
  SerializedReturn,
} from '@/types/serialized';
import { money, toNumber, calcSubtotal } from '@/lib/money';
import { AuditService } from '@/services/core/system/audit.service';
import { RETURN_AUDIT_POLICIES } from '@/policies/sales/return.policy';
import { SequenceService } from '@/services/core/system/sequence.service';
import { serializeReturn } from '@/lib/mappers';
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

export const ReturnCreate = {
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
              warehouseId: item.warehouseId || (saleItem as any).warehouseId || null,
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
  }
};
