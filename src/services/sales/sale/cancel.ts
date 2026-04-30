/**
 * sale-cancel.use-case.ts — Cancel and delete operations
 */
import { db, runInTransaction } from '@/lib/db';
import { Prisma, Permission } from '@prisma/client';
import { StockService } from '@/services/inventory/stock.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { JournalService } from '@/services/accounting/journal.service';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { SALE_AUDIT_POLICIES } from '@/policies/sales/sale.policy';
import { SALE_CANCEL_REASONS, resolveReasonLabel, validateReason } from '@/config/reason-codes';
import { SALES_TAGS, INVENTORY_TAGS } from '@/config/cache-tags';
import {
  RequestContext,
  ServiceError,
  MutationResult,
  SaleStatus,
  BookingStatus,
  EditLockStatus,
} from '@/types/domain';

export interface CancelSaleInput {
  id: string;
  reasonCode: string;
  reasonDetail?: string;
}

export const SaleCancelUseCase = {
  async cancel(input: CancelSaleInput, ctx: RequestContext): Promise<MutationResult<void>> {
    Security.require(ctx, Permission.SALE_CANCEL);
    const { id, reasonCode, reasonDetail } = input;

    if (!reasonCode) throw new ServiceError('กรุณาเลือกเหตุผลในการยกเลิก');
    validateReason(SALE_CANCEL_REASONS, reasonCode, reasonDetail);
    const cancelReason = resolveReasonLabel(SALE_CANCEL_REASONS, reasonCode, reasonDetail);

    const sale = await db.sale.findFirst({
      where: { id, shopId: ctx.shopId },
      select: { invoiceNumber: true, status: true },
    });
    if (!sale) throw new ServiceError('ไม่พบข้อมูลการขาย');
    if (sale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

    const result = await AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.CANCEL(sale.invoiceNumber, cancelReason),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          const userNameResult = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
          const claimResult = await prisma.sale.updateMany({
            where: { id, shopId: ctx.shopId, status: { not: 'CANCELLED' } },
            data: {
              status: 'CANCELLED' as SaleStatus,
              cancelledAt: new Date(),
              cancelledBy: userNameResult?.name || 'System',
              cancelReason,
            },
          });

          await (prisma as any).saleStatus.updateMany({
            where: { saleId: id },
            data: {
              status: 'CANCELLED',
              cancelReason,
              cancelledAt: new Date(),
              cancelledBy: userNameResult?.name || 'System',
            },
          });

          if (claimResult.count === 0) {
            throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว (Concurrent Cancel Conflict)');
          }

          const fullSale = await prisma.sale.findFirst({
            where: { id, shopId: ctx.shopId },
            include: { items: { include: { returnItems: { select: { quantity: true } } } } },
          });
          if (!fullSale) throw new ServiceError('ไม่พบข้อมูลการขาย');

          if ((fullSale as any).editLockStatus === EditLockStatus.LOCKED) {
            await prisma.sale.update({
              where: { id, shopId: ctx.shopId },
              data: { status: 'CONFIRMED' as SaleStatus, cancelledAt: null, cancelledBy: null, cancelReason: null },
            });
            throw new ServiceError((fullSale as any).lockReason || 'เอกสารนี้ถูกล็อก ไม่สามารถยกเลิกได้');
          }

          const relatedJournals = await prisma.journalEntry.findMany({
            where: { shopId: ctx.shopId, sourceId: id, status: 'POSTED' },
          });
          for (const journal of relatedJournals) {
            await JournalService.reverseEntry(ctx, journal.id, prisma);
          }

          const linkedShipments = await prisma.shipment.findMany({
            where: { saleId: id, status: { not: 'CANCELLED' } },
            select: { id: true, shipmentNumber: true },
          });
          for (const linkedShipment of linkedShipments) {
            await prisma.shipment.update({
              where: { id: linkedShipment.id, shopId: ctx.shopId },
              data: { status: 'CANCELLED', notes: `ยกเลิกอัตโนมัติ: Sale ${fullSale.invoiceNumber} ถูกยกเลิก` },
            });
            await prisma.expense.deleteMany({
              where: { shopId: ctx.shopId, category: 'ค่าจัดส่ง', description: { contains: linkedShipment.shipmentNumber } },
            });
          }

          await prisma.return.updateMany({
            where: { saleId: id, shopId: ctx.shopId, status: { not: 'CANCELLED' } },
            data: { status: 'CANCELLED' },
          });

          if (fullSale.bookingStatus === BookingStatus.RESERVED) {
            await Promise.all(fullSale.items.map(item => {
              const alreadyReturned = item.returnItems.reduce((sum: number, ri: any) => sum + ri.quantity, 0);
              const releaseQty = item.quantity - alreadyReturned;
              if (releaseQty > 0) return StockService.releaseStock(item.productId, releaseQty, ctx, prisma, (item as any).warehouseId);
              return Promise.resolve();
            }));
          } else if (fullSale.bookingStatus === BookingStatus.DEDUCTED) {
            for (const item of fullSale.items) {
              const restoreQty = item.quantity - item.returnItems.reduce((sum: number, ri: any) => sum + ri.quantity, 0);
              if (restoreQty > 0) {
                await StockEngine.executeMovement(ctx, {
                  warehouseId: (item as any).warehouseId || (await StockEngine.resolveWarehouse(ctx, undefined, prisma)),
                  productId: item.productId,
                  delta: restoreQty,
                  type: 'SALE_CANCEL',
                  note: `ยกเลิกการขาย ${fullSale.invoiceNumber} - ${cancelReason}`,
                  saleId: fullSale.id,
                }, prisma);
              }
            }
          }

          return fullSale;
        });
      }
    );

    const affectedTags: string[] = [SALES_TAGS.LIST, SALES_TAGS.DETAIL(id), SALES_TAGS.DASHBOARD];
    result.items?.forEach((item: { productId: string }) => {
      affectedTags.push(INVENTORY_TAGS.STOCK(item.productId));
      affectedTags.push(INVENTORY_TAGS.DETAIL(item.productId));
    });

    return {
      data: undefined,
      affectedTags
    };
  },

  async delete(id: string, ctx: RequestContext): Promise<MutationResult<void>> {
    return SaleCancelUseCase.cancel({ id, reasonCode: 'SYSTEM_DELETE', reasonDetail: 'Deleted by user' }, ctx);
  },

  async releaseStock(saleId: string, ctx: RequestContext, tx: Prisma.TransactionClient): Promise<void> {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
      include: { items: true },
    });

    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    if (sale.bookingStatus === BookingStatus.RESERVED) {
      await StockService.bulkReleaseStock(sale.items, ctx, tx);

      await tx.sale.update({
        where: { id: saleId, shopId: ctx.shopId },
        data: { bookingStatus: BookingStatus.NONE },
      });
    }
  }
};
