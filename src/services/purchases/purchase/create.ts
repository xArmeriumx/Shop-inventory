/**
 * purchase-create.use-case.ts — Creation and state transition operations
 */
import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { PURCHASE_AUDIT_POLICIES } from '@/policies/purchases/purchase.policy';
import { StockService } from '@/services/inventory/stock.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { PURCHASE_TAGS } from '@/config/cache-tags';
import { money, calcSubtotal } from '@/lib/money';
import { serializePurchase } from '@/lib/mappers';
import { RequestContext, ServiceError, MutationResult, DocumentType, PurchaseStatus } from '@/types/domain';
import { SerializedPurchase } from '@/types/serialized';
import { PurchaseInput } from '@/schemas/purchases/purchase.schema';
import { PurchaseRequestInput } from '@/types/service-contracts';

export const PurchaseCreateUseCase = {
  async checkMOQ(items: { productId: string; quantity: number }[], ctx: RequestContext, supplierId?: string) {
    const productIds = items.map(i => i.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds }, shopId: ctx.shopId },
      select: { id: true, name: true, moq: true },
    });

    let supplierProducts: any[] = [];
    if (supplierId) {
      supplierProducts = await db.supplierProduct.findMany({
        where: {
          supplierId,
          productId: { in: productIds },
          shopId: ctx.shopId,
          deletedAt: null
        },
        select: { productId: true, moq: true }
      });
    }

    const supplierMoqMap = new Map(supplierProducts.map(sp => [sp.productId, sp.moq]));

    const failed = [];
    for (const item of items) {
      const p = products.find(prod => prod.id === item.productId);
      if (!p) continue;

      const sMoq = supplierMoqMap.get(item.productId);
      const effectiveMoq = (sMoq !== undefined && sMoq !== null) ? sMoq : (p.moq || 0);

      if (effectiveMoq > 0 && item.quantity < effectiveMoq) {
        failed.push({
          productId: item.productId,
          productName: p.name,
          requestedQty: item.quantity,
          moq: effectiveMoq,
        });
      }
    }
    return failed;
  },

  async create(ctx: RequestContext, payload: PurchaseInput, tx?: Prisma.TransactionClient): Promise<MutationResult<SerializedPurchase>> {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    const { items, ...purchaseData } = payload;

    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    const moqFailures = await PurchaseCreateUseCase.checkMOQ(items, ctx, purchaseData.supplierId || undefined);
    if (moqFailures.length > 0) {
      const messages = moqFailures.map(f => `"${f.productName}" สั่ง ${f.requestedQty} ชิ้น (ขั้นต่ำคือ ${f.moq})`).join(', ');
      throw new ServiceError(`ไม่ถึงยอดสั่งขั้นต่ำ (MOQ): ${messages}`);
    }

    const result = await AuditService.runWithAudit(
      ctx,
      PURCHASE_AUDIT_POLICIES.CREATE('New Purchase'),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const productIds = items.map(i => i.productId);
          const products = await prisma.product.findMany({
            where: { id: { in: productIds }, shopId: ctx.shopId },
            select: { id: true, packagingQty: true }
          });
          const productPackMap = new Map(products.map(p => [p.id, p.packagingQty]));

          const totalCost = items.reduce((sum, item) => money.add(sum, calcSubtotal(item.quantity, item.costPrice)), 0);
          const purchaseNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_ORDER, prisma, {
            purchaseType: purchaseData.purchaseType as any,
          });

          const newPurchase = await prisma.purchase.create({
            data: {
              ...purchaseData,
              purchaseNumber,
              date: purchaseData.date ? new Date(purchaseData.date) : new Date(),
              userId: ctx.userId,
              memberId: ctx.memberId || null,
              shopId: ctx.shopId,
              totalCost,
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  packagingQty: productPackMap.get(item.productId) || 1,
                  costPrice: item.costPrice,
                  subtotal: calcSubtotal(item.quantity, item.costPrice),
                })),
              },
            } as any,
            include: { items: true },
          });

          await StockService.recordMovements(
            ctx,
            items.map(item => ({
              productId: item.productId,
              type: 'PURCHASE' as const,
              quantity: item.quantity,
              userId: ctx.userId,
              shopId: ctx.shopId,
              purchaseId: newPurchase.id,
              note: `ซื้อสินค้า: ${newPurchase.purchaseNumber}`,
              date: newPurchase.date,
            })),
            prisma
          );

          return serializePurchase(newPurchase);
        });
      }
    );

    return {
      data: result,
      affectedTags: [PURCHASE_TAGS.LIST, PURCHASE_TAGS.ORDERS]
    };
  },

  async createRequest(payload: PurchaseRequestInput, ctx: RequestContext): Promise<MutationResult<{ id: string; requestNumber: string }>> {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    const result = await AuditService.runWithAudit(
      ctx,
      PURCHASE_AUDIT_POLICIES.CREATE_REQUEST('New PR'),
      async () => {
        return await runInTransaction(undefined, async (prisma) => {
          const { items, purchaseType, notes, supplierId } = payload;

          const productIds = items.map(i => i.productId);
          const products = await prisma.product.findMany({
            where: { id: { in: productIds }, shopId: ctx.shopId },
            select: { id: true, packagingQty: true }
          });
          const productPackMap = new Map(products.map(p => [p.id, p.packagingQty]));

          const requestNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_REQUEST, prisma, {
            purchaseType: payload.purchaseType,
          });

          const totalCost = items.reduce(
            (sum, item) => money.add(sum, calcSubtotal(item.quantity, item.costPrice)),
            0
          );

          const pr = await prisma.purchase.create({
            data: {
              purchaseNumber: requestNumber,
              purchaseType: purchaseType,
              docType: 'REQUEST',
              status: PurchaseStatus.DRAFT,
              totalCost: totalCost,
              notes: notes || null,
              supplierId: supplierId || null,
              userId: ctx.userId,
              shopId: ctx.shopId,
              items: {
                create: items.map(item => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  packagingQty: productPackMap.get(item.productId) || 1,
                  costPrice: item.costPrice,
                  subtotal: calcSubtotal(item.quantity, item.costPrice),
                })),
              },
            },
          });

          return { id: pr.id, requestNumber: pr.purchaseNumber! };
        });
      }
    );

    return {
      data: result,
      affectedTags: [PURCHASE_TAGS.LIST, PURCHASE_TAGS.REQUESTS]
    };
  },

  async approveRequest(prId: string, ctx: RequestContext): Promise<MutationResult<any>> {
    Security.requirePermission(ctx, 'PURCHASE_UPDATE');
    const pr = await db.purchase.findFirst({ where: { id: prId, shopId: ctx.shopId } });
    if (!pr) throw new ServiceError('ไม่พบใบขอซื้อ');
    if (pr.status === PurchaseStatus.APPROVED) throw new ServiceError('ใบขอซื้อนี้ได้รับการอนุมัติแล้ว');
    if (pr.status === 'CANCELLED') throw new ServiceError('ไม่สามารถอนุมัติใบขอซื้อที่ถูกยกเลิกแล้ว');

    const result = await AuditService.runWithAudit(
      ctx,
      {
        ...PURCHASE_AUDIT_POLICIES.APPROVE(pr.purchaseNumber ?? prId),
        targetId: prId,
        beforeSnapshot: () => ({ status: pr.status }),
      },
      async () => {
        const updated = await db.purchase.update({
          where: { id: prId, shopId: ctx.shopId },
          data: { status: PurchaseStatus.APPROVED },
        });
        return updated;
      }
    );

    return {
      data: result,
      affectedTags: [PURCHASE_TAGS.LIST, PURCHASE_TAGS.DETAIL(prId), PURCHASE_TAGS.REQUESTS]
    };
  },

  async convertToPO(prId: string, ctx: RequestContext): Promise<MutationResult<{ id: string; poNumber: string }>> {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    const pr = await db.purchase.findFirst({ where: { id: prId, shopId: ctx.shopId } });
    if (!pr) throw new ServiceError('ไม่พบใบขอซื้อ');

    const result = await AuditService.runWithAudit(
      ctx,
      PURCHASE_AUDIT_POLICIES.CONVERT_PR_TO_PO(pr.purchaseNumber!, 'PO-PENDING'),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          const fullPR = await prisma.purchase.findFirst({
            where: { id: prId, shopId: ctx.shopId },
            include: { items: true },
          });
          if (!fullPR) throw new ServiceError('ไม่พบใบขอซื้อ');
          if (fullPR.status !== PurchaseStatus.APPROVED && fullPR.status !== PurchaseStatus.DRAFT) {
            throw new ServiceError('ใบขอซื้อต้องได้รับการอนุมัติก่อน');
          }

          if (!fullPR.supplierId) {
            throw new ServiceError(
              'ไม่สามารถออก PO ได้เนื่องจากยังไม่ได้ระบุผู้จำหน่ายในใบขอซื้อ',
              undefined,
              { label: 'ระบุผู้จำหน่ายตอนนี้', href: `/purchases/${prId}` }
            );
          }

          const poNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_ORDER, prisma, {
            purchaseType: fullPR.purchaseType as any,
          });

          const po = await prisma.purchase.create({
            data: {
              purchaseNumber: poNumber,
              purchaseType: fullPR.purchaseType,
              docType: 'ORDER',
              status: PurchaseStatus.ORDERED,
              totalCost: fullPR.totalCost,
              notes: fullPR.notes,
              supplierId: fullPR.supplierId,
              userId: ctx.userId,
              shopId: ctx.shopId,
              requestNumber: fullPR.purchaseNumber,
              linkedPRId: fullPR.id,
              items: {
                create: fullPR.items.map(item => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  packagingQty: (item as any).packagingQty || 1,
                  costPrice: item.costPrice,
                  subtotal: item.subtotal,
                })),
              },
            },
          });

          await prisma.purchase.update({
            where: { id: fullPR.id, shopId: ctx.shopId },
            data: { status: PurchaseStatus.ORDERED },
          });

          return { id: po.id, poNumber: po.purchaseNumber! };
        });
      }
    );

    return {
      data: result,
      affectedTags: [
        PURCHASE_TAGS.LIST,
        PURCHASE_TAGS.DETAIL(prId),
        PURCHASE_TAGS.REQUESTS,
        PURCHASE_TAGS.ORDERS
      ]
    };
  },

  async quickAssignSupplier(ids: string[], supplierId: string, ctx: RequestContext): Promise<MutationResult<{ count: number }>> {
    Security.requirePermission(ctx, 'PURCHASE_UPDATE');
    if (!ids.length) return { data: { count: 0 }, affectedTags: [] };

    const updateCount = await AuditService.runWithAudit(
      ctx,
      {
        action: 'PURCHASE_QUICK_ASSIGN',
        targetType: 'Purchase',
        note: `มอบหมายผู้จำหน่าย ID: ${supplierId} ให้กับ ${ids.length} รายการ`,
      },
      async () => {
        const result = await db.purchase.updateMany({
          where: { id: { in: ids }, shopId: ctx.shopId, status: 'DRAFT', supplierId: null },
          data: { supplierId },
        });
        return result.count;
      }
    );

    return {
      data: { count: updateCount },
      affectedTags: [PURCHASE_TAGS.LIST, PURCHASE_TAGS.REQUESTS]
    };
  },

  async createBulkDraftPRs(entries: { productId: string, quantity: number, supplierId?: string }[], ctx: RequestContext): Promise<MutationResult<{ createdCount: number }>> {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    if (!entries.length) return { data: { createdCount: 0 }, affectedTags: [] };

    const groupedBySupplier = new Map<string | 'NONE', typeof entries>();
    entries.forEach(item => {
      const key = item.supplierId || 'NONE';
      if (!groupedBySupplier.has(key)) groupedBySupplier.set(key, []);
      groupedBySupplier.get(key)!.push(item);
    });

    const result = await runInTransaction(undefined, async (prisma) => {
      let prCount = 0;
      for (const [supplierId, items] of Array.from(groupedBySupplier.entries())) {
        const actualSupplierId = supplierId === 'NONE' ? null : supplierId;
        const productIds = items.map(i => i.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds }, shopId: ctx.shopId },
          select: { id: true, costPrice: true, packagingQty: true }
        });
        const productMap = new Map(products.map(p => [p.id, p]));

        const requestNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_REQUEST, prisma, {
          purchaseType: 'LOCAL',
        });

        await prisma.purchase.create({
          data: {
            purchaseNumber: requestNumber,
            purchaseType: 'LOCAL',
            docType: 'REQUEST',
            status: PurchaseStatus.DRAFT,
            supplierId: actualSupplierId,
            userId: ctx.userId,
            shopId: ctx.shopId,
            totalCost: items.reduce((sum, i) => {
              const p = productMap.get(i.productId);
              return sum + (i.quantity * Number(p?.costPrice || 0));
            }, 0),
            items: {
              create: items.map(item => {
                const p = productMap.get(item.productId);
                const cost = Number(p?.costPrice || 0);
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                  costPrice: cost,
                  subtotal: item.quantity * cost,
                  packagingQty: p?.packagingQty || 1,
                };
              }),
            },
          },
        });
        prCount++;
      }
      return { createdCount: prCount };
    });

    return {
      data: result,
      affectedTags: [PURCHASE_TAGS.LIST, PURCHASE_TAGS.REQUESTS]
    };
  }
};
