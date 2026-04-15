import { db } from '@/lib/db';
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
    const { items, customerAddress, ...saleData } = payload;

    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    const executeTransaction = async (prismaTx: Prisma.TransactionClient) => {
      // 1. Generate Invoice Number with Department awareness
      const departmentCode = ctx.employeeDepartment || null;
      
      const invoiceNumber = await SequenceService.generate(ctx, DocumentType.SALE_INVOICE, prismaTx, {
        departmentCode: departmentCode || undefined,
      });

      // 2. Validate Products & Pre-check stock (Batch: 1 query instead of N)
      const productIds = items.map(item => item.productId);
      const products = await prismaTx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, costPrice: true, stock: true, reservedStock: true },
      });

      interface ProductData {
        id: string;
        name: string;
        costPrice: number;
        stock: number;
        reservedStock: number;
      }
      const productDataMap = new Map<string, ProductData>(
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
        if (!product) {
          throw new ServiceError(`ไม่พบสินค้า ID: ${item.productId}`);
        }
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
        const costPrice = product.costPrice;
        
        const itemDiscount = item.discountAmount ?? 0;
        const effectivePrice = money.subtract(item.salePrice, itemDiscount);
        const subtotal = calcSubtotal(item.quantity, effectivePrice);
        const itemCost = calcSubtotal(item.quantity, costPrice);
        const itemProfit = calcProfit(subtotal, itemCost);

        totalAmount = money.add(totalAmount, subtotal);
        totalCost = money.add(totalCost, itemCost);

        saleItemsToCreate.push({
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          costPrice: costPrice,
          subtotal: subtotal,
          profit: itemProfit,
          discountAmount: itemDiscount,
        });
      }

      // Bill-level discount
      let billDiscountAmount = 0;
      const discountType = saleData.discountType || null;
      const discountValue = saleData.discountValue ?? 0;
      
      if (discountType === 'PERCENT' && discountValue > 0) {
        billDiscountAmount = money.round(money.multiply(totalAmount, money.divide(discountValue, 100)));
      } else if (discountType === 'FIXED' && discountValue > 0) {
        billDiscountAmount = discountValue;
      }
      
      if (billDiscountAmount > totalAmount) {
        billDiscountAmount = totalAmount;
      }
      
      const netAmount = money.subtract(totalAmount, billDiscountAmount);
      const profit = calcProfit(netAmount, totalCost);

      // 4. ERP Rule 6: Check Credit Limit
      if (saleData.customerId) {
        const creditStatus = await CustomerService.checkCreditLimit(saleData.customerId, netAmount, ctx);
        if (!creditStatus.isWithinLimit) {
          throw new ServiceError(
            `ไม่สามารถเปิดบิลได้เนื่องจากเกินวงเงินเครดิต (วงเงินคงเหลือ: ${creditStatus.availableCredit}, ยอดบิลนี้: ${netAmount})`
          );
        }
      }

      // 5. Handle Customer
      let finalCustomerId = saleData.customerId;

      if (finalCustomerId && customerAddress) {
        await prismaTx.customer.update({
          where: { id: finalCustomerId },
          data: { address: customerAddress },
        });
      } else if (!finalCustomerId && saleData.customerName) {
        const existing = await prismaTx.customer.findFirst({
          where: { shopId: ctx.shopId, name: saleData.customerName, deletedAt: null },
        });

        if (existing) {
          finalCustomerId = existing.id;
          if (customerAddress) {
            await prismaTx.customer.update({
              where: { id: existing.id },
              data: { address: customerAddress },
            });
          }
        } else {
          const newC = await prismaTx.customer.create({
            data: {
              userId: ctx.userId,
              shopId: ctx.shopId,
              name: saleData.customerName,
              address: customerAddress || null,
            },
          });
          finalCustomerId = newC.id;
        }
      }

      // 5. Handle Credit Limit (ERP Module 2 & 6)
      if (saleData.paymentMethod === 'CREDIT' && finalCustomerId) {
        const customer = await prismaTx.customer.findUnique({
          where: { id: finalCustomerId },
          select: { creditLimit: true, name: true },
        });

        if (customer && customer.creditLimit) {
          // Calculate current outstanding (mock/simplified: total of unbilled/unpaid sales)
          const outstanding = await prismaTx.sale.aggregate({
            where: { customerId: finalCustomerId, billingStatus: { not: 'PAID' }, status: { not: 'CANCELLED' } },
            _sum: { netAmount: true },
          });

          const currentDebt = toNumber(outstanding._sum.netAmount || 0);
          const newDebt = currentDebt + netAmount;

          if (newDebt > toNumber(customer.creditLimit)) {
             throw new ServiceError(
                `วงเงินเครดิตไม่พอ (ลูกค้า: ${customer.name}): วงเงิน ฿${toNumber(customer.creditLimit).toLocaleString()}, ` +
                `ยอดค้างเดิม ฿${currentDebt.toLocaleString()}, ยอดใหม่ ฿${netAmount.toLocaleString()}`
             );
          }
        }
      }

      // 6. Create Sale
      const paymentStatus = saleData.paymentMethod === 'CREDIT' ? 'PENDING' : 'VERIFIED';
      
      const sale = await prismaTx.sale.create({
        data: {
          customerId: finalCustomerId || null,
          userId: ctx.userId,
          shopId: ctx.shopId,
          invoiceNumber,
          date: saleData.date ? new Date(saleData.date) : new Date(),
          paymentMethod: saleData.paymentMethod,
          notes: saleData.notes || null,
          receiptUrl: saleData.receiptUrl || null,
          departmentCode,
          totalAmount,
          totalCost,
          profit,
          discountType: discountType,
          discountValue: discountValue || null,
          discountAmount: billDiscountAmount,
          netAmount,
          paymentStatus,
          items: {
            create: saleItemsToCreate,
          },
        },
        include: { items: true },
      });

      // 6. Record Stock Reservation (New ERP Logic: Initial sale create = RESERVED)
      // If payment is already verified (POS style), we might want to DEDUCT immediately.
      // But for ERP standardized flow, we use RESERVED first.
      await Promise.all(sale.items.map(item => 
        StockService.reserveStock(item.productId, item.quantity, ctx, prismaTx)
      ));
      
      await prismaTx.sale.update({
        where: { id: sale.id },
        data: { 
          bookingStatus: BookingStatus.RESERVED,
          status: SaleStatus.CONFIRMED 
        }
      });

      // ERP Rule 12.1: Audit Create (Level 2 Snapshot)
      await AuditService.log(ctx, {
        action: 'SALE_CREATE',
        entityType: 'Sale',
        entityId: sale.id,
        metadata: sale,
        note: `สร้างรายการขาย ${sale.invoiceNumber}`,
      });

      // 7. Create Notification (Async/Non-blocking)
      NotificationService.create({
        shopId: ctx.shopId,
        type: 'NEW_SALE',
        severity: 'INFO',
        title: `ยอดขายใหม่ ${sale.invoiceNumber}`,
        message: `ยอดรวม ${toNumber(sale.totalAmount)} บาท`,
        link: `/sales/${sale.id}`,
      }).catch(() => {});

      return {
        ...sale,
        totalAmount: Number(sale.totalAmount),
        totalCost: Number(sale.totalCost),
        profit: Number(sale.profit),
        discountAmount: Number(sale.discountAmount),
        discountValue: sale.discountValue ? Number(sale.discountValue) : null,
        netAmount: Number(sale.netAmount),
      };
    };

    if (tx) {
      return executeTransaction(tx);
    } else {
      return db.$transaction(executeTransaction);
    }
  },

  /**
   * แก้ไขข้อมูลการขาย (Metadata)
   * หมายเหตุ: ไม่อนุญาตให้แก้ items หากสถานะถูก Lock แล้ว (Invoiced/Completed)
   */
  async update(id: string, ctx: RequestContext, payload: any): Promise<SerializedSale> {
    const sale = await db.sale.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!sale) throw new ServiceError('ไม่พบรายการขาย');
    
    // ERP Rule: Locked data protection
    if (sale.isLocked || sale.status === 'INVOICED' || sale.status === 'COMPLETED') {
        const { notes, paymentMethod, channel } = payload;
        // Allow updating only certain metadata when locked
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

    // Full update if not locked (Simplified for now: metadata only)
    // In a full implementation, this should handle item diffs and stock reversal
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
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod, channel, status } = params;
    const { canViewProfit = false } = options;

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
    const { canViewProfit = false } = options;

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
      profit: canViewProfit ? toNumber(result._sum.profit) : 0,
      count: result._count,
    };
  },

  /**
   * รายการขายล่าสุด
   */
  async getRecentList(limit: number = 5, ctx: RequestContext, options: { canViewProfit?: boolean } = {}) {
    const { canViewProfit = false } = options;

    const sales = await db.sale.findMany({
      where: { shopId: ctx.shopId },
      include: { customer: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: limit,
    });

    // Mutate in-place: avoid creating new objects
    for (const sale of sales) {
      (sale as any).totalAmount = Number(sale.totalAmount);
      (sale as any).totalCost = canViewProfit ? Number(sale.totalCost) : 0;
      (sale as any).profit = canViewProfit ? Number(sale.profit) : 0;
      (sale as any).discountAmount = Number(sale.discountAmount);
      (sale as any).netAmount = Number(sale.netAmount);
    }

    return sales;
  },

  /**
   * ยกเลิกการขาย (Soft Cancel + คืนสต็อก)
   */
  async cancel(input: CancelSaleInput, ctx: RequestContext) {
    const { id, reasonCode, reasonDetail } = input;

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    });
    const userName = user?.name || 'Unknown';

    if (!reasonCode) throw new ServiceError('กรุณาเลือกเหตุผลในการยกเลิก');
    if (reasonCode === 'OTHER' && !reasonDetail?.trim()) throw new ServiceError('กรุณากรอกรายละเอียดเหตุผล');

    const cancelReason = reasonCode === 'OTHER' 
      ? `${CANCEL_REASONS.OTHER}: ${reasonDetail}` 
      : (CANCEL_REASONS as Record<string, string>)[reasonCode] || reasonCode;

    await db.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, shopId: ctx.shopId },
        include: { items: { include: { returnItems: { select: { quantity: true } } } } },
      });

      if (!sale) throw new ServiceError('ไม่พบข้อมูลการขาย');
      if (sale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

      // Auto-cancel shipments & expenses
      const linkedShipments = await tx.shipment.findMany({
        where: { saleId: id, status: { not: 'CANCELLED' } },
        select: { id: true, shipmentNumber: true },
      });
      
      for (const linkedShipment of linkedShipments) {
        await tx.shipment.update({
          where: { id: linkedShipment.id },
          data: { status: 'CANCELLED', notes: `ยกเลิกอัตโนมัติ: Sale ${sale.invoiceNumber} ถูกยกเลิก` },
        });

        await tx.expense.deleteMany({
          where: { shopId: ctx.shopId, category: 'ค่าจัดส่ง', description: { contains: linkedShipment.shipmentNumber } },
        });
      }

      await tx.return.updateMany({
        where: { saleId: id, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      });

      // คืนสต็อก (Smart Standard Logic)
      // - ถ้า BookingStatus = RESERVED -> เรียก releaseStock (คืนโควต้าจอง ไม่บวกสต็อกจริง)
      // - ถ้า BookingStatus = DEDUCTED -> เรียก recordMovements (บวกสต็อกจริง เพราะเคยหักไปแล้ว)
      
      if (sale.bookingStatus === BookingStatus.RESERVED) {
        // คืนโควต้าจอง
        await Promise.all(sale.items.map(item => {
           const alreadyReturned = item.returnItems.reduce((sum: number, ri: any) => sum + ri.quantity, 0);
           const releaseQty = item.quantity - alreadyReturned;
           if (releaseQty > 0) {
             return StockService.releaseStock(item.productId, releaseQty, ctx, tx);
           }
           return Promise.resolve();
        }));
      } else if (sale.bookingStatus === BookingStatus.DEDUCTED) {
        // คืนสต็อกจริง
        const stockRestoreMovements = sale.items
          .map(item => {
            const alreadyReturned = item.returnItems.reduce((sum: number, ri: any) => sum + ri.quantity, 0);
            const restoreQty = item.quantity - alreadyReturned;
            return { item, restoreQty, alreadyReturned };
          })
          .filter(({ restoreQty }) => restoreQty > 0)
          .map(({ item, restoreQty, alreadyReturned }) => ({
            productId: item.productId,
            type: 'SALE_CANCEL' as const,
            quantity: restoreQty,
            saleId: sale.id,
            userId: ctx.userId,
            shopId: sale.shopId || ctx.shopId,
            note: `ยกเลิกการขาย ${sale.invoiceNumber} - ${cancelReason}` + (alreadyReturned > 0 ? ` (คืนแล้ว ${alreadyReturned} ชิ้น)` : ''),
          }));

          if (stockRestoreMovements.length > 0) {
            await StockService.recordMovements(stockRestoreMovements, tx);
          }
      }

      await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userName, cancelReason },
      });

      // ERP Rule 12.1: Audit Cancel (Level 2 Snapshot)
      await AuditService.log(ctx, {
        action: 'SALE_CANCEL',
        entityType: 'Sale',
        entityId: id,
        metadata: sale,
        note: `ยกเลิกรายการขาย ${sale.invoiceNumber}: ${cancelReason}`,
      });
    });
  },

  /**
   * ยืนยัน/ปฏิเสธ การชำระเงิน
   */
  async verifyPayment(saleId: string, status: 'VERIFIED' | 'REJECTED', note: string | undefined, ctx: RequestContext) {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
    });

    if (!sale) throw new ServiceError('ไม่พบรายการขาย');
    if (sale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกแล้ว');

    await db.sale.update({
      where: { id: saleId },
      data: {
        paymentStatus: status,
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: ctx.userId,
        paymentNote: note || null,
      },
    });

    // ERP Rule 12.1: Audit Payment Verification
    await AuditService.log(ctx, {
      action: 'SALE_PAYMENT_VERIFY',
      entityType: 'Sale',
      entityId: saleId,
      metadata: { status, note },
      note: `ยืนยันการชำระเงิน: ${status}`,
    });
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
    await db.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, shopId: ctx.shopId },
        include: { items: true },
      });

      if (!sale) throw new ServiceError('ไม่พบรายการขาย');
      if (sale.status !== SaleStatus.DRAFT) {
        throw new ServiceError('รายการนี้ไม่ได้อยู่ในสถานะร่าง');
      }

      // Reserve stock for all items
      await Promise.all(sale.items.map(item => 
        StockService.reserveStock(item.productId, item.quantity, ctx, tx)
      ));

      await tx.sale.update({
        where: { id: saleId },
        data: { 
          status: SaleStatus.CONFIRMED,
          bookingStatus: BookingStatus.RESERVED,
        },
      });

      // ERP Rule 12.1: Audit Confirm
      await AuditService.log(ctx, {
        action: 'SALE_CONFIRM',
        entityType: 'Sale',
        entityId: saleId,
        metadata: sale,
        note: `ยืนยันการขาย ${sale.invoiceNumber}`,
      });
    });
  },

  async generateInvoice(saleId, ctx, overrides) {
    return await db.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, shopId: ctx.shopId },
      });

      if (!sale) throw new ServiceError('ไม่พบรายการขาย');
      
      // If already has invoice number from sequence (not compound but legitimate)
      // In this system, we currently generate it at 'create' for backward compatibility.
      // But let's assume we can re-generate or lock it here.
      
      await tx.sale.update({
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
    const execute = async (prismaTx: Prisma.TransactionClient) => {
      const sale = await prismaTx.sale.findFirst({
        where: { id: saleId, shopId: ctx.shopId },
        include: { items: true },
      });

      if (!sale) throw new ServiceError('ไม่พบรายการขาย');
      if (sale.status === SaleStatus.COMPLETED) return;

      // Deduct stock (onHand - reservedStock)
      await Promise.all(sale.items.map(item => 
        StockService.deductStock(item.productId, item.quantity, ctx, prismaTx)
      ));

      await prismaTx.sale.update({
        where: { id: saleId },
        data: { 
          status: SaleStatus.COMPLETED,
          bookingStatus: BookingStatus.DEDUCTED,
          isLocked: true,
        },
      });

      // ERP Rule 12.1: Audit Complete
      await AuditService.log(ctx, {
        action: 'SALE_COMPLETE',
        entityType: 'Sale',
        entityId: saleId,
        metadata: sale,
        note: `จบการขาย (ตัดสต็อกแล้ว) ${sale.invoiceNumber}`,
      });
    };

    if (tx) {
      return execute(tx);
    } else {
      return db.$transaction(execute);
    }
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
