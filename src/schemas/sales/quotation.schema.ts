import { z } from 'zod';
import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';

export const quotationItemSchema = z.object({
    productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
    description: z.string().optional(),
    quantity: z.coerce.number().min(1, 'จำนวนต้องมากกว่า 0'),
    unitPrice: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
    discount: z.coerce.number().min(0).default(0),
});

export const quotationSchema = z.object({
    customerId: z.string().min(1, 'กรุณาเลือกลูกค้า'),
    salespersonId: z.string().optional(),
    date: z.date().optional().default(() => new Date()),
    validUntil: z.date().optional(),
    currencyCode: z.string().default('THB'),
    notes: z.string().optional(),
    items: z.array(quotationItemSchema).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),

    // Tax Configuration (Situational Resolution - Phase 3)
    taxMode: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'NO_VAT']).default('INCLUSIVE'),
    taxRate: z.coerce.number().min(0).default(7),
});

export type QuotationInput = z.infer<typeof quotationSchema>;
export type QuotationItemInput = z.infer<typeof quotationItemSchema>;

/**
 * SSOT Helper: Calculate totals for UI display using the same engine as the server.
 */
export function computeQuotationTotals(values: any, products: any[]) {
    const computationItems: CalculationItemInput[] = (values.items || []).map((item: any) => {
        const product = products.find(p => p.id === item.productId);
        return {
            qty: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            costPrice: product ? Number(product.costPrice) : 0,
            lineDiscount: Number(item.discount) || 0,
        };
    });

    const taxConfig = {
        rate: Number(values.taxRate) || 0,
        mode: values.taxMode === 'NO_VAT' ? 'EXCLUSIVE' : (values.taxMode as any),
        kind: values.taxMode === 'NO_VAT' ? 'NO_VAT' : 'VAT' as any
    };

    return ComputationEngine.calculateTotals(computationItems, { type: 'FIXED', value: 0 }, taxConfig);
}
