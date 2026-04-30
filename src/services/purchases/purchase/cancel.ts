/**
 * purchase-cancel.use-case.ts — Cancel and delete operations
 */
import { db, runInTransaction } from '@/lib/db';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { PURCHASE_AUDIT_POLICIES } from '@/policies/purchases/purchase.policy';
import { JournalService } from '@/services/accounting/journal.service';
import { StockService } from '@/services/inventory/stock.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { PURCHASE_TAGS, INVENTORY_TAGS } from '@/config/cache-tags';
import { RequestContext, ServiceError, MutationResult } from '@/types/domain';

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

export const PurchaseCancelUseCase = {
  async cancel(input: CancelPurchaseInput, ctx: RequestContext): Promise<MutationResult<void>> {
    Security.requirePermission(ctx, 'PURCHASE_VOID');
    const { id, reasonCode, reasonDetail } = input;

    if (!reasonCode) throw new ServiceError('กรุณาเลือกเหตุผลในการยกเลิก');
    if (reasonCode === 'OTHER' && !reasonDetail?.trim()) throw new ServiceError('กรุณากรอกรายละเอียดเหตุผล');

    const cancelReason = reasonCode === 'OTHER' ? `${CANCEL_PURCHASE_REASONS.OTHER}: ${reasonDetail}` : (CANCEL_PURCHASE_REASONS as Record<string, string>)[reasonCode] || reasonCode;

    const purchase = await db.purchase.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!purchase) throw new ServiceError('ไม่พบข้อมูลการซื้อ');

    const result = await AuditService.runWithAudit(
      ctx,
      PURCHASE_AUDIT_POLICIES.CANCEL(purchase.purchaseNumber!, cancelReason),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          const relatedJournals = await prisma.journalEntry.findMany({
            where: {
              shopId: ctx.shopId,
              sourceId: id,
              status: 'POSTED'
            }
          });

          for (const journal of relatedJournals) {
            await JournalService.reverseEntry(ctx, journal.id, prisma);
          }

          const fullPurchase = await prisma.purchase.findFirst({
            where: { id, shopId: ctx.shopId },
            include: { items: { include: { product: true } } },
          });

          if (!fullPurchase) throw new ServiceError('ไม่พบข้อมูลการซื้อ');
          if (fullPurchase.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

          const defaultWhId = await StockEngine.resolveWarehouse(ctx, undefined, prisma);
          const productIds = fullPurchase.items.map(i => i.productId);
          const warehouseStocks = await (prisma as any).warehouseStock.findMany({
            where: { productId: { in: productIds }, warehouseId: defaultWhId },
          });
          const whStockMap = new Map<string, number>(warehouseStocks.map((ws: any) => [ws.productId, Number(ws.quantity)]));

          for (const item of fullPurchase.items) {
            const currentQty: number = whStockMap.get(item.productId) ?? 0;
            if (currentQty - Number(item.quantity) < 0) {
              throw new ServiceError(`สต็อก ${item.product.name} ในคลังจะติดลบ (คงเหลือ ${currentQty})`);
            }
          }

          await StockService.recordMovements(
            ctx,
            fullPurchase.items.map(item => ({
              productId: item.productId,
              type: 'PURCHASE_CANCEL' as const,
              quantity: -item.quantity,
              userId: ctx.userId,
              shopId: ctx.shopId,
              purchaseId: fullPurchase.id,
              note: `ยกเลิกการซื้อ - ${cancelReason}`,
              date: new Date(),
            })),
            prisma
          );

          const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
          await prisma.purchase.update({
            where: { id, shopId: ctx.shopId },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: user?.name || 'Unknown', cancelReason },
          });

          return fullPurchase;
        });
      }
    );

    const affectedTags = [PURCHASE_TAGS.LIST, PURCHASE_TAGS.DETAIL(id)];
    result.items.forEach((item: any) => {
      affectedTags.push(INVENTORY_TAGS.STOCK(item.productId));
    });

    return {
      data: undefined,
      affectedTags
    };
  }
};
