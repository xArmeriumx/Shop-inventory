'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requirePermission, hasPermission } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { saleSchema, type SaleInput } from '@/schemas/sale';
import { NotificationService } from '@/lib/notification-service';
import type { Sale, SaleItem, Prisma } from '@prisma/client';
import { StockService } from '@/lib/stock-service';
import type { ActionResponse } from '@/types/action-response';
import { money, toNumber, calcSubtotal, calcProfit } from '@/lib/money';
import { z } from 'zod';

// =============================================================================
// UTILITIES
// =============================================================================

const MAX_INVOICE_RETRIES = 5;

/**
 * Generates a unique invoice number with retry logic for race condition handling.
 */
async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  shopId: string
): Promise<string> {
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

  throw new Error('ไม่สามารถสร้างเลข Invoice ได้ กรุณาลองใหม่');
}

interface GetSalesParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  channel?: string;
  status?: string;
}

type SaleWithItems = Sale & {
  items: (SaleItem & {
    product: {
      name: string;
    };
  })[];
  customer: {
    name: string;
  } | null;
};

// ดึงข้อมูลการขายทั้งหมด (Pagination)
export async function getSales(params: GetSalesParams = {}) {
  // Require View Permission
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');

  const {
    page = 1,
    limit = 20,
    search,
    startDate,
    endDate,
    paymentMethod,
    channel,
    status,
  } = params;

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

  const result = await paginatedQuery<SaleWithItems>(db.sale as any, {
    where,
    include: {
      items: {
        include: {
          product: {
            select: { name: true },
          },
        },
      },
      customer: {
        select: { name: true },
      },
    },
    page,
    limit,
    orderBy: { date: 'desc' },
  });

  // Transform data to plain objects
  return {
    ...result,
    data: result.data.map(sale => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      totalCost: canViewProfit ? Number(sale.totalCost) : 0,
      profit: canViewProfit ? Number(sale.profit) : 0,
      // G4: Discount fields
      discountAmount: Number(sale.discountAmount),
      discountValue: sale.discountValue ? Number(sale.discountValue) : null,
      netAmount: Number(sale.netAmount),
      items: sale.items.map(item => ({
        ...item,
        salePrice: Number(item.salePrice),
        costPrice: canViewProfit ? Number(item.costPrice) : 0,
        subtotal: Number(item.subtotal),
        profit: canViewProfit ? Number(item.profit) : 0,
        discountAmount: Number(item.discountAmount),  // G4
      }))
    }))
  };
}

// ดึงข้อมูลการขายตาม ID
export async function getSale(id: string) {
  const ctx = await requirePermission('SALE_VIEW');

  const sale = await db.sale.findFirst({
    where: { id, shopId: ctx.shopId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
      customer: true,
      shipments: {
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          trackingNumber: true,
          shippingProvider: true,
          shippingCost: true,
        },
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!sale) {
    throw new Error('ไม่พบข้อมูลการขาย');
  }

  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');

  // Transform data to plain objects
  return {
    ...sale,
    totalAmount: Number(sale.totalAmount),
    totalCost: canViewProfit ? Number(sale.totalCost) : 0,
    profit: canViewProfit ? Number(sale.profit) : 0,
    // G4: Discount fields
    discountAmount: Number(sale.discountAmount),
    discountValue: sale.discountValue ? Number(sale.discountValue) : null,
    netAmount: Number(sale.netAmount),
    items: sale.items.map((item: any) => ({
      ...item,
      salePrice: Number(item.salePrice),
      costPrice: canViewProfit ? Number(item.costPrice) : 0,
      subtotal: Number(item.subtotal),
      profit: canViewProfit ? Number(item.profit) : 0,
      discountAmount: Number(item.discountAmount),  // G4
    }))
  };
}

// สร้างการขายใหม่
export async function createSale(input: SaleInput): Promise<ActionResponse<Sale>> {
  // RBAC: Require SALE_CREATE permission
  const ctx = await requirePermission('SALE_CREATE');

  // Validate input
  const validated = saleSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการขายไม่ถูกต้อง',
    };
  }

  const { items, customerAddress, ...saleData } = validated.data;

  // Validate items
  if (items.length === 0) {
    return {
      success: false,
      message: 'ต้องมีสินค้าอย่างน้อย 1 รายการ',
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // =================================================================
      // 0. Validate Shop Context (Required for multi-tenant operations)
      // =================================================================
      if (!ctx.shopId) {
        throw new Error('ไม่พบข้อมูลร้านค้า กรุณาเข้าสู่ระบบใหม่');
      }
      const shopId = ctx.shopId;

      // =================================================================
      // 1. Generate Invoice Number (with retry for race condition)
      // =================================================================
      const invoiceNumber = await generateInvoiceNumber(tx, shopId);

      // =================================================================
      // 2. Validate Products Exist & Get Product Data
      // =================================================================
      interface ProductData {
        id: string;
        name: string;
        costPrice: number;
        stock: number;
      }
      const productDataMap = new Map<string, ProductData>();

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, costPrice: true, stock: true },
        });

        if (!product) {
          throw new Error(`ไม่พบสินค้า ID: ${item.productId}`);
        }

        // Store for later use
        productDataMap.set(item.productId, {
          id: product.id,
          name: product.name,
          costPrice: toNumber(product.costPrice),
          stock: product.stock,
        });
      }

      // =================================================================
      // 3. Pre-check Stock Sufficiency (for user-friendly error message)
      // Actual stock reservation happens in Step 7 via StockService
      // =================================================================
      for (const item of items) {
        const product = productDataMap.get(item.productId)!;
        if (product.stock < item.quantity) {
          throw new Error(`สินค้า "${product.name}" มีสต็อกไม่พอ (เหลือ ${product.stock})`);
        }
      }

      // =================================================================
      // 4. Calculate Totals & Prepare Sale Items (with G4 Discounts)
      // =================================================================
      let totalAmount = 0;
      let totalCost = 0;
      const saleItemsToCreate = [];

      for (const item of items) {
        const product = productDataMap.get(item.productId)!;
        const costPrice = product.costPrice;
        
        // G4: Item-level discount (ส่วนลดต่อชิ้น)
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
          discountAmount: itemDiscount,  // G4
        });
      }

      // G4: Bill-level discount (ส่วนลดทั้งบิล)
      let billDiscountAmount = 0;
      const discountType = saleData.discountType || null;
      const discountValue = saleData.discountValue ?? 0;
      
      if (discountType === 'PERCENT' && discountValue > 0) {
        billDiscountAmount = money.round(money.multiply(totalAmount, money.divide(discountValue, 100)));
      } else if (discountType === 'FIXED' && discountValue > 0) {
        billDiscountAmount = discountValue;
      }
      
      // Ensure discount doesn't exceed totalAmount
      if (billDiscountAmount > totalAmount) {
        billDiscountAmount = totalAmount;
      }
      
      const netAmount = money.subtract(totalAmount, billDiscountAmount);
      const profit = calcProfit(netAmount, totalCost);

      // =================================================================
      // 5. Handle Customer
      // =================================================================
      let finalCustomerId = saleData.customerId;

      // Case 1: Existing Customer -> Check if address update is needed
      if (finalCustomerId && customerAddress) {
        await tx.customer.update({
          where: { id: finalCustomerId },
          data: { address: customerAddress },
        });
      }

      // Case 2: New Customer Name provided
      else if (!finalCustomerId && saleData.customerName) {
        const existing = await tx.customer.findFirst({
          where: { shopId, name: saleData.customerName, deletedAt: null },
        });

        if (existing) {
          finalCustomerId = existing.id;
          if (customerAddress) {
            await tx.customer.update({
              where: { id: existing.id },
              data: { address: customerAddress },
            });
          }
        } else {
          const newC = await tx.customer.create({
            data: {
              userId: ctx.userId,
              shopId,
              name: saleData.customerName,
              address: customerAddress || null,
            },
          });
          finalCustomerId = newC.id;
        }
      }

      // =================================================================
      // 6. Create Sale Record (Header + Items)
      // =================================================================
      // G1: Auto-verify cash payments, set PENDING for transfers
      // POS system: ทุกการขายที่บันทึก = ชำระแล้ว (ไม่มี PENDING flow)
      const paymentStatus = 'VERIFIED';
      
      const sale = await tx.sale.create({
        data: {
          customerId: finalCustomerId || null,
          userId: ctx.userId,
          shopId,
          invoiceNumber,
          date: saleData.date ? new Date(saleData.date) : new Date(),
          paymentMethod: saleData.paymentMethod,
          notes: saleData.notes || null,
          receiptUrl: saleData.receiptUrl || null,
          // Financials
          totalAmount,
          totalCost,
          profit,
          // G4: Discount fields
          discountType: discountType,
          discountValue: discountValue || null,
          discountAmount: billDiscountAmount,
          netAmount,
          // G1: Payment status
          paymentStatus,
          items: {
            create: saleItemsToCreate.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              salePrice: item.salePrice,
              costPrice: item.costPrice,
              subtotal: item.subtotal,
              profit: item.profit,
              discountAmount: item.discountAmount,  // G4
            })),
          },
        },
        include: { items: true },
      });

      // =================================================================
      // 7. Record Stock Movements (via StockService)
      // Handles: atomic stock decrement, StockLog, isLowStock, notifications
      // requireStock: true = reject if stock goes negative (race condition safe)
      // =================================================================
      for (const item of sale.items) {
        await StockService.recordMovement({
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity,
          saleId: sale.id,
          userId: ctx.userId,
          shopId,
          note: `ขาย: ${sale.invoiceNumber}`,
          date: sale.date,
          requireStock: true,
          tx,
        });
      }

      return sale;
    });

    revalidatePath('/sales');
    revalidatePath('/dashboard');

    // Notification: New sale (non-blocking)
    NotificationService.create({
      shopId: ctx.shopId,
      type: 'NEW_SALE',
      severity: 'INFO',
      title: `ยอดขายใหม่ ${result.invoiceNumber}`,
      message: `ยอดรวม ${result.totalAmount} บาท`,
      link: `/sales/${result.id}`,
    }).catch(() => {});

    return {
      success: true,
      message: 'บันทึกการขายสำเร็จ',
      data: result,
    };
  } catch (error: any) {
    await logger.error('Failed to create sale', error, { 
      path: 'createSale', 
      userId: ctx.userId,
      input 
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการบันทึกการขาย',
    };
  }
}

// ยกเลิกการขาย (Soft Cancel + คืนสต็อก)
const CANCEL_REASONS = {
  WRONG_ENTRY: 'บันทึกผิดพลาด',
  CUSTOMER_REQUEST: 'ลูกค้าขอยกเลิก',
  DAMAGED: 'สินค้าชำรุด',
  OTHER: 'อื่นๆ',
} as const;

interface CancelSaleInput {
  id: string;
  reasonCode: string;
  reasonDetail?: string; // Required if reasonCode is 'OTHER'
}

export async function cancelSale(input: CancelSaleInput) {
  // RBAC: Require SALE_CANCEL permission (Critical)
  const ctx = await requirePermission('SALE_CANCEL');
  const userId = ctx.userId; // For audit log (cancelledBy)
  
  const { id, reasonCode, reasonDetail } = input;

  // Validate: Cancel reason is required
  if (!reasonCode) {
    return { error: 'กรุณาเลือกเหตุผลในการยกเลิก' };
  }

  // Validate: If 'OTHER', reasonDetail is required
  if (reasonCode === 'OTHER' && !reasonDetail?.trim()) {
    return { error: 'กรุณากรอกรายละเอียดเหตุผล' };
  }

  // Build cancel reason text
  const cancelReason = reasonCode === 'OTHER' 
    ? `${CANCEL_REASONS.OTHER}: ${reasonDetail}` 
    : (CANCEL_REASONS as Record<string, string>)[reasonCode] || reasonCode;

  try {
    // Get current user name for audit
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await db.$transaction(async (tx) => {
      // Get sale with items + their return history
      const sale = await tx.sale.findFirst({
        where: { id, shopId: ctx.shopId },
        include: {
          items: {
            include: {
              returnItems: { select: { quantity: true } },
            },
          },
        },
      });

      if (!sale) {
        throw new Error('ไม่พบข้อมูลการขาย');
      }

      // Check if already cancelled
      if (sale.status === 'CANCELLED') {
        throw new Error('รายการนี้ถูกยกเลิกไปแล้ว');
      }

      // =================================================================
      // Auto-cancel linked shipments + cleanup auto-expenses
      // =================================================================
      const linkedShipments = await tx.shipment.findMany({
        where: { saleId: id, status: { not: 'CANCELLED' } },
        select: { id: true, shipmentNumber: true },
      });
      for (const linkedShipment of linkedShipments) {
        await tx.shipment.update({
          where: { id: linkedShipment.id },
          data: {
            status: 'CANCELLED',
            notes: `ยกเลิกอัตโนมัติ: Sale ${sale.invoiceNumber} ถูกยกเลิก`,
          },
        });

        // Delete auto-created shipping expense (matched by description pattern)
        await tx.expense.deleteMany({
          where: {
            shopId: ctx.shopId,
            category: 'ค่าจัดส่ง',
            description: { contains: linkedShipment.shipmentNumber },
          },
        });
      }

      // =================================================================
      // Auto-cancel linked returns (data integrity)
      // =================================================================
      await tx.return.updateMany({
        where: { saleId: id, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      });

      // =================================================================
      // คืนสต็อกสินค้า (via StockService)
      // Handles: stock increment, StockLog, isLowStock, notifications
      // CRITICAL: Deduct already-returned quantity to prevent double-restore
      // =================================================================
      for (const item of sale.items) {
        const alreadyReturned = item.returnItems.reduce(
          (sum: number, ri: { quantity: number }) => sum + ri.quantity, 0
        );
        const restoreQty = item.quantity - alreadyReturned;

        if (restoreQty > 0) {
          await StockService.recordMovement({
            productId: item.productId,
            type: 'SALE_CANCEL',
            quantity: restoreQty,
            saleId: sale.id,
            userId,
            shopId: sale.shopId || ctx.shopId,
            note: `ยกเลิกการขาย ${sale.invoiceNumber} - ${cancelReason}` +
              (alreadyReturned > 0 ? ` (คืนแล้ว ${alreadyReturned} ชิ้น)` : ''),
            tx,
          });
        }
      }

      // เปลี่ยนสถานะเป็น CANCELLED (ไม่ลบ Record)
      await tx.sale.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user?.name || 'Unknown',
          cancelReason,
        },
      });
    });

    revalidatePath('/sales');
    revalidatePath('/products');
    revalidatePath('/expenses');
    revalidatePath('/shipments');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    await logger.error('Failed to cancel sale', error, { 
      path: 'cancelSale', 
      userId, 
      saleId: id,
      reason: cancelReason 
    });
    return { error: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

// สรุปยอดขายวันนี้ (Aggregate)
export async function getTodaySales() {
  const ctx = await requirePermission('SALE_VIEW');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await db.sale.aggregate({
    where: {
      shopId: ctx.shopId,
      date: {
        gte: today,
        lt: tomorrow,
      },
      status: { not: 'CANCELLED' },
    },
    _sum: {
      netAmount: true,  // ✅ Revenue = เงินที่ได้รับจริง
      profit: true,
    },
    _count: true,
  });

  // Check for profit view permission
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');

  return {
    totalAmount: toNumber(result._sum.netAmount),  // ✅ ใช้ netAmount
    profit: canViewProfit ? toNumber(result._sum.profit) : 0,
    count: result._count,
  };
}

export async function getRecentSales(limit: number = 5) {
  const ctx = await requirePermission('SALE_VIEW');

  const sales = await db.sale.findMany({
    where: { shopId: ctx.shopId },
    include: {
      customer: {
        select: { name: true },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
  });

  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');

  return sales.map(sale => ({
    ...sale,
    totalAmount: Number(sale.totalAmount),
    totalCost: canViewProfit ? Number(sale.totalCost) : 0,
    profit: canViewProfit ? Number(sale.profit) : 0,
    discountAmount: Number(sale.discountAmount),
    netAmount: Number(sale.netAmount),
  }));
}

// =================================================================
// G1: Payment Verification Actions
// =================================================================

/**
 * ตรวจสอบหลักฐานการชำระเงิน (Verify / Reject)
 */
export async function verifyPayment(
  saleId: string, 
  status: 'VERIFIED' | 'REJECTED', 
  note?: string
): Promise<ActionResponse> {
  try {
    const ctx = await requirePermission('PAYMENT_VERIFY');

    // L3: Input sanitization
    const sanitizedSaleId = z.string().min(1).safeParse(saleId);
    if (!sanitizedSaleId.success) {
      return { success: false, message: 'รหัสรายการขายไม่ถูกต้อง' };
    }
    const sanitizedNote = note ? z.string().max(500).safeParse(note.trim()) : undefined;
    if (sanitizedNote && !sanitizedNote.success) {
      return { success: false, message: 'หมายเหตุยาวเกินไป (สูงสุด 500 ตัวอักษร)' };
    }
    
    const sale = await db.sale.findFirst({
      where: { id: sanitizedSaleId.data, shopId: ctx.shopId },
    });

    if (!sale) return { success: false, message: 'ไม่พบรายการขาย' };
    if (sale.status === 'CANCELLED') return { success: false, message: 'รายการนี้ถูกยกเลิกแล้ว' };

    await db.sale.update({
      where: { id: saleId },
      data: {
        paymentStatus: status,
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: ctx.userId,
        paymentNote: sanitizedNote?.data || null,
      },
    });

    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    return { 
      success: true, 
      message: status === 'VERIFIED' ? 'ยืนยันการชำระเงินสำเร็จ' : 'ปฏิเสธการชำระเงิน' 
    };
  } catch (error: any) {
    return { success: false, message: error.message || 'เกิดข้อผิดพลาด' };
  }
}

/**
 * อัพโหลดหลักฐานการชำระเงิน (สลิป)
 */
export async function uploadPaymentProof(
  saleId: string, 
  proofUrl: string
): Promise<ActionResponse> {
  try {
    const ctx = await requirePermission('SALE_VIEW');

    // L3: Input sanitization
    const sanitizedSaleId = z.string().min(1).safeParse(saleId);
    if (!sanitizedSaleId.success) {
      return { success: false, message: 'รหัสรายการขายไม่ถูกต้อง' };
    }
    const sanitizedUrl = z.string().url().max(2048).safeParse(proofUrl);
    if (!sanitizedUrl.success) {
      return { success: false, message: 'URL หลักฐานไม่ถูกต้อง' };
    }
    
    const sale = await db.sale.findFirst({
      where: { id: sanitizedSaleId.data, shopId: ctx.shopId },
    });

    if (!sale) return { success: false, message: 'ไม่พบรายการขาย' };

    await db.sale.update({
      where: { id: saleId },
      data: {
        paymentProof: sanitizedUrl.data,
        paymentStatus: 'PENDING', // Set to pending when proof uploaded
      },
    });

    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    return { success: true, message: 'อัพโหลดหลักฐานสำเร็จ' };
  } catch (error: any) {
    return { success: false, message: error.message || 'เกิดข้อผิดพลาด' };
  }
}
