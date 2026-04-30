/**
 * purchase-receive.use-case.ts — Receive operations
 */
import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { PURCHASE_AUDIT_POLICIES } from '@/policies/purchases/purchase.policy';
import { StockService } from '@/services/inventory/stock.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { PURCHASE_TAGS, INVENTORY_TAGS } from '@/config/cache-tags';
import { money } from '@/lib/money';
import { RequestContext, ServiceError, MutationResult, PurchaseStatus } from '@/types/domain';

export const PurchaseReceiveUseCase = {
  async allocateCharges(purchaseId: string, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const purchase = await tx.purchase.findFirst({
      where: { id: purchaseId, shopId: ctx.shopId },
      include: {
        items: {
          include: {
            product: {
              include: { categoryRef: true }
            }
          }
        }
      },
    });

    if (!purchase) return;

    const chargeItems = purchase.items.filter(item => {
      const metadata = item.product?.categoryRef?.metadata as any;
      return metadata?.isCharge === true;
    });

    const productItems = purchase.items.filter(item => {
      const metadata = item.product?.categoryRef?.metadata as any;
      return !(metadata?.isCharge === true);
    });

    if (chargeItems.length === 0 || productItems.length === 0) return;

    const totalCharges = chargeItems.reduce((sum, item) => money.add(sum, Number(item.subtotal)), 0);
    const totalProductValue = productItems.reduce((sum, item) => money.add(sum, Number(item.subtotal)), 0);

    if (totalProductValue <= 0) return;

    await AuditService.runWithAudit(
      ctx,
      {
        ...PURCHASE_AUDIT_POLICIES.CHARGE_ALLOCATION(purchase?.purchaseNumber || 'Unknown', totalCharges),
        targetId: purchaseId,
      },
      async () => {
        for (const item of productItems) {
          const itemRatio = Number(item.subtotal) / totalProductValue;
          const allocatedAmount = totalCharges * itemRatio;

          const newSubtotal = Number(item.subtotal) + allocatedAmount;
          const newUnitPrice = newSubtotal / item.quantity;

          await tx.purchaseItem.update({
            where: { id: item.id },
            data: {
              costPrice: newUnitPrice,
              subtotal: newSubtotal
            }
          });
        }
      }
    );
  },

  async receivePurchase(purchaseId: string, ctx: RequestContext, warehouseId?: string): Promise<MutationResult<any>> {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    const purchaseRef = await db.purchase.findFirst({ where: { id: purchaseId, shopId: ctx.shopId } });
    if (!purchaseRef) throw new ServiceError('ไม่พบข้อมูลการสั่งซื้อ');

    const result = await AuditService.runWithAudit(
      ctx,
      PURCHASE_AUDIT_POLICIES.RECEIVE(purchaseRef.purchaseNumber!),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          await PurchaseReceiveUseCase.allocateCharges(purchaseId, ctx, prisma);
          const fullPurchase = await prisma.purchase.findFirst({
            where: { id: purchaseId, shopId: ctx.shopId },
            include: { items: true },
          });

          if (!fullPurchase) throw new ServiceError('ไม่พบข้อมูลการสั่งซื้อ');
          if (fullPurchase.status === PurchaseStatus.RECEIVED) throw new ServiceError('รายการนี้ได้รับสินค้าไปแล้ว');

          const resolvedWhId = await StockEngine.resolveWarehouse(ctx, warehouseId, prisma);

          const productIds = fullPurchase.items.map(item => item.productId);
          const currentProducts = await prisma.product.findMany({
            where: { id: { in: productIds }, shopId: ctx.shopId },
            select: { id: true, stock: true, costPrice: true },
          });
          const productMap = new Map(currentProducts.map(p => [p.id, p]));

          await StockService.recordMovements(
            ctx,
            fullPurchase.items.map(item => ({
              productId: item.productId,
              warehouseId: resolvedWhId,
              type: 'PURCHASE' as const,
              quantity: item.quantity,
              userId: ctx.userId,
              shopId: ctx.shopId,
              purchaseId: fullPurchase.id,
              note: `รับสินค้าจากการสั่งซื้อ: ${fullPurchase.purchaseNumber}`,
              date: new Date(),
            })),
            prisma
          );

          await Promise.all(fullPurchase.items.map(item => {
            const product = productMap.get(item.productId);
            if (!product) return Promise.resolve();
            const currentStock = Number(product.stock) || 0;
            const currentCost = Number(product.costPrice) || 0;
            const newQty = item.quantity;
            const newCost = Number(item.costPrice);

            const totalQty = Math.max(1, currentStock + newQty);
            const weightedCost = ((currentStock * currentCost) + (newQty * newCost)) / totalQty;

            return prisma.product.update({ where: { id: item.productId, shopId: ctx.shopId }, data: { costPrice: Number(weightedCost.toFixed(2)) } });
          }));

          const updated = await prisma.purchase.update({
            where: { id: purchaseId },
            data: { status: PurchaseStatus.RECEIVED, receivedAt: new Date(), receivedBy: ctx.userId },
            include: { items: true }
          });

          const { PostingService } = await import('../../accounting/posting-engine.service');
          await PostingService.postPurchaseInventory(ctx, updated, prisma);

          return updated;
        });
      }
    );

    const affectedTags = [PURCHASE_TAGS.LIST, PURCHASE_TAGS.DETAIL(purchaseId), PURCHASE_TAGS.ORDERS, INVENTORY_TAGS.LIST];
    result.items.forEach((item: { productId: string }) => {
      affectedTags.push(INVENTORY_TAGS.STOCK(item.productId));
      affectedTags.push(INVENTORY_TAGS.DETAIL(item.productId));
    });

    return {
      data: result,
      affectedTags
    };
  }
};
