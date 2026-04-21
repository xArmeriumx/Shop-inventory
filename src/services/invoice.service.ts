import { db } from '@/lib/db';
import { SequenceService } from './sequence.service';
import { Security } from './security';
import { WorkflowService } from './workflow.service';
import { DocumentType, ServiceError, type RequestContext } from '@/types/domain';
import { Permission } from '@prisma/client';

export interface GetInvoicesParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    customerId?: string;
    partnerAddress?: string;
}

/**
 * InvoiceService — จัดการใบแจ้งหนี้ / Invoice (Billing Module)
 *
 * Flow: Sale (SO Confirmed) → createFromSale → Draft → post → Posted → markPaid → Paid
 */
export const InvoiceService = {

    async list(ctx: RequestContext, params: GetInvoicesParams = {}) {
        Security.require(ctx, 'INVOICE_VIEW' as Permission);
        const { page = 1, limit = 20, search, status, customerId } = params;
        const skip = (page - 1) * limit;

        const where: any = {
            shopId: ctx.shopId,
            ...(status && { status: status as any }),
            ...(customerId && { customerId }),
            ...(search && {
                OR: [
                    { invoiceNo: { contains: search, mode: 'insensitive' as const } },
                    { customer: { name: { contains: search, mode: 'insensitive' as const } } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            (db as any).invoice.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, taxId: true } },
                    sale: { select: { id: true, invoiceNumber: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            (db as any).invoice.count({ where }),
        ]);


        return {
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    },

    async getById(ctx: RequestContext, id: string) {
        Security.require(ctx, 'INVOICE_VIEW' as Permission);
        const invoice = await (db as any).invoice.findUnique({
            where: { id },
            include: {
                customer: true,
                sale: { include: { customer: true } },
                items: { include: { product: { select: { id: true, name: true, sku: true } } } },
            },
        });

        if (!invoice || invoice.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบใบแจ้งหนี้');
        }

        return invoice;
    },

    /**
     * CreateFromSale — สร้าง Invoice จาก SO พร้อม Full Financial Snapshot
     * กติกา ERP: เป็นเอกสารนิ่ง (Immutable Snapshot) และล็อกรายการขายต้นทาง
     */
    async createFromSale(ctx: RequestContext, saleId: string) {
        Security.require(ctx, 'INVOICE_CREATE' as Permission);

        if (!ctx.memberId) {
            throw new ServiceError('ไม่สามารถสร้างใบแจ้งหนี้ได้เนื่องจากไม่พบรหัสสมาชิก (memberId)');
        }

        return await db.$transaction(async (tx) => {
            // 1. Validate Sale State & Existing Invoice
            const sale = await tx.sale.findUnique({
                where: { id: saleId },
                include: {
                    items: {
                        include: {
                            product: {
                                select: { id: true, name: true, sku: true, packagingQty: true }
                            }
                        }
                    },
                    customer: true,
                },
            });

            if (!sale || sale.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบรายการขาย');
            }

            if (sale.status === 'CANCELLED') {
                throw new ServiceError('ไม่สามารถสร้างใบแจ้งหนี้จากรายการที่ยกเลิกแล้วได้');
            }

            // check unique saleId for one-to-one policy
            const existing = await (tx as any).invoice.findUnique({
                where: { saleId }
            });

            if (existing) {
                throw new ServiceError('รายการขายนี้มีใบแจ้งหนี้แล้ว', undefined, {
                    label: 'ดูใบแจ้งหนี้',
                    href: `/invoices/${existing.id}`,
                });
            }

            if (!sale.items || sale.items.length === 0) {
                throw new ServiceError('รายการขายนี้ไม่มีสินค้า ไม่สามารถออกใบแจ้งหนี้ได้');
            }

            // 2. Generate Document Number
            const invoiceNo = await SequenceService.generate(ctx, DocumentType.SALE_INVOICE, tx);

            // 3. Prepare Header Snapshot
            const customerNameSnapshot = sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป';
            const billingAddressSnapshot = (sale.customer as any)?.billingAddress || '-';
            const taxIdSnapshot = (sale.customer as any)?.taxId || null;

            // 4. Calculate Financials from Snapshot
            // We RECALCULATE for the invoice to ensure absolute integrity
            let subtotalAmount = 0;
            let totalLineDiscount = 0;
            const invoiceLinesData = sale.items.map((item: any, i: number) => {
                const qty = Number(item.quantity);
                const unitPrice = Number(item.salePrice);
                const lineDiscount = Number(item.discountAmount || 0) * qty;

                const lineSubtotal = qty * unitPrice;
                const lineNet = lineSubtotal - lineDiscount; // For now without tax

                subtotalAmount += lineSubtotal;
                totalLineDiscount += lineDiscount;

                return {
                    productId: item.productId,
                    skuSnapshot: item.product?.sku || null,
                    productNameSnapshot: item.product?.name || 'สินค้าลบแล้ว',
                    descriptionSnapshot: item.description || null,
                    uomSnapshot: null, // Future: Add UOM from product
                    quantity: qty,
                    unitPrice: unitPrice,
                    lineSubtotalAmount: lineSubtotal,
                    discountAmount: lineDiscount,
                    lineNetAmount: lineNet,
                    subtotal: lineNet, // Legacy alias
                    sortOrder: i,
                };
            });

            // Bill-level discount (from Sale)
            const billDiscountAmount = Number(sale.discountAmount || 0);
            const netAmount = subtotalAmount - totalLineDiscount - billDiscountAmount;

            // 5. Create Invoice + Lines
            const invoice = await (tx as any).invoice.create({
                data: {
                    shopId: ctx.shopId,
                    invoiceNo,
                    saleId: sale.id,
                    customerId: sale.customerId ?? undefined,
                    memberId: ctx.memberId as string,
                    status: 'DRAFT',
                    date: new Date(),

                    // Header Snapshot
                    customerNameSnapshot,
                    billingAddressSnapshot,
                    taxIdSnapshot,

                    currencyCode: 'THB',
                    subtotalAmount,
                    discountAmount: billDiscountAmount + totalLineDiscount, // Total savings
                    taxAmount: 0, // Future: Add tax engine
                    netAmount,
                    totalAmount: netAmount, // Legacy alias
                    residualAmount: netAmount,
                    paymentStatus: 'UNPAID',

                    items: {
                        create: invoiceLinesData,
                    },
                },
                include: { items: true, customer: true },
            });

            // 6. Sync Sale & Lock
            await tx.sale.update({
                where: { id: saleId },
                data: {
                    billingStatus: 'BILLED',
                    editLockStatus: 'BILLED' as any,
                    lockReason: `เอกสารถูกล็อกเนื่องจากมีการออกใบแจ้งหนี้เลขที่ ${invoiceNo} แล้ว`,
                    isLocked: true, // Legacy support
                },
            });

            return invoice;
        });
    },

    async post(ctx: RequestContext, id: string) {
        Security.require(ctx, 'INVOICE_POST' as Permission);
        const invoice = await (db as any).invoice.findUnique({ where: { id } });
        if (!invoice || invoice.shopId !== ctx.shopId) throw new ServiceError('ไม่พบใบแจ้งหนี้');

        WorkflowService.canInvoiceAction(invoice as any, 'POST');

        return (db as any).invoice.update({ where: { id }, data: { status: 'POSTED' } });
    },

    async markPaid(ctx: RequestContext, id: string) {
        const invoice = await (db as any).invoice.findUnique({ where: { id } });
        if (!invoice || invoice.shopId !== ctx.shopId) throw new ServiceError('ไม่พบใบแจ้งหนี้');
        if (invoice.status !== 'POSTED') throw new ServiceError('ชำระเฉพาะ Invoice ที่ Post แล้วเท่านั้น');
        return (db as any).invoice.update({ where: { id }, data: { status: 'PAID', residualAmount: 0 } });
    },

    async cancel(ctx: RequestContext, id: string) {
        Security.require(ctx, 'INVOICE_CANCEL' as Permission);
        const invoice = await (db as any).invoice.findUnique({ where: { id } });
        if (!invoice || invoice.shopId !== ctx.shopId) throw new ServiceError('ไม่พบใบแจ้งหนี้');

        WorkflowService.canInvoiceAction(invoice as any, 'CANCEL');

        return (db as any).invoice.update({ where: { id }, data: { status: 'CANCELLED' } });
    },
};
