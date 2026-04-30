import { db } from '@/lib/db';
import { SequenceService } from '@/services/core/system/sequence.service';
import {
    DocumentType,
    ServiceError,
    type RequestContext,
    type CreateQuotationInput,
    type MutationResult
} from '@/types/domain';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';
import { QUOTATION_TAGS } from '@/config/cache-tags';

export const QUOTATION_AUDIT_FIELDS = [
    'quotationNo', 'status', 'customerId', 'totalAmount',
    'taxMode', 'taxRate', 'taxAmount', 'taxableAmount', 'netAmount'
];

export const QuotationCreate = {
    async create(ctx: RequestContext, input: CreateQuotationInput & { taxMode?: any; taxRate?: any }): Promise<MutationResult<any>> {
        const result = await AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.QUOTATION_CREATE,
            targetType: 'Quotation',
            allowlist: QUOTATION_AUDIT_FIELDS,
            note: `สร้างใบเสนอราคาใหม่: ${input.items.length} รายการ`,
            afterSnapshot: (res) => res
        }, async () => {
            return await db.$transaction(async (tx) => {
                if (!ctx.memberId) {
                    throw new ServiceError('ไม่พบข้อมูลพนักงานในระบบ (Member Identity Missing)');
                }

                const customer = await tx.customer.findUnique({
                    where: { id: input.customerId, shopId: ctx.shopId }
                });

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

                const quotationNo = await SequenceService.generate(ctx, DocumentType.QUOTATION, tx);

                const { totals } = calculation;
                const quotation = await tx.quotation.create({
                    data: {
                        shopId: ctx.shopId,
                        quotationNo,
                        customerId: input.customerId,
                        customerAddressSnapshot: customer?.address || null,
                        customerPhoneSnapshot: customer?.phone || null,
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

        return {
            data: result,
            affectedTags: [QUOTATION_TAGS.LIST]
        };
    }
};
