import { db } from '@/lib/db';
import { Prisma, Sale } from '@prisma/client';
import { SaleInput } from '@/schemas/sale';
import { StockService } from './stock.service';
import { NotificationService } from './notification.service';
import { ServiceError, RequestContext } from './product.service';
import { money, toNumber, calcSubtotal, calcProfit } from '@/lib/money';
import { logger } from '@/lib/logger';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';

export interface GetSalesParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  channel?: string;
  status?: string;
}

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

async function generateInvoiceNumber(shopId: string, tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_INVOICE_RETRIES; attempt++) {
    const lastSale = await tx.sale.findFirst({
      where: { shopId },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    const lastNumber = lastSale
      ? parseInt(lastSale.invoiceNumber.split('-')[1] || '0')
      : 0;

    const newNumber = lastNumber + 1 + attempt;
    const invoiceNumber = `INV-${String(newNumber).padStart(5, '0')}`;

    const exists = await tx.sale.findFirst({
      where: { shopId, invoiceNumber },
      select: { id: true }
    });

    if (!exists) {
      return invoiceNumber;
    }

    await logger.warn('Invoice number collision, retrying', {
      invoiceNumber,
      attempt,
      shopId
    });
  }

  throw new ServiceError('ไม่สามารถสร้างเลข Invoice ได้ กรุณาลองใหม่');
}

export const SaleService = {
  /**
   * บันทึกการขายใหม่ พร้อมลดสต็อกอัตโนมัติ
   */
  async create(ctx: RequestContext, payload: SaleInput, tx?: Prisma.TransactionClient): Promise<Sale> {
    const { items, customerAddress, ...saleData } = payload;

    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    const executeTransaction = async (prismaTx: Prisma.TransactionClient) => {
      // 1. Generate Invoice
      const invoiceNumber = await generateInvoiceNumber(ctx.shopId, prismaTx);

      // 2. Validate Products & Pre-check stock (Batch: 1 query instead of N)
      const productIds = items.map(item => item.productId);
      const products = await prismaTx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, costPrice: true, stock: true },
      });

      interface ProductData {
        id: string;
        name: string;
        costPrice: number;
        stock: number;
      }
      const productDataMap = new Map<string, ProductData>(
        products.map(p => [p.id, {
          id: p.id,
          name: p.name,
          costPrice: toNumber(p.costPrice),
          stock: p.stock,
        }])
      );

      for (const item of items) {
        const product = productDataMap.get(item.productId);
        if (!product) {
          throw new ServiceError(`ไม่พบสินค้า ID: ${item.productId}`);
        }
        if (product.stock < item.quantity) {
          throw new ServiceError(`สินค้า "${product.name}" มีสต็อกไม่พอ (เหลือ ${product.stock})`);
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

      // 4. Handle Customer
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

      // 5. Create Sale
      const paymentStatus = 'VERIFIED';
      
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

      // 6. Record Stock Movements (Bulk: 1 batch instead of N sequential calls)
      await StockService.recordMovements(
        sale.items.map(item => ({
          productId: item.productId,
          type: 'SALE' as const,
          quantity: -item.quantity,
          saleId: sale.id,
          userId: ctx.userId,
          shopId: ctx.shopId,
          note: `ขาย: ${sale.invoiceNumber}`,
          date: sale.date,
          requireStock: true,
        })),
        prismaTx
      );

      // 7. Create Notification (Async/Non-blocking)
      NotificationService.create({
        shopId: ctx.shopId,
        type: 'NEW_SALE',
        severity: 'INFO',
        title: `ยอดขายใหม่ ${sale.invoiceNumber}`,
        message: `ยอดรวม ${toNumber(sale.totalAmount)} บาท`,
        link: `/sales/${sale.id}`,
      }).catch(() => {});

      return sale;
    };

    if (tx) {
      return executeTransaction(tx);
    } else {
      return db.$transaction(executeTransaction);
    }
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
  async getById(id: string, ctx: RequestContext, options: { canViewProfit?: boolean } = {}) {
    const { canViewProfit = false } = options;

    const sale = await db.sale.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
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

      // คืนสต็อก (Bulk: compute all quantities, then batch update)
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

      await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userName, cancelReason },
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
  }
};
