import { db, runInTransaction } from '@/lib/db';
import { Prisma, Permission } from '@prisma/client';
import { SaleInput } from '@/schemas/sale';
import { StockService } from './stock.service';
import { NotificationService } from './notification.service';
import { money, calcSubtotal, calcProfit } from '@/lib/money';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';

import {
  RequestContext,
  ServiceError,
  GetSalesParams,
  DocumentType,
  BookingStatus,
  SaleStatus,
  DocPaymentStatus,
  EditLockStatus,
  PaginatedResult,
} from '@/types/domain';
import {
  SerializedSale,
  SerializedSaleWithItems,
  SerializedSaleListItem
} from '@/types/serialized';
import { ISaleService } from '@/types/service-contracts';
import { SequenceService } from './sequence.service';
import { CustomerService } from './customer.service';
import { AuditService } from './audit.service';
import { SALE_AUDIT_POLICIES } from './sale.policy';
import { Security } from './security';
import { WorkflowService } from './workflow.service';
import { serializeSale, serializeSaleItem } from '@/lib/mappers';

export const CANCEL_REASONS = {
  WRONG_ENTRY: 'บันทึกผิดพลาด',
  CUSTOMER_REQUEST: 'ลูกค้าขอยกเลิก',
  DAMAGED: 'สินค้าชำรุด',
  OTHER: 'อื่นๆ',
} as const;

export interface CancelSaleInput {
  id: string;
  reasonCode: string;
  reasonDetail?: string;
}

/**
 * Enhanced Sale serialization with security controls
 */
function serializeSaleSafe(sale: any, canViewProfit: boolean): any {
  const base = serializeSale(sale);
  if (!canViewProfit) {
    base.totalCost = 0;
    base.profit = 0;
  }
  return base;
}

export const SaleService: ISaleService = {
  /**
   * บันทึกการขายใหม่ พร้อมจองสต็อกอัตโนมัติ
   */
  async create(ctx: RequestContext, payload: SaleInput, tx?: Prisma.TransactionClient): Promise<SerializedSale> {
    Security.requirePermission(ctx, 'SALE_CREATE');
    Security.assertSameShop(ctx, ctx.shopId);

    if (!ctx.memberId) {
      throw new ServiceError('ไม่สามารถสร้างรายการขายได้เนื่องจากไม่พบรหัสสมาชิก (memberId)');
    }
    const { items, customerAddress, ...saleData } = payload;

    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    return AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.CREATE(saleData.customerName || 'New Sale'),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          // 1. Generate Invoice Number
          const departmentCode = ctx.employeeDepartment || null;
          const invoiceNumber = await SequenceService.generate(ctx, DocumentType.SALE_INVOICE, prisma, {
            departmentCode: departmentCode || undefined,
          });

          // 2. Validate Products & Pre-check stock
          const productIds = items.map(item => item.productId);
          const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, stock: true, reservedStock: true, costPrice: true, packagingQty: true },
          });
          const productDataMap = new Map(products.map((p: any) => [p.id, p]));

          for (const item of items) {
            const product = productDataMap.get(item.productId);
            if (!product) throw new ServiceError(`ไม่พบสินค้า ID: ${item.productId}`);
            const available = product.stock - product.reservedStock;
            if (available < item.quantity) {
              throw new ServiceError(`สินค้า "${product.name}" มีสต็อกไม่พอ (สั่งซื้อได้ ${available})`);
            }
          }

          // 3. Calculate Totals
          let totalAmount = 0;
          let totalCost = 0;
          const saleItemsToCreate = [];

          for (const item of items) {
            const product = productDataMap.get(item.productId)!;
            const subtotal = calcSubtotal(item.quantity, money.subtract(item.salePrice, item.discountAmount ?? 0));
            const itemCost = calcSubtotal(item.quantity, Number(product.costPrice));

            totalAmount = money.add(totalAmount, subtotal);
            totalCost = money.add(totalCost, itemCost);

            saleItemsToCreate.push({
              productId: item.productId,
              quantity: item.quantity,
              packagingQty: product.packagingQty || 1,
              salePrice: item.salePrice,
              costPrice: product.costPrice,
              subtotal,
              profit: calcProfit(subtotal, itemCost),
              discountAmount: item.discountAmount ?? 0,
            });
          }

          // Bill-level discount
          let billDiscountAmount = 0;
          const discountValue = saleData.discountValue ?? 0;
          if (saleData.discountType === 'PERCENT' && discountValue > 0) {
            billDiscountAmount = money.round(money.multiply(totalAmount, money.divide(discountValue, 100)));
          } else if (saleData.discountType === 'FIXED' && discountValue > 0) {
            billDiscountAmount = discountValue;
          }
          if (billDiscountAmount > totalAmount) billDiscountAmount = totalAmount;

          const netAmount = money.subtract(totalAmount, billDiscountAmount);

          // 4. Handle Customer & Credit
          let finalCustomerId = saleData.customerId;
          if (finalCustomerId) {
            await CustomerService.checkCreditLimit(finalCustomerId, netAmount, ctx, prisma);
          }

          // 5. Create Sale
          const sale = await prisma.sale.create({
            data: {
              customerId: finalCustomerId || null,
              userId: ctx.userId,
              memberId: ctx.memberId || null,
              shopId: ctx.shopId,
              invoiceNumber,
              date: saleData.date ? new Date(saleData.date) : new Date(),
              paymentMethod: saleData.paymentMethod,
              notes: saleData.notes || null,
              departmentCode: departmentCode || undefined,
              totalAmount,
              totalCost,
              profit: calcProfit(netAmount, totalCost),
              discountType: saleData.discountType,
              discountValue: saleData.discountValue,
              discountAmount: billDiscountAmount,
              netAmount,
              paymentStatus: (saleData.paymentMethod === 'CREDIT' ? 'UNPAID' : 'PAID') as DocPaymentStatus,
              items: { create: saleItemsToCreate },
              partnerAddress: customerAddress ? JSON.stringify(customerAddress) : null,
            } as Prisma.SaleUncheckedCreateInput,
            include: { items: true },
          });

          // 6. Record Stock Reservation
          await Promise.all((sale.items || []).map((item: any) =>
            StockService.reserveStock(item.productId, item.quantity, ctx, prisma)
          ));

          const updatedSale = await prisma.sale.update({
            where: { id: sale.id },
            data: {
              bookingStatus: BookingStatus.RESERVED,
              status: SaleStatus.CONFIRMED
            },
            include: { items: true }
          });

          // 7. Notification (Async)
          NotificationService.create({
            shopId: ctx.shopId,
            type: 'NEW_SALE',
            severity: 'INFO',
            title: `ยอดขายใหม่ ${invoiceNumber}`,
            message: `ยอดรวม ${netAmount} บาท`,
            link: `/sales/${sale.id}`,
          }, prisma).catch(() => { });

          return serializeSaleSafe(updatedSale, true);
        }, { timeout: 30000 });
      }
    );
  },

  async update(id: string, ctx: RequestContext, payload: any): Promise<SerializedSale> {
    Security.require(ctx, 'SALE_UPDATE' as Permission);
    const sale = await db.sale.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    // Workflow Rule check (Pillar 1.1)
    WorkflowService.canSaleAction(sale as any, 'UPDATE');

    return AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.UPDATE(sale.invoiceNumber, payload),
      async () => {
        // ERP Rule: If document is locked for editing, only allow specific meta-fields 
        // UNLESS user has SALE_UPDATE_LOCKED permission
        const isLocked = ((sale as any).editLockStatus as unknown as EditLockStatus) !== 'NONE' || sale.isLocked;

        if (isLocked) {
          try {
            Security.require(ctx, 'SALE_UPDATE_LOCKED' as Permission);
          } catch (e) {
            // If they DON'T have SALE_UPDATE_LOCKED, they can only edit meta-fields
            const { notes, paymentMethod, channel } = payload;
            const updated = await db.sale.update({
              where: { id },
              data: {
                notes: notes ?? sale.notes,
                paymentMethod: paymentMethod ?? sale.paymentMethod,
                channel: channel ?? sale.channel,
              },
            });
            return serializeSaleSafe(updated, true);
          }
        }

        const updated = await db.sale.update({
          where: { id },
          data: payload,
        });

        return serializeSaleSafe(updated, true);
      }
    );
  },

  async delete(id: string, ctx: RequestContext): Promise<void> {
    return this.cancel({ id, reasonCode: 'SYSTEM_DELETE', reasonDetail: 'Deleted by user' }, ctx);
  },

  async getList(params: GetSalesParams = {}, ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<PaginatedResult<SerializedSaleListItem>> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod, channel, status } = params;
    const { canViewProfit = false } = options;

    if (canViewProfit) Security.require(ctx, 'SALE_VIEW_PROFIT' as any);

    const searchFilter = buildSearchFilter(search, ['invoiceNumber', 'customerName', 'notes']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where = {
      shopId: ctx.shopId,
      ...(searchFilter && searchFilter),
      ...(dateFilter && { date: dateFilter }),
      ...(paymentMethod && { paymentMethod }),
      ...(channel && { channel }),
      ...(status && { status }),
    };

    const result = await paginatedQuery(db.sale, {
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        customer: { select: { name: true } },
      },
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    return {
      ...result,
      data: result.data.map((sale: any) => serializeSaleSafe(sale, canViewProfit)),
    };
  },

  async getById(id: string, ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<SerializedSaleWithItems> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { canViewProfit = false } = options;
    if (canViewProfit) Security.require(ctx, Permission.SALE_VIEW_PROFIT);

    const sale = await db.sale.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true, stock: true, reservedStock: true } } } },
        customer: true,
        shipments: {
          select: {
            id: true, shipmentNumber: true, status: true, trackingNumber: true, shippingProvider: true, shippingCost: true,
          },
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!sale) throw new ServiceError('ไม่พบข้อมูลการขาย');

    const serializedSale = serializeSaleSafe(sale, canViewProfit) as SerializedSaleWithItems;

    serializedSale.items = (sale.items || []).map((item: any) => {
      const serializedItem = serializeSaleItem(item);

      let virtualStockStatus = 'ยังไม่จองสต็อก';
      if (sale.status === SaleStatus.CONFIRMED || sale.status === SaleStatus.INVOICED) {
        virtualStockStatus = 'จองสต็อกแล้ว';
      }
      if (sale.status === SaleStatus.COMPLETED) {
        virtualStockStatus = 'ตัดสต็อกแล้ว';
      }

      return {
        ...serializedItem,
        product: item.product ? {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
        } : { id: item.productId, name: 'Unknown Product', sku: null },
        stockStatus: item.product ? {
          onHand: item.product.stock,
          reserved: item.product.reservedStock,
          available: item.product.stock - item.product.reservedStock,
          statusLabel: virtualStockStatus,
        } : undefined
      };
    }) as any;

    return serializedSale;
  },

  async getTodayAggregate(ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<{ totalSales: number; saleCount: number; profit?: number }> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { canViewProfit = false } = options;
    if (canViewProfit) Security.require(ctx, Permission.SALE_VIEW_PROFIT);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      _sum: { netAmount: true, profit: true },
      _count: true,
    });

    return {
      totalSales: Number(result._sum.netAmount) || 0,
      profit: canViewProfit ? (Number(result._sum.profit) || 0) : undefined,
      saleCount: result._count,
    };
  },

  async getRecentList(limit: number, ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<SerializedSale[]> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { canViewProfit = false } = options;
    if (canViewProfit) Security.require(ctx, Permission.SALE_VIEW_PROFIT);

    const sales = await db.sale.findMany({
      where: { shopId: ctx.shopId },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sales.map(sale => serializeSaleSafe(sale, canViewProfit));
  },

  async cancel(input: CancelSaleInput, ctx: RequestContext) {
    Security.require(ctx, Permission.SALE_CANCEL);
    const { id, reasonCode, reasonDetail } = input;

    if (!reasonCode) throw new ServiceError('กรุณาเลือกเหตุผลในการยกเลิก');
    if (reasonCode === 'OTHER' && !reasonDetail?.trim()) throw new ServiceError('กรุณากรอกรายละเอียดเหตุผล');

    const cancelReason = reasonCode === 'OTHER'
      ? `${CANCEL_REASONS.OTHER}: ${reasonDetail}`
      : (CANCEL_REASONS as Record<string, string>)[reasonCode] || reasonCode;

    const sale = await db.sale.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบข้อมูลการขาย');

    await AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.CANCEL(sale.invoiceNumber, cancelReason),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          const fullSale = await prisma.sale.findFirst({
            where: { id, shopId: ctx.shopId },
            include: { items: { include: { returnItems: { select: { quantity: true } } } } },
          });

          if (!fullSale) throw new ServiceError('ไม่พบข้อมูลการขาย');
          if (fullSale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

          // ERP Rule: Cannot cancel if document is locked (e.g. invoiced)
          if ((fullSale as any).editLockStatus !== 'NONE') {
            throw new ServiceError((fullSale as any).lockReason || 'เอกสารนี้ถูกล็อก ไม่สามารถยกเลิกได้');
          }

          const linkedShipments = await prisma.shipment.findMany({
            where: { saleId: id, status: { not: 'CANCELLED' } },
            select: { id: true, shipmentNumber: true },
          });

          for (const linkedShipment of linkedShipments) {
            await prisma.shipment.update({
              where: { id: linkedShipment.id },
              data: { status: 'CANCELLED', notes: `ยกเลิกอัตโนมัติ: Sale ${fullSale.invoiceNumber} ถูกยกเลิก` },
            });
            await prisma.expense.deleteMany({
              where: { shopId: ctx.shopId, category: 'ค่าจัดส่ง', description: { contains: linkedShipment.shipmentNumber } },
            });
          }

          await prisma.return.updateMany({
            where: { saleId: id, status: { not: 'CANCELLED' } },
            data: { status: 'CANCELLED' },
          });

          if (fullSale.bookingStatus === BookingStatus.RESERVED) {
            await Promise.all(fullSale.items.map(item => {
              const alreadyReturned = item.returnItems.reduce((sum: number, ri: any) => sum + ri.quantity, 0);
              const releaseQty = item.quantity - alreadyReturned;
              if (releaseQty > 0) return StockService.releaseStock(item.productId, releaseQty, ctx, prisma);
              return Promise.resolve();
            }));
          } else if (fullSale.bookingStatus === BookingStatus.DEDUCTED) {
            const movements = fullSale.items
              .map(item => {
                const restoreQty = item.quantity - item.returnItems.reduce((sum: number, ri: any) => sum + ri.quantity, 0);
                return restoreQty > 0 ? {
                  productId: item.productId,
                  type: 'SALE_CANCEL' as const,
                  quantity: restoreQty,
                  saleId: fullSale.id,
                  userId: ctx.userId,
                  shopId: fullSale.shopId || ctx.shopId,
                  note: `ยกเลิกการขาย ${fullSale.invoiceNumber} - ${cancelReason}`,
                } : null;
              })
              .filter(Boolean) as any[];

            if (movements.length > 0) await StockService.recordMovements(ctx, movements, prisma);
          }

          const userNameResult = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
          await prisma.sale.update({
            where: { id },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userNameResult?.name || 'System', cancelReason },
          });

          return { ...fullSale, status: 'CANCELLED' };
        });
      }
    );
  },

  async verifyPayment(saleId: string, legacyStatus: 'VERIFIED' | 'REJECTED', note: string | undefined, ctx: RequestContext) {
    const status = legacyStatus === 'VERIFIED' ? 'PAID' : 'UNPAID';
    Security.requirePermission(ctx, 'FINANCE_VIEW_LEDGER' as any);
    const existingSale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });

    if (!existingSale) throw new ServiceError('ไม่พบรายการขาย');
    if (existingSale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกแล้ว');

    await AuditService.runWithAudit(
      ctx,
      {
        ...SALE_AUDIT_POLICIES.PAYMENT(existingSale.invoiceNumber, status, note || ''),
        getBefore: async () => existingSale,
      },
      async () => {
        return db.sale.update({
          where: { id: saleId },
          data: {
            paymentStatus: status as DocPaymentStatus,
            paymentVerifiedAt: status === 'PAID' ? new Date() : null,
            paymentVerifiedBy: ctx.userId,
            paymentNote: note || null,
          },
        });
      }
    );
  },

  async uploadPaymentProof(saleId: string, proofUrl: string, ctx: RequestContext) {
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    await db.sale.update({
      where: { id: saleId },
      data: { paymentProof: proofUrl, paymentStatus: 'UNPAID' },
    });
  },

  async confirmOrder(saleId, ctx) {
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    await AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.CONFIRM(sale.invoiceNumber),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          const fullSale = await prisma.sale.findFirst({
            where: { id: saleId, shopId: ctx.shopId },
            include: { items: true },
          });

          if (!fullSale) throw new ServiceError('ไม่พบรายการขาย');
          if (fullSale.status !== SaleStatus.DRAFT) throw new ServiceError('รายการนี้ไม่ได้อยู่ในสถานะร่าง');

          await Promise.all(fullSale.items.map(item =>
            StockService.reserveStock(item.productId, item.quantity, ctx, prisma)
          ));

          await prisma.sale.update({
            where: { id: saleId },
            data: { status: SaleStatus.CONFIRMED, bookingStatus: BookingStatus.RESERVED },
          });

          return fullSale;
        });
      }
    );
  },

  async generateInvoice(saleId, ctx, overrides) {
    return runInTransaction(undefined, async (prisma) => {
      const sale = await prisma.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
      if (!sale) throw new ServiceError('ไม่พบรายการขาย');

      await prisma.sale.update({
        where: { id: saleId },
        data: { status: SaleStatus.INVOICED, isLocked: true },
      });

      return { invoiceNumber: sale.invoiceNumber };
    });
  },

  async completeSale(saleId: string, ctx: RequestContext, tx?: Prisma.TransactionClient) {
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    await AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.COMPLETE(sale.invoiceNumber),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const fullSale = await prisma.sale.findFirst({
            where: { id: saleId, shopId: ctx.shopId },
            include: { items: true },
          });

          if (!fullSale) throw new ServiceError('ไม่พบรายการขาย');
          if (fullSale.status === SaleStatus.COMPLETED) return fullSale;

          if (fullSale.paymentStatus === 'UNPAID') {
            throw new ServiceError(
              'กรุณายืนยันการชำระเงินก่อนปิดการขาย',
              undefined,
              { label: 'ไปที่หน้าตรวจสอบการชำระเงิน', href: `/sales/${saleId}` }
            );
          }

          await Promise.all(fullSale.items.map(item =>
            StockService.deductStock(item.productId, item.quantity, ctx, prisma, { saleId })
          ));

          const updated = await prisma.sale.update({
            where: { id: saleId },
            data: {
              status: SaleStatus.COMPLETED,
              bookingStatus: BookingStatus.DEDUCTED,
              isLocked: true,
            },
            include: { items: true }
          });

          return updated;
        });
      }
    );
  },

  async getLockedFields(saleId, ctx) {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
      select: { status: true, isLocked: true },
    });

    if (!sale) return [];

    const locked = [];
    if (sale.isLocked || sale.status === SaleStatus.INVOICED || sale.status === SaleStatus.COMPLETED) {
      locked.push('items', 'customerId', 'discountType', 'discountValue');
    }
    if (sale.status === SaleStatus.COMPLETED) {
      locked.push('paymentMethod', 'notes');
    }

    return locked;
  },

  async releaseStock(saleId: string, ctx: RequestContext, tx: Prisma.TransactionClient) {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
      include: { items: true },
    });

    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    if (sale.bookingStatus === BookingStatus.RESERVED) {
      await Promise.all(sale.items.map(item =>
        StockService.releaseStock(item.productId, item.quantity, ctx, tx)
      ));

      await tx.sale.update({
        where: { id: saleId },
        data: { bookingStatus: BookingStatus.NONE },
      });
    }
  }
};
