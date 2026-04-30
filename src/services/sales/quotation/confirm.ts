import { db } from '@/lib/db';
import { SequenceService } from '@/services/core/system/sequence.service';
import {
    DocumentType,
    QuotationStatus,
    ServiceError,
    type RequestContext,
    SaleStatus,
    type MutationResult
} from '@/types/domain';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';
import { toNumber } from '@/lib/money';
import { QUOTATION_TAGS, SALES_TAGS } from '@/config/cache-tags';
import { QUOTATION_AUDIT_FIELDS } from './create';

export const QuotationConfirm = {
    async confirm(ctx: RequestContext, id: string): Promise<MutationResult<any>> {
        const result = await AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.QUOTATION_CONFIRM,
            targetType: 'Quotation',
            targetId: id,
            allowlist: QUOTATION_AUDIT_FIELDS,
            note: 'ยืนยันใบเสนอราคาและสร้างรายการขาย (SO)',
            getBefore: async () => db.quotation.findUnique({ where: { id } }),
            getAfter: async () => db.quotation.findUnique({ where: { id } })
        }, async () => {
            return await db.$transaction(async (tx) => {
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

                await tx.quotation.update({
                    where: { id },
                    data: { status: QuotationStatus.CONFIRMED },
                });

                const orderNumber = await SequenceService.generate(ctx, DocumentType.SALE_ORDER, tx);

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
                        memberId: ctx.memberId || null,
                        invoiceNumber: orderNumber,
                        customerId: quotation.customerId,
                        customerAddress: quotation.customerAddressSnapshot || (quotation as any).customer?.address || null,
                        customerPhone: quotation.customerPhoneSnapshot || (quotation as any).customer?.phone || null,
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

        return {
            data: result,
            affectedTags: [QUOTATION_TAGS.LIST, QUOTATION_TAGS.DETAIL(id), SALES_TAGS.LIST, SALES_TAGS.DASHBOARD]
        };
    }
};
