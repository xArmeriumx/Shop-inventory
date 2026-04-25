import { db } from '@/lib/db';
import { SequenceService } from '@/services/core/system/sequence.service';
import {
    DocumentType,
    QuotationStatus,
    ServiceError,
    type RequestContext,
    type CreateQuotationInput,
    type GetQuotationsParams,
    SaleStatus,
} from '@/types/domain';
import { AuditService } from '@/services/core/system/audit.service';
import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';
import { toNumber } from '@/lib/money';
import { Prisma } from '@prisma/client';

/**
 * QuotationService — จัดการใบเสนอราคา (Sales Quotation Management)
 */
export const QuotationService = {
    /**
     * List — ค้นหาและแบ่งหน้า
     */
    async list(ctx: RequestContext, params: GetQuotationsParams) {
        const { page = 1, limit = 10, search, status, customerId } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.QuotationWhereInput = {
            shopId: ctx.shopId,
            status,
            customerId,
            OR: search ? [
                { quotationNo: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
            ] : undefined,
        };

        const [data, total] = await Promise.all([
            db.quotation.findMany({
                where,
                include: { customer: true, salesperson: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            db.quotation.count({ where }),
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },

    /**
     * GetById — ดึงข้อมูลรายใบ
     */
    async getById(ctx: RequestContext, id: string) {
        const quotation = await db.quotation.findUnique({
            where: { id },
            include: {
                customer: true,
                salesperson: { include: { user: true } },
                items: {
                    include: { product: true },
                    orderBy: { sortOrder: 'asc' }
                },
                sales: {
                    include: { invoices: true },
                    orderBy: { createdAt: 'desc' }
                }
            },
        });

        if (!quotation || quotation.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบใบเสนอราคา');
        }

        return quotation;
    },

    /**
     * Create — ออกใบเสนอราคาใหม่
     */
    async create(ctx: RequestContext, input: CreateQuotationInput & { taxMode?: any; taxRate?: any }) {
        return await AuditService.runWithAudit(ctx, {
            action: 'QUOTATION_CREATE',
            targetType: 'Quotation',
        }, async () => {
            return await db.$transaction(async (tx) => {
            if (!ctx.memberId) {
                throw new ServiceError('ไม่พบข้อมูลพนักงานในระบบ (Member Identity Missing)');
            }

            // 1. Calculate Totals (SSOT)
            const products = await tx.product.findMany({
                where: { id: { in: input.items.map(i => i.productId).filter(Boolean) } }
            });

            const computationItems: CalculationItemInput[] = input.items.map(item => {
                const product = products.find(p => p.id === item.productId);
                return {
                    qty: item.quantity,
                    unitPrice: item.unitPrice,
                    costPrice: product ? Number(product.costPrice) : 0,
                    lineDiscount: item.discount || 0
                };
            });

            const taxConfig = {
                rate: Number(input.taxRate) || 0,
                mode: input.taxMode === 'NO_VAT' ? 'EXCLUSIVE' : (input.taxMode as any || 'INCLUSIVE'),
                kind: input.taxMode === 'NO_VAT' ? 'NO_VAT' : 'VAT' as any
            };

            const calculation = ComputationEngine.calculateTotals(computationItems, { type: 'FIXED', value: 0 }, taxConfig);

            // 2. Generate Sequence
            const quotationNo = await SequenceService.generate(ctx, DocumentType.QUOTATION, tx);

            // 3. Create Quotation - Full Principle Snapshot
            const { totals } = calculation;
            const quotation = await tx.quotation.create({
                data: {
                    shopId: ctx.shopId,
                    quotationNo,
                    customerId: input.customerId,
                    salespersonId: input.salespersonId || ctx.memberId,
                    memberId: ctx.memberId,
                    date: input.date || new Date(),
                    validUntil: input.validUntil,
                    currencyCode: input.currencyCode || 'THB',
                    totalAmount: totals.subtotalAmount,
                    taxAmount: totals.taxAmount,
                    taxableAmount: totals.taxableBaseAmount,
                    taxMode: input.taxMode || 'INCLUSIVE',
                    taxRate: input.taxRate || 7,
                    notes: input.notes,
                    items: {
                        create: input.items.map((item, index) => {
                            const lineRes = calculation.lines[index];
                            return {
                                productId: item.productId,
                                description: item.description,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                discount: item.discount || 0,
                                subtotal: lineRes.lineNet,
                                taxAmount: lineRes.taxAmount,
                                taxableAmount: lineRes.taxableBase,
                                sortOrder: index,
                            };
                        }),
                    },
                },
                include: { items: true },
            });

            return quotation;
            });
        });
    },

    /**
     * Confirm — อนุมัติใบเสนอราคาและสร้าง Sale (SO)
     */
    async confirm(ctx: RequestContext, id: string) {
        return await AuditService.runWithAudit(ctx, {
            action: 'QUOTATION_CONFIRM',
            targetType: 'Quotation',
            targetId: id,
        }, async () => {
            return await db.$transaction(async (tx) => {
            // 1. Load Quotation with details
            const quotation = await tx.quotation.findUnique({
                where: { id },
                include: { 
                    items: { include: { product: true } }
                },
            });

            if (!quotation || quotation.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบใบเสนอราคา');
            }

            if (quotation.status !== QuotationStatus.DRAFT && quotation.status !== QuotationStatus.SENT) {
                throw new ServiceError('ใบเสนอราคานี้ไม่สามารถยืนยันได้ (สถานะปัจจุบัน: ' + quotation.status + ')');
            }

            // 2. Update Quotation Status
            await tx.quotation.update({
                where: { id },
                data: { status: QuotationStatus.CONFIRMED },
            });

            // 3. Create Sale (Sales Order) - Map accurate costs and totals
            const orderNumber = await SequenceService.generate(ctx, DocumentType.SALE_ORDER, tx);
            
            // Recalculate totals professionally to ensure all fields (taxAmount, netAmount) are synced
            const products = await tx.product.findMany({
                where: { id: { in: quotation.items.map(i => i.productId) } }
            });

            const computationItems: CalculationItemInput[] = quotation.items.map(item => {
                const product = products.find(p => p.id === item.productId);
                return {
                    qty: item.quantity,
                    unitPrice: toNumber(item.unitPrice),
                    costPrice: product ? toNumber(product.costPrice) : 0,
                    lineDiscount: toNumber(item.discount || 0)
                };
            });

            // Note: Currently QT doesn't store taxMode, we infer from Inclusive (Default)
            const calculation = ComputationEngine.calculateTotals(computationItems, { type: 'FIXED', value: 0 }, {
                rate: toNumber(quotation.taxRate),
                mode: (quotation.taxMode as any) || 'INCLUSIVE',
                kind: quotation.taxMode === 'NO_VAT' ? 'NO_VAT' : 'VAT' as any
            });

            const { totals } = calculation;

            const sale = await tx.sale.create({
                data: {
                    shopId: ctx.shopId,
                    userId: ctx.userId,
                    memberId: ctx.memberId,
                    invoiceNumber: orderNumber,
                    customerId: quotation.customerId,
                    quotationId: quotation.id,
                    date: new Date(),
                    status: SaleStatus.CONFIRMED,
                    totalAmount: totals.subtotalAmount,
                    totalCost: totals.totalCost,
                    netAmount: totals.netAmount,
                    profit: totals.totalProfit,
                    taxMode: quotation.taxMode,
                    taxRate: quotation.taxRate,
                    taxAmount: totals.taxAmount,
                    taxableAmount: totals.taxableBaseAmount,
                    paymentMethod: 'TRANSFER', 
                    bookingStatus: 'RESERVED',   
                    items: {
                        create: calculation.lines.map((line, index) => ({
                            product: { connect: { id: quotation.items[index].productId } },
                            quantity: line.qty,
                            salePrice: line.unitPrice,
                            costPrice: line.costPrice,
                            discountAmount: line.lineDiscount,
                            subtotal: line.lineNet,
                            profit: line.lineProfit,
                            taxAmount: line.taxAmount,
                            taxableAmount: line.taxableBase,
                        })),
                    },
                },
            });

            return sale;
            });
        });
    },

    /**
     * Cancel — ยกเลิกใบเสนอราคา
     */
    async cancel(ctx: RequestContext, id: string) {
        return await AuditService.runWithAudit(ctx, {
            action: 'QUOTATION_CANCEL',
            targetType: 'Quotation',
            targetId: id,
        }, async () => {
            return await db.$transaction(async (tx) => {
            const quotation = await tx.quotation.findUnique({
                where: { id },
            });

            if (!quotation || quotation.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบใบเสนอราคา');
            }

            return await tx.quotation.update({
                where: { id },
                data: { status: QuotationStatus.CANCELLED },
            });
            });
        });
    },
};
