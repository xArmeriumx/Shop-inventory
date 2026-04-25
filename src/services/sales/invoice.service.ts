import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { SequenceService } from '@/services/core/system/sequence.service';
import { DB_TIMEOUTS } from '@/lib/constants';
import { Security } from '@/services/core/iam/security.service';
import { WorkflowService } from '@/services/core/workflow/workflow.service';
import { DocumentType, ServiceError, type RequestContext } from '@/types/domain';
import { Permission } from '@prisma/client';
import { TaxResolutionService } from '@/services/tax/tax-resolution.service';
import { TaxCalculationService } from '@/services/tax/tax-calculation.service';
import { TaxSettingsService } from '@/services/tax/tax-settings.service';
import { PostingService } from '@/services/accounting/posting-engine.service';
import { JournalService } from '@/services/accounting/journal.service';

import { GetInvoicesParams } from './sales.types';

/**
 * InvoiceService — จัดการใบแจ้งหนี้ / Invoice (Billing Module)
 *
 * Flow: Sale (SO Confirmed) → createFromSale → Draft → post → Posted → markPaid → Paid
 *
 * T2 Tax Rules:
 * - ทุก line ต้องผ่าน TaxResolutionService เพื่อเลือก tax code
 * - ทุก line ต้องผ่าน TaxCalculationService เพื่อคิดเลข
 * - header snapshot ทั้งหมดล็อกทันทีที่สร้าง
 * - tax snapshot ห้ามแก้หลัง POSTED
 * - payment อัปเดตได้แค่ paidAmount / residualAmount / paymentStatus
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
     * CreateFromSale — สร้าง Invoice จาก Sale พร้อม Full Tax Snapshot (Phase T2)
     *
     * กติกา ERP:
     * 1. ทุก line ผ่าน TaxResolutionService เพื่อเลือก tax code ตาม priority chain
     * 2. ทุก line ผ่าน TaxCalculationService เพื่อคิด taxableBase / taxAmount
     * 3. seller/buyer/tax fields ทั้งหมด snapshot ณ เวลาสร้าง — ห้ามแก้หลัง POSTED
     * 4. payment ห้ามแตะ taxAmount / taxableBase
     * 5. หลัง POSTED → สร้าง SalesTaxEntry
     */
    async createFromSale(ctx: RequestContext, saleId: string, tx?: Prisma.TransactionClient) {
        Security.require(ctx, 'INVOICE_CREATE' as Permission);

        if (!ctx.memberId) {
            throw new ServiceError('ไม่สามารถสร้างใบแจ้งหนี้ได้เนื่องจากไม่พบรหัสสมาชิก (memberId)');
        }

        const execute = async (tx: Prisma.TransactionClient) => {
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

            const existing = await (tx as any).invoice.findUnique({ where: { saleId } });
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

            // 3. Load Company Tax Profile (สำหรับ Seller Snapshot)
            const companyTaxProfile = await (tx as any).companyTaxProfile.findUnique({
                where: { shopId: ctx.shopId },
            });

            // 4. Resolve Tax per Line — TaxResolutionService
            const billDiscount = Number(sale.discountAmount || 0);
            const linesToProcess = sale.items;

            const taxResolutions = await Promise.all(
                linesToProcess.map((item: any) =>
                    TaxResolutionService.resolve({
                        shopId: ctx.shopId,
                        direction: 'OUTPUT',
                        productId: item.productId,
                        customerId: sale.customerId ?? undefined,
                    })
                )
            );

            // 5. Calculate each line — TaxCalculationService
            const lineRawCalcs = linesToProcess.map((item: any, i: number) => {
                const resolution = taxResolutions[i];
                const qty = Number(item.quantity);
                const unitPrice = Number(item.salePrice);
                const lineDiscount = Number(item.discountAmount || 0) * qty;

                return {
                    item,
                    resolution,
                    calc: TaxCalculationService.calculateLine({
                        qty,
                        unitPrice,
                        lineDiscount,
                        taxRate: resolution.rate,
                        calculationMode: resolution.calculationMode as any,
                        taxKind: resolution.kind as any,
                    }),
                };
            });

            // Bill-level discount allocation
            const billDiscountAllocations = TaxCalculationService.allocateBillDiscount(
                lineRawCalcs.map(({ calc }) => ({ lineSubtotal: calc.lineSubtotal })),
                billDiscount
            );

            // Re-calculate with bill discount allocated
            const lineCalcs = lineRawCalcs.map(({ item, resolution, calc }, i) => {
                const withBill = TaxCalculationService.calculateLine({
                    qty: Number(item.quantity),
                    unitPrice: Number(item.salePrice),
                    lineDiscount: Number(item.discountAmount || 0) * Number(item.quantity),
                    billDiscountAllocation: billDiscountAllocations[i],
                    taxRate: resolution.rate,
                    calculationMode: resolution.calculationMode as any,
                    taxKind: resolution.kind as any,
                });
                return { item, resolution, calc: withBill };
            });

            const header = TaxCalculationService.aggregateHeader(
                lineCalcs.map(({ calc }) => calc)
            );

            // 6. Detect primary tax code for header snapshot
            const primaryResolution = taxResolutions.find(r => r.resolvedFrom !== 'NONE') ?? taxResolutions[0];

            // 7. Prepare Buyer Snapshot
            const customerNameSnapshot = sale.customer?.name || (sale as any).customerName || 'ลูกค้าทั่วไป';
            const billingAddressSnapshot = (sale.customer as any)?.billingAddress || '-';
            const taxIdSnapshot = (sale.customer as any)?.taxId || null;

            // Load buyer's PartnerTaxProfile for branch info
            const buyerTaxProfile = sale.customerId
                ? await (tx as any).partnerTaxProfile.findUnique({
                    where: { customerId: sale.customerId },
                })
                : null;

            // Load shop info for Seller Snapshot
            const shop = await tx.shop.findUnique({
                where: { id: ctx.shopId },
                select: { name: true, address: true, taxId: true },
            });

            // 8. Build InvoiceLine data
            const invoiceLinesData = lineCalcs.map(({ item, resolution, calc }, i) => ({
                productId: item.productId,
                skuSnapshot: item.product?.sku || null,
                productNameSnapshot: item.product?.name || 'สินค้าลบแล้ว',
                descriptionSnapshot: item.description || null,
                uomSnapshot: null,
                quantity: Number(item.quantity),
                unitPrice: Number(item.salePrice),
                lineSubtotalAmount: calc.lineSubtotal,
                discountAmount: calc.discountAmount,
                taxableBaseAmount: calc.taxableBase,
                taxCodeSnapshot: resolution.code,
                taxRateSnapshot: resolution.rate,
                taxAmount: calc.taxAmount,
                lineNetAmount: calc.lineNet,
                subtotal: calc.lineNet, // Legacy alias
                sortOrder: i,
            }));

            // 9. Create Invoice + Lines in transaction
            const isTaxInvoice = companyTaxProfile?.isVatRegistered ?? false;
            const invoice = await (tx as any).invoice.create({
                data: {
                    shopId: ctx.shopId,
                    invoiceNo,
                    saleId: sale.id,
                    customerId: sale.customerId ?? undefined,
                    memberId: ctx.memberId as string,
                    status: 'DRAFT',
                    date: new Date(),

                    // BUYER Snapshots
                    customerNameSnapshot,
                    billingAddressSnapshot,
                    taxIdSnapshot,
                    customerBranchSnapshot: buyerTaxProfile?.branchName || null,

                    // SELLER Snapshots (Tax Invoice compliance)
                    sellerNameSnapshot: companyTaxProfile?.legalName || shop?.name || '-',
                    sellerAddressSnapshot: companyTaxProfile?.registeredAddress || shop?.address || '-',
                    sellerTaxIdSnapshot: companyTaxProfile?.taxPayerId || shop?.taxId || null,
                    sellerBranchSnapshot: companyTaxProfile?.branchCode
                        ? (companyTaxProfile.branchCode === '00000' ? 'สำนักงานใหญ่' : `สาขา ${companyTaxProfile.branchCode}`)
                        : null,

                    // TAX Snapshots
                    taxCodeSnapshot: primaryResolution?.code || null,
                    taxRateSnapshot: primaryResolution?.rate ?? 0,
                    taxCalculationModeSnapshot: primaryResolution?.calculationMode || 'EXCLUSIVE',
                    isTaxInvoice,

                    currencyCode: 'THB',

                    // Financials (from Tax Engine)
                    subtotalAmount: header.subtotalAmount,
                    discountAmount: header.discountAmount,
                    taxableBaseAmount: header.taxableBaseAmount,
                    taxAmount: header.taxAmount,
                    netAmount: header.netAmount,
                    totalAmount: header.netAmount, // Legacy alias
                    residualAmount: header.netAmount,
                    paymentStatus: 'UNPAID',

                    // Tax Posting (จะ post เมื่อ invoice status → POSTED)
                    taxPostingStatus: 'DRAFT',

                    items: {
                        create: invoiceLinesData,
                    },
                },
                include: { items: true, customer: true },
            });

            // 10. Lock Sale
            await tx.sale.update({
                where: { id: saleId },
                data: {
                    billingStatus: 'BILLED',
                    editLockStatus: 'BILLED' as any,
                    lockReason: `เอกสารถูกล็อกเนื่องจากมีการออกใบแจ้งหนี้เลขที่ ${invoiceNo} แล้ว`,
                    isLocked: true,
                },
            });

            return invoice;
        };

        if (tx) return await execute(tx);
        return await db.$transaction(async (tx) => await execute(tx), { timeout: DB_TIMEOUTS.EXTENDED });
    },

    /**
     * post — เปลี่ยน status เป็น POSTED และสร้าง SalesTaxEntry
     * Rule: ห้ามแก้ tax snapshot หลัง POSTED
     */
    async post(ctx: RequestContext, id: string, tx?: Prisma.TransactionClient) {
        Security.require(ctx, 'INVOICE_POST' as Permission);

        const execute = async (tx: Prisma.TransactionClient) => {
            const invoice = await (tx as any).invoice.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!invoice || invoice.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบใบแจ้งหนี้');
            }

            WorkflowService.canInvoiceAction(invoice as any, 'POST');

            const now = new Date();

            // 1. Post to Accounting Ledger (Phase A1.3)
            await PostingService.postInvoice(ctx, invoice, tx);

            // 2. Create SalesTaxEntry for tax report
            if (invoice.taxAmount > 0 || invoice.taxableBaseAmount > 0) {
                await TaxSettingsService.postSalesTaxEntry({
                    sourceType: 'INVOICE',
                    sourceId: invoice.id,
                    partnerId: invoice.customerId || undefined,
                    partnerName: invoice.customerNameSnapshot,
                    taxCode: invoice.taxCodeSnapshot || undefined,
                    taxRate: Number(invoice.taxRateSnapshot),
                    taxableBaseAmount: Number(invoice.taxableBaseAmount),
                    taxAmount: Number(invoice.taxAmount),
                    postedBy: ctx.memberId || 'system',
                }, ctx, tx);
            }

            // 3. Update Invoice status
            return await (tx as any).invoice.update({
                where: { id },
                data: {
                    status: 'POSTED',
                    taxPostingStatus: 'POSTED',
                    taxReportMonth: now.getMonth() + 1,
                    taxReportYear: now.getFullYear(),
                    postedAt: now,
                },
            });
        };

        if (tx) return await execute(tx);
        return await db.$transaction(async (tx) => await execute(tx), { timeout: DB_TIMEOUTS.EXTENDED });
    },

    async markPaid(ctx: RequestContext, id: string, tx?: Prisma.TransactionClient) {
        const client = tx || db;
        const invoice = await (client as any).invoice.findUnique({ where: { id } });
        if (!invoice || invoice.shopId !== ctx.shopId) throw new ServiceError('ไม่พบใบแจ้งหนี้');
        if (invoice.status !== 'POSTED') throw new ServiceError('ชำระเฉพาะ Invoice ที่ Post แล้วเท่านั้น');

        return (client as any).invoice.update({
            where: { id },
            data: {
                status: 'PAID',
                residualAmount: 0,
                paidAmount: Number(invoice.netAmount),
                paymentStatus: 'PAID',
            },
        });
    },

    async cancel(ctx: RequestContext, id: string) {
        Security.require(ctx, 'INVOICE_CANCEL' as Permission);
        const invoice = await (db as any).invoice.findUnique({ where: { id } });
        if (!invoice || invoice.shopId !== ctx.shopId) throw new ServiceError('ไม่พบใบแจ้งหนี้');

        WorkflowService.canInvoiceAction(invoice as any, 'CANCEL');

        // Void tax entries
        if (invoice.taxPostingStatus === 'POSTED') {
            await TaxSettingsService.voidTaxEntries('INVOICE', invoice.id, ctx);
        }

        return (db as any).$transaction(async (tx: any) => {
            // Find and reverse Accounting Journal (Phase A1.5)
            const journal = await (tx as any).journalEntry.findFirst({
                where: {
                    shopId: ctx.shopId,
                    sourceType: 'SALE_INVOICE',
                    sourceId: id,
                    postingPurpose: 'INVOICE_POST',
                    status: 'POSTED'
                }
            });

            if (journal) {
                await JournalService.reverseEntry(ctx, journal.id, tx);
            }

            return (tx as any).invoice.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    taxPostingStatus: invoice.taxPostingStatus === 'POSTED' ? 'VOIDED' : invoice.taxPostingStatus,
                },
            });
        });
    },

    async getStats(ctx: RequestContext) {
        Security.require(ctx, 'INVOICE_VIEW' as Permission);

        const [totalUnpaid, totalDraft, totalOverdue] = await Promise.all([
            db.invoice.aggregate({
                where: { shopId: ctx.shopId, status: { in: ['POSTED'] }, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
                _sum: { residualAmount: true },
                _count: true
            }),
            db.invoice.count({
                where: { shopId: ctx.shopId, status: 'DRAFT' }
            }),
            db.invoice.aggregate({
                where: {
                    shopId: ctx.shopId,
                    status: 'POSTED',
                    paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
                    dueDate: { lt: new Date() }
                },
                _sum: { residualAmount: true },
                _count: true
            })
        ]);

        return {
            unpaid: {
                amount: Number(totalUnpaid._sum.residualAmount || 0),
                count: totalUnpaid._count
            },
            draft: {
                count: totalDraft
            },
            overdue: {
                amount: Number(totalOverdue._sum.residualAmount || 0),
                count: totalOverdue._count
            }
        };
    }
};
