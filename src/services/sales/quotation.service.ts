import { db } from '@/lib/db';
import { SequenceService } from '@/services/core/sequence.service';
import {
    DocumentType,
    QuotationStatus,
    ServiceError,
    type RequestContext,
    type CreateQuotationInput,
    type GetQuotationsParams,
    SaleStatus
} from '@/types/domain';
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
    async create(ctx: RequestContext, input: CreateQuotationInput) {
        return await db.$transaction(async (tx) => {
            // 0. Ensure member exists (Self-healing/Verification from Context)
            if (!ctx.memberId) {
                throw new ServiceError('ไม่พบข้อมูลพนักงานในระบบ (Member Identity Missing)');
            }

            // 1. Generate Sequence Number
            const quotationNo = await SequenceService.generate(ctx, DocumentType.QUOTATION, tx);

            // 2. Create Quotation with Items
            return await tx.quotation.create({
                data: {
                    shopId: ctx.shopId,
                    quotationNo,
                    customerId: input.customerId,
                    salespersonId: input.salespersonId || ctx.memberId,
                    date: input.date || new Date(),
                    validUntil: input.validUntil,
                    currencyCode: input.currencyCode || 'THB',
                    totalAmount: input.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice - (item.discount || 0)), 0),
                    notes: input.notes,
                    items: {
                        create: input.items.map((item, index) => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount || 0,
                            subtotal: (item.quantity * item.unitPrice) - (item.discount || 0),
                            sortOrder: index,
                        })),
                    },
                },
                include: { items: true },
            });
        });
    },

    /**
     * Confirm — อนุมัติใบเสนอราคาและสร้าง Sale (SO)
     */
    async confirm(ctx: RequestContext, id: string) {
        return await db.$transaction(async (tx) => {
            // 1. Load Quotation
            const quotation = await tx.quotation.findUnique({
                where: { id },
                include: { items: true },
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

            // 3. Create Sale (Sales Order)
            // Note: We leverage SequenceService for Sale numbering
            const invoiceNumber = await SequenceService.generate(ctx, DocumentType.SALE_INVOICE, tx);

            const sale = await tx.sale.create({
                data: {
                    shopId: ctx.shopId,
                    userId: ctx.userId,
                    invoiceNumber,
                    customerId: quotation.customerId,
                    date: new Date(),
                    status: SaleStatus.CONFIRMED,
                    totalAmount: quotation.totalAmount,
                    totalCost: 0, // Placeholder, items will be handled
                    profit: 0,
                    paymentMethod: 'TRANSFER', // Default for SO
                    bookingStatus: 'RESERVED',   // ERP: Auto reserve stock on SO
                    items: {
                        create: quotation.items.map((item) => ({
                            product: { connect: { id: item.productId } },
                            quantity: item.quantity,
                            salePrice: item.unitPrice,
                            costPrice: 0,
                            discountAmount: item.discount || 0,
                            subtotal: item.subtotal,
                            profit: item.subtotal, // subtotal - (0 * quantity)
                        })),
                    },
                },
            });

            return sale;
        });
    },

    /**
     * Cancel — ยกเลิกใบเสนอราคา
     */
    async cancel(ctx: RequestContext, id: string) {
        const quotation = await db.quotation.findUnique({
            where: { id },
        });

        if (!quotation || quotation.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบใบเสนอราคา');
        }

        return await db.quotation.update({
            where: { id },
            data: { status: QuotationStatus.CANCELLED },
        });
    },
};
