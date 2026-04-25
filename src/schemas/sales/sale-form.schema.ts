import { z } from 'zod';
import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';

/**
 * Sale Form Schema — Single Source of Truth for Sales Data & Logic
 */
export const saleItemSchema = z.object({
    productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
    quantity: z.coerce.number().min(1, 'จำนวนต้องมากกว่า 0'),
    salePrice: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
    discountAmount: z.coerce.number().min(0).default(0),
});

export const saleFormSchema = z.object({
    customerId: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    customerAddress: z.string().optional().nullable(),
    isNewCustomer: z.boolean().default(false),
    showAddress: z.boolean().default(false),
    paymentMethod: z.string().min(1, 'กรุณาเลือกวิธีชำระเงิน'),
    notes: z.string().optional().nullable(),
    receiptUrl: z.string().optional().nullable(),
    isBackdated: z.boolean().default(false),
    date: z.string().optional().nullable(),
    items: z.array(saleItemSchema).min(1, 'ต้องมีสินค้าอย่างน้อย 1 รายการ'),
    showDiscount: z.boolean().default(false),
    discountType: z.enum(['FIXED', 'PERCENT']).nullable().optional(),
    discountValue: z.coerce.number().min(0).nullable().optional(),
    
    // Tax Configuration (Situational Resolution)
    taxMode: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'NO_VAT']).default('INCLUSIVE'),
    taxRate: z.coerce.number().min(0).default(7),
});

export type SaleFormValues = z.infer<typeof saleFormSchema>;

export function getSaleFormDefaults(): SaleFormValues {
    return {
        customerId: null,
        customerName: null,
        customerAddress: null,
        isNewCustomer: false,
        showAddress: false,
        paymentMethod: '',
        notes: '',
        receiptUrl: null,
        isBackdated: false,
        date: new Date().toISOString().slice(0, 16),
        items: [{ productId: '', quantity: 1, salePrice: 0, discountAmount: 0 }],
        showDiscount: false,
        discountType: 'FIXED',
        discountValue: 0,
        taxMode: 'INCLUSIVE', // Default to Inclusive for better retail UX
        taxRate: 7,
    };
}

/**
 * SSOT Helper: Calculate totals for UI display using the same engine as the server.
 */
export function computeSaleTotals(values: SaleFormValues, products: any[]) {
    const computationItems: CalculationItemInput[] = (values.items || []).map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
            qty: Number(item.quantity) || 0,
            unitPrice: Number(item.salePrice) || 0,
            costPrice: product ? Number(product.costPrice) : 0,
            lineDiscount: Number(item.discountAmount) || 0,
        };
    });

    const config = {
        type: (values.showDiscount ? values.discountType : 'FIXED') as any,
        value: values.showDiscount ? (Number(values.discountValue) || 0) : 0
    };

    const taxConfig = {
        rate: Number(values.taxRate) || 0,
        mode: values.taxMode === 'NO_VAT' ? 'EXCLUSIVE' : (values.taxMode as any),
        kind: values.taxMode === 'NO_VAT' ? 'NO_VAT' : 'VAT' as any
    };

    return ComputationEngine.calculateTotals(computationItems, config, taxConfig);
}
