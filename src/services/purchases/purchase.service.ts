import { db, runInTransaction } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { PurchaseInput } from '@/schemas/purchases/purchase.schema';
import { StockService } from '@/services/inventory/stock.service';
import { money, calcSubtotal } from '@/lib/money';

import {
  RequestContext,
  ServiceError,
  GetPurchasesParams,
  DocumentType,
  PurchaseStatus,
  GetIncompletePurchasesParams,
  PaginatedResult,
} from '@/types/domain';
import {
  SerializedPurchase,
  SerializedPurchaseWithItems
} from '@/types/serialized';
import { IPurchaseService, PurchaseRequestInput } from '@/types/service-contracts';
import { SequenceService } from '@/services/core/system/sequence.service';
import { AuditService } from '@/services/core/system/audit.service';
import { JournalService } from '@/services/accounting/journal.service';
import { PURCHASE_AUDIT_POLICIES } from '@/policies/purchases/purchase.policy';
import { Security } from '@/services/core/iam/security.service';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { serializePurchase, serializePurchaseItem } from '@/lib/mappers';

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

export const PurchaseService: IPurchaseService = {
  /**
   * ดึงข้อมูลการซื้อทั้งหมด (Pagination)
   */
  async getList(params: GetPurchasesParams = {}, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_VIEW');
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod } = params;

    const searchFilter = buildSearchFilter(search, ['notes']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where: Prisma.PurchaseWhereInput = {
      shopId: ctx.shopId,
      ...(searchFilter && searchFilter),
      ...(dateFilter && { date: dateFilter }),
      ...(paymentMethod && { paymentMethod }),
    };

    const result = await paginatedQuery(db.purchase, {
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
      data: result.data.map(p => ({
        ...serializePurchase(p),
        items: (p as any).items.map((i: any) => serializePurchaseItem(i)),
        supplier: (p as any).supplier
      })),
    };
  },

  /**
   * ดึงข้อมูลการซื้อตาม ID
   */
  async getById(id: string, ctx: RequestContext): Promise<SerializedPurchaseWithItems> {
    Security.requirePermission(ctx, 'PURCHASE_VIEW');
    const purchase = await db.purchase.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        supplier: true,
        purchaseTaxLinks: true,
      },
    });

    if (!purchase) {
      throw new ServiceError('ไม่พบข้อมูลการซื้อ');
    }

    const supplierMoq = (purchase as any).supplier?.moq ? Number((purchase as any).supplier.moq) : null;
    const serialized = serializePurchase(purchase) as SerializedPurchaseWithItems & { purchaseTaxLinks: any[] };

    serialized.items = ((purchase as any).items || []).map((i: any) => ({
      ...serializePurchaseItem(i),
      moq: supplierMoq,
    }));

    serialized.supplier = (purchase as any).supplier ? {
      name: (purchase as any).supplier.name,
      phone: (purchase as any).supplier.phone,
      address: (purchase as any).supplier.address,
      taxId: (purchase as any).supplier.taxId,
    } : null;

    serialized.purchaseTaxLinks = (purchase as any).purchaseTaxLinks || [];

    return serialized;
  },

  /**
   * สร้างการสั่งซื้อเข้าร้าน พร้อมอัปเดตสต็อกและต้นทุน
   */
  async create(ctx: RequestContext, payload: PurchaseInput, tx?: Prisma.TransactionClient): Promise<SerializedPurchase> {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    const { items, ...purchaseData } = payload;

    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    const moqFailures = await this.checkMOQ(items, ctx, purchaseData.supplierId || undefined);
    if (moqFailures.length > 0) {
      const messages = moqFailures.map(f => `"${f.productName}" สั่ง ${f.requestedQty} ชิ้น (ขั้นต่ำคือ ${f.moq})`).join(', ');
      throw new ServiceError(`ไม่ถึงยอดสั่งขั้นต่ำ (MOQ): ${messages}`);
    }

    return AuditService.runWithAudit(
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
  },

  /**
   * ยกเลิกการซื้อ (คืนสต็อก และลดยอดใช้จ่าย)
   */
  async cancel(input: CancelPurchaseInput, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_VOID');
    const { id, reasonCode, reasonDetail } = input;

    if (!reasonCode) throw new ServiceError('กรุณาเลือกเหตุผลในการยกเลิก');
    if (reasonCode === 'OTHER' && !reasonDetail?.trim()) throw new ServiceError('กรุณากรอกรายละเอียดเหตุผล');

    const cancelReason = reasonCode === 'OTHER' ? `${CANCEL_PURCHASE_REASONS.OTHER}: ${reasonDetail}` : (CANCEL_PURCHASE_REASONS as Record<string, string>)[reasonCode] || reasonCode;

    const purchase = await db.purchase.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!purchase) throw new ServiceError('ไม่พบข้อมูลการซื้อ');

    await AuditService.runWithAudit(
      ctx,
      PURCHASE_AUDIT_POLICIES.CANCEL(purchase.purchaseNumber!, cancelReason),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          // ERP Rule: Handle related Journal Entries (Financial Integrity)
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

          for (const item of fullPurchase.items) {
            if (item.product.stock - item.quantity < 0) {
              throw new ServiceError(`สต็อก ${item.product.name} จะติดลบ (คงเหลือ ${item.product.stock})`);
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
  },

  async createRequest(payload, ctx) {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
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
  },

  async approveRequest(prId: string, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_UPDATE');
    const pr = await db.purchase.findFirst({ where: { id: prId, shopId: ctx.shopId } });
    if (!pr) throw new ServiceError('ไม่พบใบขอซื้อ');
    if (pr.status === PurchaseStatus.APPROVED) throw new ServiceError('ใบขอซื้อนี้ได้รับการอนุมัติแล้ว');
    if (pr.status === 'CANCELLED') throw new ServiceError('ไม่สามารถอนุมัติใบขอซื้อที่ถูกยกเลิกแล้ว');

    return AuditService.runWithAudit(
      ctx,
      {
        ...PURCHASE_AUDIT_POLICIES.APPROVE(pr.purchaseNumber ?? prId),
        targetId: prId,
        beforeSnapshot: () => ({ status: pr.status }),
      },
      async () => {
        return db.purchase.update({
          where: { id: prId, shopId: ctx.shopId },
          data: { status: PurchaseStatus.APPROVED },
        });
      }
    );
  },

  async convertToPO(prId, ctx) {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    const pr = await db.purchase.findFirst({ where: { id: prId, shopId: ctx.shopId } });
    if (!pr) throw new ServiceError('ไม่พบใบขอซื้อ');

    return AuditService.runWithAudit(
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
  },

  async checkMOQ(items, ctx, supplierId) {
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

  async getSupplierPurchaseInfo(supplierId: string, ctx: RequestContext) {
    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, shopId: ctx.shopId },
      select: { purchaseNote: true, moq: true },
    });
    if (!supplier) throw new ServiceError('ไม่พบข้อมูลผู้จำหน่าย');
    return {
      purchaseNote: supplier.purchaseNote,
      moq: supplier.moq ? Number(supplier.moq) : null,
    };
  },

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

  async receivePurchase(purchaseId: string, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    const purchaseRef = await db.purchase.findFirst({ where: { id: purchaseId, shopId: ctx.shopId } });
    if (!purchaseRef) throw new ServiceError('ไม่พบข้อมูลการสั่งซื้อ');

    await AuditService.runWithAudit(
      ctx,
      PURCHASE_AUDIT_POLICIES.RECEIVE(purchaseRef.purchaseNumber!),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          await this.allocateCharges(purchaseId, ctx, prisma);
          const fullPurchase = await prisma.purchase.findFirst({
            where: { id: purchaseId, shopId: ctx.shopId },
            include: { items: true },
          });

          if (!fullPurchase) throw new ServiceError('ไม่พบข้อมูลการสั่งซื้อ');
          if (fullPurchase.status === PurchaseStatus.RECEIVED) throw new ServiceError('รายการนี้ได้รับสินค้าไปแล้ว');

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

          // ERP: Automated Inventory Receipt Posting (Industrial Phase 5)
          const { PostingService } = await import('@/services/accounting/posting-engine.service');
          await PostingService.postPurchaseInventory(ctx, updated, prisma);

          return updated;
        });
      }
    );
  },

  async getIncompleteRequests(params: GetIncompletePurchasesParams, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_VIEW');
    const where: Prisma.PurchaseWhereInput = { shopId: ctx.shopId, status: 'DRAFT', supplierId: null };
    const count = await db.purchase.count({ where });
    const purchases = await db.purchase.findMany({
      where,
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: ((params.page || 1) - 1) * (params.limit || 10),
      take: params.limit || 10,
    });

    return {
      items: purchases.map(p => ({
        ...serializePurchase(p),
        items: (p as any).items.map((item: any) => serializePurchaseItem(item)),
      })),
      total: count,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(count / (params.limit || 10)),
    };
  },

  async quickAssignSupplier(ids: string[], supplierId: string, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_UPDATE');
    if (!ids.length) return { success: true, count: 0 };

    const result = await db.purchase.updateMany({
      where: { id: { in: ids }, shopId: ctx.shopId, status: 'DRAFT', supplierId: null },
      data: { supplierId },
    });

    return { success: true, count: result.count };
  },

  async createBulkDraftPRs(entries: { productId: string, quantity: number, supplierId?: string }[], ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    if (!entries.length) return { success: true, createdCount: 0 };

    const groupedBySupplier = new Map<string | 'NONE', typeof entries>();
    entries.forEach(item => {
      const key = item.supplierId || 'NONE';
      if (!groupedBySupplier.has(key)) groupedBySupplier.set(key, []);
      groupedBySupplier.get(key)!.push(item);
    });

    return await runInTransaction(undefined, async (prisma) => {
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
      return { success: true, createdCount: prCount };
    });
  }
};
