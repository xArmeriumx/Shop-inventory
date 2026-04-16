import { db, runInTransaction } from '@/lib/db';
import { Prisma, Purchase } from '@prisma/client';
import { PurchaseInput } from '@/schemas/purchase';
import { StockService } from './stock.service';
// Types imported from @/types/domain
import { money, toNumber, calcSubtotal } from '@/lib/money';
import { logger } from '@/lib/logger';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';

import { 
  RequestContext, 
  ServiceError, 
  GetPurchasesParams,
  DocumentType,
  PurchaseStatus,
  PurchaseType,
  SerializedPurchase,
  SerializedPurchaseWithItems,
  GetIncompletePurchasesParams,
} from '@/types/domain';
import { IPurchaseService, PurchaseRequestInput } from '@/types/service-contracts';
import { SequenceService } from './sequence.service';
import { AuditService } from './audit.service';
import { PURCHASE_AUDIT_POLICIES } from './purchase.policy';
import { Security } from './security';

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

const MAX_PURCHASE_RETRIES = 5;

// Replaced by SequenceService

export const PurchaseService: IPurchaseService = {
  /**
   * ดึงข้อมูลการซื้อทั้งหมด (Pagination)
   */
  async getList(params: GetPurchasesParams = {}, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_VIEW');
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod } = params;

    const searchFilter = buildSearchFilter(search, ['notes']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where = {
      shopId: ctx.shopId,
      ...(searchFilter && searchFilter),
      ...(dateFilter && { date: dateFilter }),
      ...(paymentMethod && { paymentMethod }),
    };

    const result = await paginatedQuery<any>(db.purchase as any, {
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        supplier: { select: { name: true } },
      },
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    // Mutate in-place: avoid creating new objects (reduces GC pressure)
    for (const p of result.data) {
      (p as any).totalCost = toNumber(p.totalCost);
      for (const i of (p as any).items) {
        i.costPrice = toNumber(i.costPrice);
        i.subtotal = toNumber(i.subtotal);
      }
    }

    return result;
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
      },
    });

    if (!purchase) {
      throw new ServiceError('ไม่พบข้อมูลการซื้อ');
    }

    // Mutate in-place: avoid creating new objects (UC 6)
    const supplierMoq = purchase.supplier?.moq ? Number(purchase.supplier.moq) : null;
    (purchase as any).totalCost = toNumber(purchase.totalCost);
    for (const i of (purchase as any).items) {
      i.costPrice = toNumber(i.costPrice);
      i.subtotal = toNumber(i.subtotal);
      i.moq = supplierMoq; // UC 6: Display field
    }

    return purchase as any;
  },

  /**
   * สร้างการสั่งซื้อเข้าร้าน พร้อมอัปเดตสต็อกและต้นทุน (FIFO / Weighted Avg concept applied here)
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
            where: { id: { in: productIds } },
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
            },
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

          await Promise.all(items.map(item =>
            prisma.product.update({ where: { id: item.productId }, data: { costPrice: item.costPrice } })
          ));

          return {
            ...newPurchase,
            totalCost: toNumber(newPurchase.totalCost),
            items: newPurchase.items.map(item => ({
              ...item,
              costPrice: toNumber(item.costPrice),
              subtotal: toNumber(item.subtotal),
            })),
          } as any;
        });
      }
    );
  },

  /**
   * ยกเลิกการซื้อ (คืนสต็อก และลดยอดใช้จ่าย)
   */
  async cancel(input: CancelPurchaseInput, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_CANCEL');
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
            where: { id },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: user?.name || 'Unknown', cancelReason },
          });

          return fullPurchase;
        });
      }
    );
  },

  // ==========================================
  // ERP ENHANCED METHODS (PR/PO Workflow)
  // ==========================================

  async createRequest(payload, ctx) {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    return await runInTransaction(undefined, async (prisma) => {
      const { items, purchaseType, notes, supplierId } = payload;
      
      const productIds = items.map(i => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
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

  async approveRequest(prId, ctx) {
    await db.purchase.update({
      where: { id: prId, shopId: ctx.shopId },
      data: { status: PurchaseStatus.APPROVED },
    });
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
            where: { id: fullPR.id },
            data: { status: PurchaseStatus.ORDERED },
          });

          return { id: po.id, poNumber: po.purchaseNumber! };
        });
      }
    );
  },

  async checkMOQ(items, ctx, supplierId) {
    const productIds = items.map(i => i.productId);
    
    // Get general product MOQ
    const products = await db.product.findMany({
      where: { id: { in: productIds }, shopId: ctx.shopId },
      select: { id: true, name: true, moq: true },
    });

    // Get supplier-specific MOQ if supplierId is provided
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

      // Rule 5.5: Priority = SupplierProduct.moq > Product.moq
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

  /**
   * ERP Rule 10.3: Distribute indirect charges (Shipping, Handling) into product unit costs
   */
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

    // 1. Identify "Charge" items vs "Product" items
    const chargeItems = purchase.items.filter(item => {
      const metadata = item.product?.categoryRef?.metadata as any;
      return metadata?.isCharge === true;
    });

    const productItems = purchase.items.filter(item => {
      const metadata = item.product?.categoryRef?.metadata as any;
      return !(metadata?.isCharge === true);
    });

    if (chargeItems.length === 0 || productItems.length === 0) return;

    // 2. Calculate Total Charges to distribute
    const totalCharges = chargeItems.reduce((sum, item) => money.add(sum, toNumber(item.subtotal)), 0);
    const totalProductValue = productItems.reduce((sum, item) => money.add(sum, toNumber(item.subtotal)), 0);

    if (totalProductValue <= 0) return;

    // 3. Distribute proportionally
    await AuditService.runWithAudit(
      ctx,
      {
        ...PURCHASE_AUDIT_POLICIES.CHARGE_ALLOCATION(purchase?.purchaseNumber || 'Unknown', totalCharges),
        targetId: purchaseId,
      },
      async () => {
        for (const item of productItems) {
          const itemRatio = money.divide(toNumber(item.subtotal), totalProductValue);
          const allocatedAmount = money.multiply(totalCharges, itemRatio);
          
          const newSubtotal = money.add(toNumber(item.subtotal), allocatedAmount);
          const newUnitPrice = money.divide(newSubtotal, item.quantity);

          // Update the PurchaseItem with the 'Landed Cost'
          await tx.purchaseItem.update({
            where: { id: item.id },
            data: { 
              costPrice: newUnitPrice, // Update the effective cost for this shipment
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
            where: { id: { in: productIds } },
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
            const totalQty = Math.max(1, (product.stock || 0) + item.quantity);
            const weightedCost = (((product.stock || 0) * (toNumber(product.costPrice) || 0)) + (item.quantity * toNumber(item.costPrice))) / totalQty;
            return prisma.product.update({ where: { id: item.productId }, data: { costPrice: Number(weightedCost.toFixed(2)) } });
          }));

          const updated = await prisma.purchase.update({
            where: { id: purchaseId },
            data: { status: PurchaseStatus.RECEIVED, receivedAt: new Date(), receivedBy: ctx.userId },
            include: { items: true }
          });

          return updated;
        });
      }
    );
  },

  /**
   * เครื่องมือสำหรับ Admin: ดึงรายการ PR ที่ข้อมูลไม่ครบ (เช่น ไม่มีผู้ขาย)
   */
  async getIncompleteRequests(params: GetIncompletePurchasesParams, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_VIEW');

    const where: Prisma.PurchaseWhereInput = {
      shopId: ctx.shopId,
      status: 'DRAFT',
      supplierId: null,
    };

    const count = await db.purchase.count({ where });
    const purchases = await db.purchase.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: { name: true, sku: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: ((params.page || 1) - 1) * (params.pageSize || 10),
      take: params.pageSize || 10,
    });

    return {
      items: purchases.map(p => ({
        ...p,
        totalCost: Number(p.totalCost),
        items: p.items.map(item => ({
          ...item,
          costPrice: Number(item.costPrice),
          subtotal: Number(item.subtotal),
        })),
      })),
      total: count,
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      totalPages: Math.ceil(count / (params.pageSize || 10)),
    };
  },

  /**
   * เครื่องมือสำหรับ Admin: มอบหมายผู้ขายให้กับ PR แบบด่วน
   */
  async quickAssignSupplier(ids: string[], supplierId: string, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_EDIT');

    if (!ids.length) return { success: true, count: 0 };

    const result = await db.purchase.updateMany({
      where: {
        id: { in: ids },
        shopId: ctx.shopId,
        status: 'DRAFT',
        supplierId: null,
      },
      data: {
        supplierId,
      },
    });

    await AuditService.runWithAudit(
      ctx,
      {
        action: 'UPDATE',
        category: 'PURCHASE',
        details: `Quick assign supplier ${supplierId} to ${result.count} documents`,
        resourceId: ids[0], // Reference one of the IDs
      },
      async () => {
        // Audit is logged by the system
      }
    );

    return { success: true, count: result.count };
  },

  /**
   * UC 22: Bulk Create Draft PRs from suggestions
   */
  async createBulkDraftPRs(entries: { productId: string, quantity: number, supplierId?: string }[], ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_CREATE');
    
    if (!entries.length) return { success: true, createdCount: 0 };

    // Group items by supplier
    const groupedBySupplier = new Map<string | 'NONE', typeof entries>();
    entries.forEach(item => {
      const key = item.supplierId || 'NONE';
      if (!groupedBySupplier.has(key)) groupedBySupplier.set(key, []);
      groupedBySupplier.get(key)!.push(item);
    });

    return await AuditService.runWithAudit(
      ctx,
      {
        action: 'CREATE',
        category: 'PURCHASE',
        details: `Bulk generate PR drafts for ${groupedBySupplier.size} suppliers from suggestions`,
      },
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          let prCount = 0;

          // Create one PR per supplier
          for (const [supplierId, items] of groupedBySupplier.entries()) {
            const actualSupplierId = supplierId === 'NONE' ? null : supplierId;
            
            // Get product info for cost and packaging
            const productIds = items.map(i => i.productId);
            const products = await prisma.product.findMany({
              where: { id: { in: productIds } },
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
                  return money.add(sum, calcSubtotal(i.quantity, toNumber(p?.costPrice || 0)));
                }, 0),
                items: {
                  create: items.map(item => {
                    const p = productMap.get(item.productId);
                    const cost = toNumber(p?.costPrice || 0);
                    return {
                      productId: item.productId,
                      quantity: item.quantity,
                      costPrice: cost,
                      subtotal: calcSubtotal(item.quantity, cost),
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
    );
  }
};
