

import { db } from '@/lib/db';
import { Prisma, Permission } from '@prisma/client';
import { InvoiceService } from './invoice.service';
import { StockService } from '@/services/inventory/stock.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';
import { AuditService } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { NotificationService } from '@/services/core/intelligence/notification.service';
import { money, toNumber } from '@/lib/money';
import { DB_TIMEOUTS } from '@/lib/constants';

import {
    RequestContext,
    ServiceError,
    DocumentType,
    SaleStatus,
    BookingStatus,
    DocPaymentStatus,
} from '@/types/domain';

// ============================================================================
// TYPES
// ============================================================================

export interface POSCartItem {
    productId: string;
    quantity: number;
    salePrice: number;
    discountAmount?: number;
}

export interface POSCartInput {
    items: POSCartItem[];
    paymentMethod: 'CASH' | 'TRANSFER' | 'CREDIT_CARD';
    customerId?: string;
    customerName?: string;
    notes?: string;
    taxMode?: 'INCLUSIVE' | 'EXCLUSIVE' | 'NO_VAT';
    taxRate?: number;
    discountType?: 'FIXED' | 'PERCENT' | 'NONE';
    discountValue?: number;
}

// ============================================================================
// PERFORMANCE: Minimal Select Constants
// ============================================================================

const PRODUCT_POS_SELECT = {
    id: true,
    name: true,
    stock: true,
    reservedStock: true,
    costPrice: true,
    packagingQty: true,
    isSaleable: true,
    version: true,
} as const;

const SALE_RESULT_SELECT = {
    id: true,
    invoiceNumber: true,
    totalAmount: true,
    netAmount: true,
    taxAmount: true,
    status: true,
    paymentMethod: true,
    date: true,
    shopId: true,
} as const;

// ============================================================================
// POS SALE SERVICE
// ============================================================================

/**
 * POSSaleService — POS Checkout Flow (แยกจาก SaleService)
 *
 * Design: "Sales-First, Accounting-Deferred"
 *   - การขายต้องสำเร็จเสมอ ใน 1 Atomic Transaction
 *   - SO สถานะ COMPLETED ทันที (ไม่ผ่าน CONFIRMED)
 *   - Stock ตัดทันที (ไม่ต้องรอ DO)
 *   - Invoice PAID ทันที (tryPost — graceful ถ้าไม่มี CoA)
 *
 * Pattern:
 *   AuditService.runWithAudit → db.$transaction → [stock + sale + invoice]
 */
export const POSSaleService = {
    /**
     * checkout — จุดเดียวสำหรับ POS Checkout ทั้งหมด
     *
     * ⚡ Performance:
     *   - 1 productFindMany ดึงทุก product พร้อมกัน
     *   - ไม่มี select * ทุกที่ — ใช้ minimal select
     *   - Notification ออกนอก Transaction (non-blocking)
     *
     * @returns { sale, invoiceId } — data ขั้นต่ำที่ UI ต้องการ
     */
    async checkout(ctx: RequestContext, cart: POSCartInput) {
        Security.requirePermission(ctx, 'POS_ACCESS' as Permission);

        if (!cart.items || cart.items.length === 0) {
            throw new ServiceError('ไม่มีสินค้าในตะกร้า');
        }

        if (!ctx.memberId) {
            throw new ServiceError('ไม่พบรหัสพนักงาน กรุณา Login ใหม่');
        }

        return AuditService.runWithAudit(ctx, {
            action: 'POS_CHECKOUT',
            targetType: 'Sale',
            allowlist: ['invoiceNumber', 'totalAmount', 'netAmount', 'paymentMethod', 'status'],
            resolveTargetId: (res: any) => res?.sale?.id,
            note: `POS Checkout: ${cart.items.length} รายการ | วิธีชำระ: ${cart.paymentMethod}`,
            afterSnapshot: (res: any) => res?.sale,
        }, async () => {
            return db.$transaction(async (tx) => {
                const productIds = Array.from(new Set(cart.items.map(i => i.productId)));

                // ── 1. Fetch Products (1 query) ──────────────────────────────
                const products = await tx.product.findMany({
                    where: { id: { in: productIds }, shopId: ctx.shopId },
                    select: PRODUCT_POS_SELECT,
                });

                const productMap = new Map(products.map(p => [p.id, p]));

                // ── 2. Validate Stock ──────────────────────────────────────
                const stockErrors: string[] = [];
                for (const item of cart.items) {
                    const product = productMap.get(item.productId);
                    if (!product) {
                        stockErrors.push(`ไม่พบสินค้า ID: ${item.productId}`);
                        continue;
                    }
                    if (product.isSaleable === false) {
                        stockErrors.push(`"${product.name}" ไม่ได้เปิดให้ขาย`);
                        continue;
                    }
                    const available = Number(product.stock) - Number(product.reservedStock || 0);
                    if (available < item.quantity) {
                        stockErrors.push(`"${product.name}" สต็อกไม่พอ (มี ${available}, ต้องการ ${item.quantity})`);
                    }
                }

                if (stockErrors.length > 0) {
                    throw new ServiceError(stockErrors.join('\n'));
                }

                // ── 3. Calculate Totals (SSOT via ComputationEngine) ─────
                const computationItems: CalculationItemInput[] = cart.items.map(item => {
                    const product = productMap.get(item.productId)!;
                    return {
                        qty: item.quantity,
                        unitPrice: item.salePrice,
                        costPrice: toNumber(product.costPrice),
                        lineDiscount: item.discountAmount || 0,
                    };
                });

                const taxConfig = {
                    rate: cart.taxRate || 0,
                    mode: cart.taxMode === 'NO_VAT' ? 'EXCLUSIVE' as const : (cart.taxMode || 'INCLUSIVE') as any,
                    kind: cart.taxMode === 'NO_VAT' ? 'NO_VAT' as const : 'VAT' as any,
                };

                const calculation = ComputationEngine.calculateTotals(
                    computationItems,
                    { type: (cart.discountType || 'NONE') as any, value: cart.discountValue || 0 },
                    taxConfig
                );

                const { totals } = calculation;

                // ── 4. Generate POS Invoice Number ─────────────────────────
                const invoiceNumber = await SequenceService.generate(ctx, DocumentType.SALE_ORDER, tx);

                // ── 5. Create Sale — COMPLETED immediately ─────────────────
                const sale = await tx.sale.create({
                    data: {
                        shopId: ctx.shopId,
                        userId: ctx.userId,
                        memberId: ctx.memberId,
                        invoiceNumber,
                        customerId: cart.customerId || null,
                        customerName: cart.customerName || null,
                        date: new Date(),
                        // POS: สถานะ COMPLETED ทันที — ไม่ผ่าน CONFIRMED
                        status: SaleStatus.COMPLETED,
                        bookingStatus: BookingStatus.DEDUCTED,  // ตัดทันที
                        deliveryStatus: 'DELIVERED',             // ส่งทันที
                        billingStatus: 'BILLED',                 // จะ bill ต่อไป
                        paymentMethod: cart.paymentMethod,
                        paymentStatus: 'PAID' as DocPaymentStatus,
                        notes: cart.notes || null,
                        // Financials
                        totalAmount: totals.subtotalAmount,
                        totalCost: totals.totalCost,
                        profit: totals.totalProfit,
                        discountType: (cart.discountType || 'NONE') as any,
                        discountValue: cart.discountValue || 0,
                        discountAmount: totals.billDiscountAmount,
                        netAmount: totals.netAmount,
                        taxMode: cart.taxMode || 'INCLUSIVE',
                        taxRate: cart.taxRate || 0,
                        taxAmount: totals.taxAmount,
                        taxableAmount: totals.taxableBaseAmount,
                        paidAmount: totals.netAmount,
                        residualAmount: 0,
                        channel: 'POS',
                        items: {
                            create: calculation.lines.map((line, idx) => ({
                                productId: cart.items[idx].productId,
                                quantity: line.qty,
                                packagingQty: productMap.get(cart.items[idx].productId)!.packagingQty || 1,
                                salePrice: line.unitPrice,
                                costPrice: line.costPrice,
                                subtotal: line.lineNet,
                                profit: line.lineProfit,
                                discountAmount: line.lineDiscount,
                                taxAmount: line.taxAmount,
                                taxableAmount: line.taxableBase,
                            })),
                        },
                    } as Prisma.SaleUncheckedCreateInput,
                    select: SALE_RESULT_SELECT,
                });

                // ── 6. Deduct Stock (Bulk — 1 findMany + N updates) ───────
                await StockService.bulkDeductStock(
                    cart.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
                    ctx,
                    tx,
                    { saleId: sale.id }
                );

                // ── 7. Create Invoice + tryPost + markPaid ─────────────────
                const invoice = await InvoiceService.createFromSale(ctx, sale.id, tx);
                await InvoiceService.tryPost(ctx, invoice.id, tx);   // graceful — ไม่ throw ถ้าไม่มี CoA
                await InvoiceService.markPaid(ctx, invoice.id, tx);

                return { sale, invoiceId: invoice.id };
            }, { timeout: DB_TIMEOUTS.EXTENDED });
        }).then(async (result) => {
            // ── 8. Notification (ออกนอก Transaction — Non-blocking) ─────
            NotificationService.create({
                shopId: ctx.shopId,
                type: 'NEW_SALE',
                severity: 'INFO',
                title: `POS ขายสำเร็จ ${result.sale.invoiceNumber}`,
                message: `ยอด ${result.sale.netAmount} บาท`,
                link: `/sales/${result.sale.id}`,
                groupKey: `pos:${ctx.shopId}:${new Date().toDateString()}`,
            }).catch(() => {});

            return result;
        });
    },
};
