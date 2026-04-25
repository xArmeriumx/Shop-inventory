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

            // 3. Create Quotation
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
                    totalAmount: calculation.totals.netAmount,
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
            const invoiceNumber = await SequenceService.generate(ctx, DocumentType.SALE_INVOICE, tx);
            
            const totalCost = quotation.items.reduce((sum, item) => 
                sum + (item.quantity * (Number(item.product.costPrice) || 0)), 0
            );

            const sale = await tx.sale.create({
                data: {
                    shopId: ctx.shopId,
                    userId: ctx.userId,
                    memberId: ctx.memberId,
                    invoiceNumber,
                    customerId: quotation.customerId,
                    quotationId: quotation.id, // Linking
                    date: new Date(),
                    status: SaleStatus.CONFIRMED,
                    totalAmount: Number(quotation.totalAmount),
                    totalCost: totalCost,
                    profit: Number(quotation.totalAmount) - totalCost,
                    paymentMethod: 'TRANSFER', 
                    bookingStatus: 'RESERVED',   
                    items: {
                        create: quotation.items.map((item) => ({
                            product: { connect: { id: item.productId } },
                            quantity: item.quantity,
                            salePrice: item.unitPrice,
                            costPrice: Number(item.product.costPrice),
                            discountAmount: item.discount,
                            subtotal: item.subtotal,
                            profit: Number(item.subtotal) - (item.quantity * Number(item.product.costPrice)),
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
