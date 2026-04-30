/**
 * sale-fulfillment.use-case.ts — Fulfillment operations (confirm, complete)
 */
import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { StockService } from '@/services/inventory/stock.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { AuditService } from '@/services/core/system/audit.service';
import { SALE_AUDIT_POLICIES } from '@/policies/sales/sale.policy';
import { SALES_TAGS, INVENTORY_TAGS } from '@/config/cache-tags';
import { buildLockData } from '@/lib/lock-helpers';
import {
  RequestContext,
  ServiceError,
  MutationResult,
  SaleStatus,
  BookingStatus,
  DocPaymentStatus,
} from '@/types/domain';

export const SaleFulfillmentUseCase = {
  async confirmOrder(saleId: string, ctx: RequestContext): Promise<MutationResult<void>> {
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    await AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.CONFIRM(sale.invoiceNumber),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          const fullSale = await prisma.sale.findFirst({
            where: { id: saleId, shopId: ctx.shopId },
            include: { items: true, customer: true },
          });

          if (!fullSale) throw new ServiceError('ไม่พบรายการขาย');
          if (fullSale.status !== SaleStatus.DRAFT) throw new ServiceError('รายการนี้ไม่ได้อยู่ในสถานะร่าง');

          await StockService.bulkReserveStock(fullSale.items, ctx, prisma);

          await prisma.sale.update({
            where: { id: saleId, shopId: ctx.shopId },
            data: { status: SaleStatus.CONFIRMED, bookingStatus: BookingStatus.RESERVED },
          });
        });
      }
    );

    return {
      data: undefined,
      affectedTags: [SALES_TAGS.LIST, SALES_TAGS.DETAIL(saleId), SALES_TAGS.DASHBOARD]
    };
  },

  async completeSale(saleId: string, ctx: RequestContext, tx?: Prisma.TransactionClient): Promise<MutationResult<void>> {
    const client = tx || db;
    const sale = await client.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    const result = await AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.COMPLETE(sale.invoiceNumber),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const fullSale = await prisma.sale.findFirst({
            where: { id: saleId, shopId: ctx.shopId },
            include: { items: true, customer: true },
          });

          if (!fullSale) throw new ServiceError('ไม่พบรายการขาย');
          if (fullSale.status === SaleStatus.COMPLETED) return fullSale;

          if (fullSale.paymentStatus === DocPaymentStatus.UNPAID) {
            throw new ServiceError(
              'กรุณายืนยันการชำระเงินก่อนปิดการขาย',
              undefined,
              { label: 'ไปที่หน้าตรวจสอบการชำระเงิน', href: `/sales/${saleId}` }
            );
          }

          const shop = await prisma.shop.findUnique({ where: { id: ctx.shopId }, select: { inventoryMode: true } });
          const isMultiMode = shop?.inventoryMode === 'MULTI';

          if (isMultiMode) {
            const missingWarehouseItems = fullSale.items.filter(item => !(item as any).warehouseId);
            if (missingWarehouseItems.length > 0) {
              throw new ServiceError(
                `ไม่สามารถปิดรายการขายได้ เนื่องจากมีรายการสินค้าที่ยังไม่ได้ระบุคลังสินค้า (พบ ${missingWarehouseItems.length} รายการ)`,
                undefined,
                { label: 'แก้ไขรายการขาย', href: `/sales/${saleId}/edit` }
              );
            }
          }

          for (const item of fullSale.items) {
            await StockEngine.executeMovement(ctx, {
              warehouseId: (item as any).warehouseId || (await StockEngine.resolveWarehouse(ctx, undefined, prisma)),
              productId: item.productId,
              delta: -item.quantity,
              type: 'SALE',
              validation: 'STRICT',
              note: `ขายสินค้า ${fullSale.invoiceNumber}`,
              saleId: fullSale.id,
            }, prisma);
          }

          await prisma.sale.update({
            where: { id: saleId, shopId: ctx.shopId },
            data: {
              status: SaleStatus.COMPLETED,
              bookingStatus: BookingStatus.DEDUCTED,
              ...buildLockData('LOCKED', 'ปิดการขายแล้ว'),
            },
          });

          await (prisma as any).saleStatus.updateMany({
            where: { saleId },
            data: {
              status:        SaleStatus.COMPLETED,
              bookingStatus: BookingStatus.DEDUCTED,
              editLockStatus:'LOCKED',
              lockReason:    'ปิดการขายแล้ว',
            },
          });

          try {
            const fullSaleWithItems = await prisma.sale.findFirst({
              where: { id: saleId },
              include: { items: true }
            });
            if (fullSaleWithItems) {
              const PostingModule = await import('../../accounting/posting-engine.service');
              await PostingModule.PostingService.postCOGS(ctx, fullSaleWithItems, prisma);
            }
          } catch (e) {
            console.error('COGS Posting failed:', e);
          }

          return fullSale;
        });
      },
      tx
    );

    const affectedTags: string[] = [SALES_TAGS.LIST, SALES_TAGS.DETAIL(saleId), SALES_TAGS.DASHBOARD, INVENTORY_TAGS.LIST, INVENTORY_TAGS.LOW_STOCK];
    result.items?.forEach((item: any) => {
      affectedTags.push(INVENTORY_TAGS.STOCK(item.productId));
      affectedTags.push(INVENTORY_TAGS.DETAIL(item.productId));
    });

    return {
      data: undefined,
      affectedTags
    };
  }
};
