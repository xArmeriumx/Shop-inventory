

import { db } from '@/lib/db';
import { Prisma, Permission } from '@prisma/client';
import { InvoiceService } from './invoice.service';
import { StockService } from '@/services/inventory/stock.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
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
    MutationResult,
} from '@/types/domain';
import { IPOSSaleService } from '@/types/service-contracts';
import { SALES_TAGS, INVOICE_TAGS, INVENTORY_TAGS } from '@/config/cache-tags';

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
    sourceWarehouseId?: string;
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
 */
export const POSSaleService: IPOSSaleService = {
    async checkout(ctx: RequestContext, cart: POSCartInput): Promise<MutationResult<any>> {
        const result = await AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.POS_CHECKOUT,
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

                // ── 2. Validate Stock (Warehouse-aware) ────────────────────────
                const stockErrors: string[] = [];
                const warehouseId = cart.sourceWarehouseId || await StockEngine.resolveWarehouse(ctx, undefined, tx);

                // Fetch WarehouseStock for these products in this warehouse
                const warehouseStocks = await tx.warehouseStock.findMany({
                    where: {
                        productId: { in: productIds },
                        warehouseId: warehouseId
                    }
                });
                const whStockMap = new Map(warehouseStocks.map(ws => [ws.productId, ws]));

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

                    const whStock = whStockMap.get(item.productId);
                    const onHand = whStock ? Number(whStock.quantity) : 0;
                    const reserved = whStock ? Number((whStock as any).reservedStock || 0) : 0;
                    const available = onHand - reserved;

                    if (available < item.quantity) {
                        stockErrors.push(`"${product.name}" สต็อกในคลังไม่พอ (มี ${available}, ต้องการ ${item.quantity})`);
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
                                warehouseId: warehouseId,
                            })),
                        },
                    } as Prisma.SaleUncheckedCreateInput,
                    select: SALE_RESULT_SELECT,
                });

                // ── 6. Deduct Stock (Bulk — 1 findMany + N updates) ───────
                await StockService.bulkDeductStock(
                    cart.items.map(item => ({ productId: item.productId, quantity: item.quantity, warehouseId })),
                    ctx,
                    tx,
                    { saleId: sale.id, validation: 'STRICT' }
                );

                // ── 7. Create Invoice + tryPost + markPaid ─────────────────
                const invoice = await InvoiceService.createFromSale(ctx, sale.id, tx);
                await InvoiceService.tryPost(ctx, invoice.data.id, tx);   // graceful — ไม่ throw ถ้าไม่มี CoA
                await InvoiceService.markPaid(ctx, invoice.data.id, tx);

                // ── 8. COGS Posting (BUG-4 fix: POS was missing COGS) ──────
                try {
                    const PostingModule = await import('@/services/accounting/posting-engine.service');
                    await PostingModule.PostingService.postCOGS(ctx, sale, tx);
                } catch {
                    // Graceful: ถ้า CoA ไม่พร้อม → skip (Accountant post ย้อนหลังได้)
                }

                return { sale, invoiceId: invoice.data.id };
            }, { timeout: DB_TIMEOUTS.EXTENDED });
        });

        // ── 8. Notification (ออกนอก Transaction — Non-blocking) ─────
        NotificationService.create({
            shopId: ctx.shopId,
            type: 'NEW_SALE',
            severity: 'INFO',
            title: `POS ขายสำเร็จ ${result.sale.invoiceNumber}`,
            message: `ยอด ${result.sale.netAmount} บาท`,
            link: `/sales/${result.sale.id}`,
            groupKey: `pos:${ctx.shopId}:${new Date().toDateString()}`,
        }).catch(() => { });

        const productIds = Array.from(new Set(cart.items.map(i => i.productId)));

        return {
            data: result,
            affectedTags: [
                SALES_TAGS.LIST,
                SALES_TAGS.DASHBOARD,
                INVOICE_TAGS.LIST,
                INVOICE_TAGS.STATS,
                INVENTORY_TAGS.LIST,
                ...productIds.map(id => INVENTORY_TAGS.STOCK(id)),
                ...productIds.map(id => INVENTORY_TAGS.DETAIL(id)),
            ]
        };
    },
};
