import { db, runInTransaction } from '@/lib/db';
import { Prisma, Sale } from '@prisma/client';
import { SaleInput } from '@/schemas/sale';
import { StockService } from './stock.service';
import { NotificationService } from './notification.service';
// Types imported from @/types/domain
import { money, toNumber, calcSubtotal, calcProfit } from '@/lib/money';
import { logger } from '@/lib/logger';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';

import { 
  RequestContext, 
  ServiceError, 
  GetSalesParams,
  DocumentType,
  BookingStatus,
  SaleStatus,
  SerializedSale,
  SerializedSaleWithItems,
} from '@/types/domain';
import { ISaleService } from '@/types/service-contracts';
import { SequenceService } from './sequence.service';
import { CustomerService } from './customer.service';
import { AuditService } from './audit.service';
import { SALE_AUDIT_POLICIES } from './sale.policy';
import { Security } from './security';

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

const MAX_INVOICE_RETRIES = 5;

// Replaced by SequenceService

export const SaleService: ISaleService = {
  /**
   * บันทึกการขายใหม่ พร้อมลดสต็อกอัตโนมัติ
   */
  async create(ctx: RequestContext, payload: SaleInput, tx?: Prisma.TransactionClient): Promise<SerializedSale> {
    Security.requirePermission(ctx, 'SALE_CREATE');
    const { items, customerAddress, ...saleData } = payload;

    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    // Wrap with Audit Policy
    // We don't have the invoiceNumber yet, so we use a placeholder or partial policy
    // Actually, we can just run the audit log with the final result.
    return AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.CREATE(saleData.customerName || 'New Sale'), // Temporary label, summaryBuilder will catch the rest
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
            select: { id: true, name: true, costPrice: true, stock: true, reservedStock: true },
          });

          const productDataMap = new Map(
            products.map(p => [p.id, {
              id: p.id,
              name: p.name,
              costPrice: toNumber(p.costPrice),
              stock: p.stock,
              reservedStock: p.reservedStock,
            }])
          );

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
            const itemCost = calcSubtotal(item.quantity, product.costPrice);

            totalAmount = money.add(totalAmount, subtotal);
            totalCost = money.add(totalCost, itemCost);

            saleItemsToCreate.push({
              productId: item.productId,
              quantity: item.quantity,
              salePrice: item.salePrice,
              costPrice: product.costPrice,
              subtotal: subtotal,
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
            const creditStatus = await CustomerService.checkCreditLimit(finalCustomerId, netAmount, ctx);
            if (!creditStatus.isWithinLimit) throw new ServiceError(`เกินวงเงินเครดิต: ${creditStatus.availableCredit}`);
          }

          // 5. Create Sale
          const sale = await prisma.sale.create({
            data: {
              customerId: finalCustomerId || null,
              userId: ctx.userId,
              shopId: ctx.shopId,
              invoiceNumber,
              date: saleData.date ? new Date(saleData.date) : new Date(),
              paymentMethod: saleData.paymentMethod,
              notes: saleData.notes || null,
              departmentCode,
              totalAmount,
              totalCost,
              profit: calcProfit(netAmount, totalCost),
              discountType: saleData.discountType,
              discountValue: saleData.discountValue,
              discountAmount: billDiscountAmount,
              netAmount,
              paymentStatus: saleData.paymentMethod === 'CREDIT' ? 'PENDING' : 'VERIFIED',
              items: { create: saleItemsToCreate },
            },
            include: { items: true },
          });

          // 6. Record Stock Reservation
          await Promise.all(sale.items.map(item => 
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
            message: `ยอดรวม ${toNumber(netAmount)} บาท`,
            link: `/sales/${sale.id}`,
          }).catch(() => {});

          return {
            ...updatedSale,
            totalAmount: Number(updatedSale.totalAmount),
            totalCost: Number(updatedSale.totalCost),
            profit: Number(updatedSale.profit),
            discountAmount: Number(updatedSale.discountAmount),
            discountValue: updatedSale.discountValue ? Number(updatedSale.discountValue) : null,
            netAmount: Number(updatedSale.netAmount),
          };
        });
      }
    );
  },

  /**
   * แก้ไขข้อมูลการขาย (Metadata)
   * หมายเหตุ: ไม่อนุญาตให้แก้ items หากสถานะถูก Lock แล้ว (Invoiced/Completed)
   */
  async update(id: string, ctx: RequestContext, payload: any): Promise<SerializedSale> {
    Security.requirePermission(ctx, 'SALE_CREATE');
    const sale = await db.sale.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!sale) throw new ServiceError('ไม่พบรายการขาย');
    
    return AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.UPDATE(sale.invoiceNumber, payload),
      async () => {
        // ERP Rule: Locked data protection
        if (sale.isLocked || sale.status === 'INVOICED' || sale.status === 'COMPLETED') {
            const { notes, paymentMethod, channel } = payload;
            const updated = await db.sale.update({
                where: { id },
                data: { 
                    notes: notes !== undefined ? notes : sale.notes,
                    paymentMethod: paymentMethod !== undefined ? paymentMethod : sale.paymentMethod,
                    channel: channel !== undefined ? channel : sale.channel,
                },
            });
            return {
                ...updated,
                totalAmount: Number(updated.totalAmount),
                totalCost: Number(updated.totalCost),
                profit: Number(updated.profit),
                discountAmount: Number(updated.discountAmount),
                discountValue: updated.discountValue ? Number(updated.discountValue) : null,
                netAmount: Number(updated.netAmount),
            };
        }

        const updated = await db.sale.update({
          where: { id },
          data: payload,
        });

        return {
            ...updated,
            totalAmount: Number(updated.totalAmount),
            totalCost: Number(updated.totalCost),
            profit: Number(updated.profit),
            discountAmount: Number(updated.discountAmount),
            discountValue: updated.discountValue ? Number(updated.discountValue) : null,
            netAmount: Number(updated.netAmount),
        };
      }
    );
  },

  /**
   * ลบการขาย (Soft-Delete/Cancel)
   */
  async delete(id: string, ctx: RequestContext): Promise<void> {
    return this.cancel({ id, reasonCode: 'SYSTEM_DELETE', reasonDetail: 'Deleted by user' }, ctx);
  },

  /**
   * ดึงข้อมูลการขายทั้งหมด (Pagination)
   */
  async getList(params: GetSalesParams = {}, ctx: RequestContext, options: { canViewProfit?: boolean } = {}) {
    Security.requirePermission(ctx, 'SALE_VIEW');
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod, channel, status } = params;
    const { canViewProfit = false } = options;

    if (canViewProfit) {
      Security.requirePermission(ctx, 'SALE_VIEW_PROFIT');
    }

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

    const result = await paginatedQuery<any>(db.sale as any, {
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        customer: { select: { name: true } },
      },
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    // Mutate in-place: avoid creating new objects (reduces GC pressure significantly)
    for (const sale of result.data) {
      (sale as any).totalAmount = Number(sale.totalAmount);
      (sale as any).totalCost = canViewProfit ? Number(sale.totalCost) : 0;
      (sale as any).profit = canViewProfit ? Number(sale.profit) : 0;
      (sale as any).discountAmount = Number(sale.discountAmount);
      (sale as any).discountValue = sale.discountValue ? Number(sale.discountValue) : null;
      (sale as any).netAmount = Number(sale.netAmount);
      for (const item of (sale as any).items) {
        item.salePrice = Number(item.salePrice);
        item.costPrice = canViewProfit ? Number(item.costPrice) : 0;
        item.subtotal = Number(item.subtotal);
        item.profit = canViewProfit ? Number(item.profit) : 0;
        item.discountAmount = Number(item.discountAmount);
      }
    }

    return result;
  },

  /**
   * ดึงข้อมูลการขายตาม ID
   */
  async getById(id: string, ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<SerializedSaleWithItems> {
    Security.requirePermission(ctx, 'SALE_VIEW');
    const { canViewProfit = false } = options;

    if (canViewProfit) {
      Security.requirePermission(ctx, 'SALE_VIEW_PROFIT');
    }

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

    if (!sale) {
      throw new ServiceError('ไม่พบข้อมูลการขาย');
    }

    // Mutate in-place: avoid creating new objects
    const saleAny = sale as any;
    saleAny.totalAmount = Number(sale.totalAmount);
    saleAny.totalCost = canViewProfit ? Number(sale.totalCost) : 0;
    saleAny.profit = canViewProfit ? Number(sale.profit) : 0;
    saleAny.discountAmount = Number(sale.discountAmount);
    saleAny.discountValue = sale.discountValue ? Number(sale.discountValue) : null;
    saleAny.netAmount = Number(sale.netAmount);
    for (const item of saleAny.items) {
      item.salePrice = Number(item.salePrice);
      item.costPrice = canViewProfit ? Number(item.costPrice) : 0;
      item.subtotal = Number(item.subtotal);
      item.profit = canViewProfit ? Number(item.profit) : 0;
      item.discountAmount = Number(item.discountAmount);
      
      // Add real-time stock status (UC 2)
      let virtualStockStatus = 'ยังไม่จองสต็อก';
      if (sale.status === SaleStatus.CONFIRMED || sale.status === SaleStatus.INVOICED) {
          virtualStockStatus = 'จองสต็อกแล้ว';
      }
      if (sale.shipments.some(s => s.status === 'DELIVERED')) {
          virtualStockStatus = 'ตัดสต็อกแล้ว';
      }

      if (item.product) {
        item.stockStatus = {
            onHand: item.product.stock,
            reserved: item.product.reservedStock,
            available: item.product.stock - item.product.reservedStock,
            statusLabel: virtualStockStatus, // UC 2
        };
      }
    }

    return saleAny;
  },

  /**
   * สรุปยอดขายวันนี้ 
   */
  async getTodayAggregate(ctx: RequestContext, options: { canViewProfit?: boolean } = {}) {
    const { canViewProfit = false } = options;
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
      totalAmount: toNumber(result._sum.netAmount),
      profit: canViewProfit ? toNumber(result._sum.profit) : null,
      count: result._count,
    };
  },

  /**
   * ดึงรายการขายล่าสุด
   */
  async getRecentList(limit: number, ctx: RequestContext, options: { canViewProfit?: boolean } = {}) {
    Security.requirePermission(ctx, 'SALE_VIEW');
    const { canViewProfit = false } = options;

    const sales = await db.sale.findMany({
      where: { shopId: ctx.shopId },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sales.map(sale => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      totalCost: canViewProfit ? Number(sale.totalCost) : 0,
      profit: canViewProfit ? Number(sale.profit) : 0,
      discountAmount: Number(sale.discountAmount),
      netAmount: Number(sale.netAmount),
    }));
  },

  /**
   * ยกเลิกรายการขาย
   */
  async cancel(input: CancelSaleInput, ctx: RequestContext) {
    Security.requirePermission(ctx, 'SALE_CANCEL');
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

          // Auto-cancel shipments & expenses
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

          // Restore Stock Logic (Release Reservation or Restore DEDUCTED stock)
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
          const updated = await prisma.sale.update({
            where: { id },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userNameResult?.name || 'System', cancelReason },
          });

          return { ...fullSale, status: 'CANCELLED' };
        });
      }
    );
  },

  /**
   * ยืนยัน/ปฏิเสธ การชำระเงิน
   */
  async verifyPayment(saleId: string, status: 'VERIFIED' | 'REJECTED', note: string | undefined, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PAYMENT_VERIFY');
    const existingSale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
    });

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
            paymentStatus: status,
            paymentVerifiedAt: new Date(),
            paymentVerifiedBy: ctx.userId,
            paymentNote: note || null,
          },
        });
      }
    );
  },

  /**
   * อัปโหลดสลิป
   */
  async uploadPaymentProof(saleId: string, proofUrl: string, ctx: RequestContext) {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
    });

    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    await db.sale.update({
      where: { id: saleId },
      data: {
        paymentProof: proofUrl,
        paymentStatus: 'PENDING',
      },
    });
  },

  // ==========================================
  // ERP ENHANCED METHODS
  // ==========================================

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
      const sale = await prisma.sale.findFirst({
        where: { id: saleId, shopId: ctx.shopId },
      });

      if (!sale) throw new ServiceError('ไม่พบรายการขาย');
      
      await prisma.sale.update({
        where: { id: saleId },
        data: { 
          status: SaleStatus.INVOICED,
          isLocked: true, 
        },
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

          await Promise.all(fullSale.items.map(item => 
            StockService.deductStock(item.productId, item.quantity, ctx, prisma)
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
    
    // Only release if it was reserved
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
