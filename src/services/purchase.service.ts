import { db } from '@/lib/db';
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
} from '@/types/domain';
import { IPurchaseService, PurchaseRequestInput } from '@/types/service-contracts';
import { SequenceService } from './sequence.service';
import { AuditService } from './audit.service';

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
    const { items, ...purchaseData } = payload;
    
    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    // 1. Business Logic: Check MOQ (Vendor Intelligence - Rule 5.5)
    const moqFailures = await this.checkMOQ(items, ctx, purchaseData.supplierId || undefined);
    if (moqFailures.length > 0) {
      const messages = moqFailures.map(f => 
        `"${f.productName}" สั่ง ${f.requestedQty} ชิ้น (ขั้นต่ำคือ ${f.moq})`
      ).join(', ');
      throw new ServiceError(`ไม่สามารถสั่งได้เนื่องจากไม่ถึงยอดสั่งขั้นต่ำ (MOQ): ${messages}`);
    }

    const executeTransaction = async (prismaTx: Prisma.TransactionClient) => {
      const totalCost = items.reduce(
        (sum, item) => money.add(sum, calcSubtotal(item.quantity, item.costPrice)),
        0
      );

      const purchaseNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_ORDER, prismaTx, {
        purchaseType: purchaseData.purchaseType as any,
      });

      const newPurchase = await prismaTx.purchase.create({
        data: {
          ...purchaseData,
          purchaseNumber,
          date: purchaseData.date ? new Date(purchaseData.date) : new Date(),
          userId: ctx.userId,
          shopId: ctx.shopId,
          supplierId: purchaseData.supplierId || null,
          notes: purchaseData.notes || null,
          totalCost: totalCost,
          receiptUrl: purchaseData.receiptUrl || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              subtotal: calcSubtotal(item.quantity, item.costPrice),
            })),
          },
        },
        include: { items: true },
      });

      // Bulk stock movement (1 batch instead of N sequential calls)
      await StockService.recordMovements(
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
        prismaTx
      );

      // Batch update cost prices in parallel
      await Promise.all(
        items.map(item =>
          prismaTx.product.update({
            where: { id: item.productId },
            data: { costPrice: item.costPrice },
          })
        )
      );

      const purchaseToReturn = {
        ...newPurchase,
        totalCost: toNumber(newPurchase.totalCost),
        items: newPurchase.items.map(item => ({
          ...item,
          costPrice: toNumber(item.costPrice),
          subtotal: toNumber(item.subtotal),
        })),
      } as any;

      // ERP Rule 12.1: Audit Create (Level 2 Snapshot)
      await AuditService.log(ctx, {
        action: 'PURCHASE_CREATE',
        entityType: 'Purchase',
        entityId: newPurchase.id,
        metadata: purchaseToReturn,
        note: `สร้างรายการซื้อ ${newPurchase.purchaseNumber}`,
      });

      return purchaseToReturn;
    };

    if (tx) {
      return executeTransaction(tx);
    } else {
      return db.$transaction(executeTransaction);
    }
  },

  /**
   * ยกเลิกการซื้อ (คืนสต็อก และลดยอดใช้จ่าย)
   */
  async cancel(input: CancelPurchaseInput, ctx: RequestContext) {
    const { id, reasonCode, reasonDetail } = input;

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    });
    const userName = user?.name || 'Unknown';

    if (!reasonCode) throw new ServiceError('กรุณาเลือกเหตุผลในการยกเลิก');
    if (reasonCode === 'OTHER' && !reasonDetail?.trim()) throw new ServiceError('กรุณากรอกรายละเอียดเหตุผล');

    const cancelReason = reasonCode === 'OTHER'
      ? `${CANCEL_PURCHASE_REASONS.OTHER}: ${reasonDetail}`
      : (CANCEL_PURCHASE_REASONS as Record<string, string>)[reasonCode] || reasonCode;

    await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, shopId: ctx.shopId },
        include: { items: { include: { product: true } } },
      });

      if (!purchase) throw new ServiceError('ไม่พบข้อมูลการซื้อ');
      if (purchase.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

      // Pre-validate: check all items won't cause negative stock
      for (const item of purchase.items) {
        const newStock = item.product.stock - item.quantity;
        if (newStock < 0) {
          throw new ServiceError(
            `ไม่สามารถยกเลิกได้: สต็อก ${item.product.name} จะติดลบ (คงเหลือ ${item.product.stock}, ต้องหัก ${item.quantity})`
          );
        }
      }

      // Bulk stock restore (1 batch instead of N sequential calls)
      await StockService.recordMovements(
        purchase.items.map(item => ({
          productId: item.productId,
          type: 'PURCHASE_CANCEL' as const,
          quantity: -item.quantity,
          userId: ctx.userId,
          shopId: ctx.shopId,
          purchaseId: purchase.id,
          note: `ยกเลิกการซื้อ - ${cancelReason}`,
          date: new Date(),
        })),
        tx
      );

      // Batch rollback cost prices: find previous purchase prices in parallel
      const costRollbackOps = await Promise.all(
        purchase.items.map(async item => {
          const prev = await tx.purchaseItem.findFirst({
            where: {
              productId: item.productId,
              purchase: {
                id: { not: purchase.id },
                status: { not: 'CANCELLED' },
                shopId: ctx.shopId,
              },
            },
            orderBy: { purchase: { date: 'desc' } },
            select: { costPrice: true },
          });
          return prev ? { productId: item.productId, costPrice: prev.costPrice } : null;
        })
      );

      // Execute all cost price updates in parallel
      const validRollbacks = costRollbackOps.filter(Boolean) as { productId: string; costPrice: any }[];
      if (validRollbacks.length > 0) {
        await Promise.all(
          validRollbacks.map(r =>
            tx.product.update({ where: { id: r.productId }, data: { costPrice: r.costPrice } })
          )
        );
      }

      await tx.purchase.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: userName,
          cancelReason,
        },
      });

      // ERP Rule 12.1: Audit Cancel (Level 2 Snapshot)
      await AuditService.log(ctx, {
        action: 'PURCHASE_CANCEL',
        entityType: 'Purchase',
        entityId: id,
        metadata: purchase,
        note: `ยกเลิกการซื้อ ${purchase.purchaseNumber}: ${cancelReason}`,
      });
    });
  },

  // ==========================================
  // ERP ENHANCED METHODS (PR/PO Workflow)
  // ==========================================

  async createRequest(payload, ctx) {
    return await db.$transaction(async (tx) => {
      const { items, purchaseType, notes, supplierId } = payload;
      
      const requestNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_REQUEST, tx, {
        purchaseType: payload.purchaseType,
      });
      
      const totalCost = items.reduce(
        (sum, item) => money.add(sum, calcSubtotal(item.quantity, item.costPrice)),
        0
      );

      const pr = await tx.purchase.create({
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
    return await db.$transaction(async (tx) => {
      const pr = await tx.purchase.findFirst({
        where: { id: prId, shopId: ctx.shopId },
        include: { items: true },
      });

      if (!pr) throw new ServiceError('ไม่พบใบขอซื้อ');
      if (pr.status !== PurchaseStatus.APPROVED && pr.status !== PurchaseStatus.DRAFT) {
        throw new ServiceError('ใบขอซื้อต้องได้รับการอนุมัติก่อนแปลงเป็นใบสั่งซื้อ');
      }

      const poNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_ORDER, tx, {
        purchaseType: pr.purchaseType as any,
      });

      const po = await tx.purchase.create({
        data: {
          purchaseNumber: poNumber,
          purchaseType: pr.purchaseType,
          docType: 'ORDER',
          status: PurchaseStatus.ORDERED,
          totalCost: pr.totalCost,
          notes: pr.notes,
          supplierId: pr.supplierId,
          userId: ctx.userId,
          shopId: ctx.shopId,
          requestNumber: pr.purchaseNumber,
          linkedPRId: pr.id,
          items: {
            create: pr.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              subtotal: item.subtotal,
            })),
          },
        },
      });

      // Update PR status
      await tx.purchase.update({
        where: { id: pr.id },
        data: { status: PurchaseStatus.ORDERED },
      });

      // ERP Rule 12.1: Audit Convert PR -> PO
      await AuditService.log(ctx, {
        action: 'PURCHASE_CONVERT_PR_TO_PO',
        entityType: 'Purchase',
        entityId: po.id,
        metadata: { prId: pr.id, poId: po.id, poNumber: po.purchaseNumber },
        note: `แปลงใบขอซื้อ ${pr.purchaseNumber} เป็นใบสั่งซื้อ ${po.purchaseNumber}`,
      });

      return { id: po.id, poNumber: po.purchaseNumber! };
    });
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

    // Optional: Log the allocation event
    await AuditService.log(ctx, {
      action: 'PURCHASE_CHARGE_ALLOCATION',
      entityType: 'Purchase',
      entityId: purchaseId,
      metadata: { totalCharges, distributedTo: productItems.length },
      note: `กระจายค่าใช้จ่ายเพิ่มเติม (รวม ${totalCharges}) ลงในรายการสินค้า`,
    });
  },

  async receivePurchase(purchaseId: string, ctx: RequestContext) {
    await db.$transaction(async (tx) => {
      // 1. First, allocate any charges (Rule 10.3)
      await this.allocateCharges(purchaseId, ctx, tx);

      // 2. Then proceed with normal reception (which now uses updated costPrice)
      const purchase = await tx.purchase.findFirst({
        where: { id: purchaseId, shopId: ctx.shopId },
        include: { items: true },
      });

      if (!purchase) throw new ServiceError('ไม่พบข้อมูลการสั่งซื้อ');
      if (purchase.status === PurchaseStatus.RECEIVED) {
        throw new ServiceError('รายการนี้ได้รับสินค้าไปแล้ว');
      }

      // Intelligence: Calculate Moving Average Cost (Weighted Average)
      const productIds = purchase.items.map(item => item.productId);
      const currentProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true, costPrice: true },
      });

      const productMap = new Map(currentProducts.map(p => [p.id, p]));

      // Bulk stock add & Cost Update (Parallel)
      await Promise.all([
        StockService.recordMovements(
          purchase.items.map(item => ({
            productId: item.productId,
            type: 'PURCHASE' as const,
            quantity: item.quantity,
            userId: ctx.userId,
            shopId: ctx.shopId,
            purchaseId: purchase.id,
            note: `รับสินค้าจากการสั่งซื้อ: ${purchase.purchaseNumber}`,
            date: new Date(),
          })),
          tx
        ),
        ...purchase.items.map(item => {
          const product = productMap.get(item.productId);
          if (!product) return Promise.resolve();

          const oldStock = product.stock || 0;
          const oldCost = toNumber(product.costPrice) || 0;
          const newQty = item.quantity;
          const newCost = toNumber(item.costPrice);

          // Moving Average Formula: ((S1*C1) + (S2*C2)) / (S1+S2)
          // Handle case where stock is currently 0 or negative
          const totalQty = Math.max(1, oldStock + newQty);
          const weightedCost = ((Math.max(0, oldStock) * oldCost) + (newQty * newCost)) / totalQty;
          const finalCost = Number(weightedCost.toFixed(2));

          return tx.product.update({
            where: { id: item.productId },
            data: { costPrice: finalCost },
          });
        })
      ]);

      await tx.purchase.update({
        where: { id: purchaseId },
        data: { 
          status: PurchaseStatus.RECEIVED,
          receivedAt: new Date(),
          receivedBy: ctx.userId,
        },
      });

      // ERP Rule 12.1: Audit Receipt
      await AuditService.log(ctx, {
        action: 'PURCHASE_RECEIVE',
        entityType: 'Purchase',
        entityId: purchaseId,
        metadata: purchase,
        note: `รับสินค้าจากการสั่งซื้อ ${purchase.purchaseNumber}`,
      });
    });
  }
};
