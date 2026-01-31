'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requirePermission, hasPermission } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { saleSchema, type SaleInput } from '@/schemas/sale';
import type { Sale, SaleItem, Prisma } from '@prisma/client';
import { StockService } from '@/lib/stock-service';
import type { ActionResponse } from '@/types/action-response';
import { Decimal } from '@prisma/client/runtime/library';

// =============================================================================
// RACE CONDITION PREVENTION UTILITIES
// =============================================================================

/**
 * Maximum retries for invoice number generation when concurrent conflicts occur
 */
const MAX_INVOICE_RETRIES = 5;

/**
 * Generates a unique invoice number with retry logic for race condition handling.
 * 
 * Problem: When 2 users create sales simultaneously, they might both get the same
 * "last invoice number" and try to create the same new number, causing a unique
 * constraint violation.
 * 
 * Solution: Retry with incremented number if conflict detected.
 * 
 * @param tx - Prisma transaction client
 * @param shopId - Shop ID for scoping invoice numbers
 * @returns Unique invoice number string (e.g., "INV-00001")
 */
async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  shopId: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_INVOICE_RETRIES; attempt++) {
    // 1. Find current max invoice number
    const lastSale = await tx.sale.findFirst({
      where: { shopId },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    // 2. Parse and increment
    const lastNumber = lastSale
      ? parseInt(lastSale.invoiceNumber.split('-')[1] || '0')
      : 0;

    // Add attempt offset to avoid collision on retry
    const newNumber = lastNumber + 1 + attempt;
    const invoiceNumber = `INV-${String(newNumber).padStart(5, '0')}`;

    // 3. Check if this number already exists (race condition check)
    const exists = await tx.sale.findFirst({
      where: { shopId, invoiceNumber },
      select: { id: true }
    });

    if (!exists) {
      return invoiceNumber;
    }

    // If exists, retry with next number
    await logger.warn('Invoice number collision, retrying', {
      invoiceNumber,
      attempt,
      shopId
    });
  }

  throw new Error('ไม่สามารถสร้างเลข Invoice ได้ กรุณาลองใหม่');
}

/**
 * Atomically reserves stock for a product.
 * 
 * Problem: When 2 users sell the same product simultaneously, both might pass
 * the stock check but end up with negative stock.
 * 
 * Solution: Use conditional updateMany that only succeeds if stock is sufficient.
 * This is atomic at the database level.
 * 
 * @param tx - Prisma transaction client
 * @param productId - Product to reserve stock for
 * @param quantity - Quantity to reserve (positive number)
 * @param productName - Product name for error messages
 * @throws Error if stock is insufficient
 */
async function atomicReserveStock(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
  productName: string
): Promise<void> {
  // Atomic: Only update if stock >= quantity
  const result = await tx.product.updateMany({
    where: {
      id: productId,
      stock: { gte: quantity }
    },
    data: {
      stock: { decrement: quantity }
    }
  });

  if (result.count === 0) {
    throw new Error(`สินค้า "${productName}" สต็อกไม่พอหรือถูกขายไปแล้ว กรุณาลองใหม่`);
  }
}

/**
 * Atomically restores stock for a product (for sale cancellation).
 * 
 * @param tx - Prisma transaction client
 * @param productId - Product to restore stock for
 * @param quantity - Quantity to restore (positive number)
 */
async function atomicRestoreStock(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number
): Promise<void> {
  await tx.product.update({
    where: { id: productId },
    data: {
      stock: { increment: quantity }
    }
  });
}

interface GetSalesParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
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
  } = params;

  const searchFilter = buildSearchFilter(search, ['invoiceNumber', 'customerName', 'notes']);
  const dateFilter = buildDateRangeFilter(startDate, endDate);

  const where = {
    shopId: ctx.shopId,
    ...(searchFilter && searchFilter),
    ...(dateFilter && { date: dateFilter }),
    ...(paymentMethod && { paymentMethod }),
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
      items: sale.items.map(item => ({
        ...item,
        salePrice: Number(item.salePrice),
        costPrice: canViewProfit ? Number(item.costPrice) : 0,
        subtotal: Number(item.subtotal),
        profit: canViewProfit ? Number(item.profit) : 0,
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
    items: sale.items.map(item => ({
      ...item,
      salePrice: Number(item.salePrice),
      costPrice: canViewProfit ? Number(item.costPrice) : 0,
      subtotal: Number(item.subtotal),
      profit: canViewProfit ? Number(item.profit) : 0,
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
          costPrice: Number(product.costPrice),
          stock: product.stock,
        });
      }

      // =================================================================
      // 3. ATOMIC Stock Reservation (Race Condition Prevention)
      // =================================================================
      // This is the critical section. We use atomic updateMany with a
      // condition that only succeeds if stock >= quantity.
      // This prevents the "check-then-update" race condition.
      // =================================================================
      for (const item of items) {
        const product = productDataMap.get(item.productId)!;
        
        // First, check if stock is sufficient (for user-friendly error message)
        if (product.stock < item.quantity) {
          throw new Error(`สินค้า "${product.name}" มีสต็อกไม่พอ (เหลือ ${product.stock})`);
        }

        // ATOMIC: Reserve stock - only succeeds if stock >= quantity at DB level
        await atomicReserveStock(tx, item.productId, item.quantity, product.name);
      }

      // =================================================================
      // 4. Calculate Totals & Prepare Sale Items
      // =================================================================
      let totalAmount = 0;
      let totalCost = 0;
      const saleItemsToCreate = [];

      for (const item of items) {
        const product = productDataMap.get(item.productId)!;
        const costPrice = product.costPrice;
        const subtotal = item.salePrice * item.quantity;
        const itemCost = costPrice * item.quantity;
        const itemProfit = subtotal - itemCost;

        totalAmount += subtotal;
        totalCost += itemCost;

        saleItemsToCreate.push({
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          costPrice: costPrice,
          subtotal: subtotal,
          profit: itemProfit,
        });
      }

      const profit = totalAmount - totalCost;

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
      const sale = await tx.sale.create({
        data: {
          ...saleData,
          customerId: finalCustomerId || null,
          customerName: saleData.customerName || 'ลูกค้าทั่วไป',
          userId: ctx.userId,
          shopId,
          invoiceNumber,
          totalAmount,
          totalCost,
          profit,
          items: {
            create: saleItemsToCreate.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              salePrice: item.salePrice,
              costPrice: item.costPrice,
              subtotal: item.subtotal,
              profit: item.profit,
            })),
          },
        },
        include: { items: true },
      });

      // =================================================================
      // 7. Record Stock Movements (Audit Trail)
      // Note: Stock already decremented in step 3, this is just for logging
      // =================================================================
      for (const item of sale.items) {
        // Get updated stock balance for the log
        const updatedProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, minStock: true, shopId: true },
        });

        if (updatedProduct) {
          // Update isLowStock flag
          const isLowStock = updatedProduct.stock <= updatedProduct.minStock;
          await tx.product.update({
            where: { id: item.productId },
            data: { isLowStock },
          });

          // Create stock log entry
          await tx.stockLog.create({
            data: {
              type: 'SALE',
              productId: item.productId,
              quantity: -item.quantity,
              balance: updatedProduct.stock,
              referenceId: sale.id,
              referenceType: 'SALE',
              note: `ขาย: ${sale.invoiceNumber}`,
              date: sale.date,
              userId: ctx.userId,
              shopId,
            },
          });
        }
      }

      return sale;
    });

    revalidatePath('/sales');
    revalidatePath('/dashboard');
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
      // Get sale with items
      const sale = await tx.sale.findFirst({
        where: { id, shopId: ctx.shopId },
        include: { items: true },
      });

      if (!sale) {
        throw new Error('ไม่พบข้อมูลการขาย');
      }

      // Check if already cancelled
      if (sale.status === 'CANCELLED') {
        throw new Error('รายการนี้ถูกยกเลิกไปแล้ว');
      }

       // =================================================================
      // คืนสต็อกสินค้ากลับเข้าไป (Atomic Restore Stock)
      // =================================================================
      for (const item of sale.items) {
        // Atomic stock restoration
        await atomicRestoreStock(tx, item.productId, item.quantity);

        // Get updated stock balance for the log
        const updatedProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, minStock: true },
        });

        if (updatedProduct) {
          // Update isLowStock flag
          const isLowStock = updatedProduct.stock <= updatedProduct.minStock;
          await tx.product.update({
            where: { id: item.productId },
            data: { isLowStock },
          });

          // Create stock log entry
          await tx.stockLog.create({
            data: {
              type: 'SALE_CANCEL',
              productId: item.productId,
              quantity: item.quantity, // Positive = restore
              balance: updatedProduct.stock,
              referenceId: sale.id,
              referenceType: 'SALE_CANCEL',
              note: `ยกเลิกการขาย ${sale.invoiceNumber} - ${cancelReason}`,
              date: new Date(),
              userId,
              shopId: sale.shopId || ctx.shopId,
            },
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
      totalAmount: true,
      profit: true,
    },
    _count: true,
  });

  // Check for profit view permission
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');

  return {
    totalAmount: Number(result._sum.totalAmount || 0),
    profit: canViewProfit ? Number(result._sum.profit || 0) : 0,
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
  }));
}
