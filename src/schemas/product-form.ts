/**
 * Product Form Schema
 * 
 * PURPOSE: Defines the "raw input" shape for react-hook-form.
 * This schema handles ONLY client-side validation (required fields, basic ranges).
 * 
 * NORMALIZATION (trim, uppercase SKU, sanitize) happens in the BACKEND schema 
 * (productSchema) when the Server Action validates the data.
 * 
 * SINGLE SOURCE OF TRUTH:
 * - Form validation rules → this file (productFormSchema)
 * - Data normalization    → src/schemas/product.ts (productSchema)  
 * - Server-side validation → Server Action (uses productSchema.safeParse)
 * 
 * This separation avoids the "double validation with different rules" anti-pattern.
 */
import { z } from 'zod';

export const productFormSchema = z.object({
    // -- Identity --
    name: z.string().min(1, 'กรุณากรอกชื่อสินค้า').max(200, 'ชื่อสินค้าต้องไม่เกิน 200 ตัวอักษร'),
    description: z.string().max(1000, 'รายละเอียดต้องไม่เกิน 1000 ตัวอักษร').optional().nullable(),
    sku: z.string().max(50, 'SKU ต้องไม่เกิน 50 ตัวอักษร').optional().nullable(),
    category: z.string().min(1, 'กรุณาเลือกหมวดหมู่'),

    // -- Pricing --
    costPrice: z.coerce.number({ invalid_type_error: 'กรุณากรอกราคาทุน' }).min(0, 'ราคาทุนต้องไม่ติดลบ').max(999999999, 'ราคาทุนสูงเกินไป'),
    salePrice: z.coerce.number({ invalid_type_error: 'กรุณากรอกราคาขาย' }).min(0, 'ราคาขายต้องไม่ติดลบ').max(999999999, 'ราคาขายสูงเกินไป'),

    // -- Inventory --
    stock: z.coerce.number({ invalid_type_error: 'กรุณากรอกจำนวนสต็อก' }).int('จำนวนต้องเป็นจำนวนเต็ม').min(0, 'จำนวนสต็อกต้องไม่ติดลบ'),
    minStock: z.coerce.number().int().min(0).default(5),

    // -- ERP / Procurement --
    moq: z.coerce.number().int().min(0).optional().nullable(),
    packagingQty: z.coerce.number().int().min(1, 'จำนวนต่อแพ็กต้องมีอย่างน้อย 1').default(1),
    isActive: z.boolean().default(true),
    isSaleable: z.boolean().default(true),

    // -- Media --
    images: z.array(z.string()).default([]),

    // -- Logistics (nested metadata) --
    metadata: z.object({
        weight: z.coerce.number().min(0).optional().default(0),
        width: z.coerce.number().min(0).optional().default(0),
        height: z.coerce.number().min(0).optional().default(0),
        length: z.coerce.number().min(0).optional().default(0),
    }).default({}),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Build default values for the form from an existing product or empty state.
 * This is the SINGLE place to define default values — do not scatter defaults.
 */
export function getProductFormDefaults(product?: any): ProductFormValues {
    const metadata = (product?.metadata as Record<string, any>) || {};
    return {
        name: product?.name ?? '',
        description: product?.description ?? '',
        sku: product?.sku ?? '',
        category: product?.category ?? '',
        costPrice: product?.costPrice ?? 0,
        salePrice: product?.salePrice ?? 0,
        stock: product?.stock ?? 0,
        minStock: product?.minStock ?? 5,
        moq: product?.moq ?? null,
        packagingQty: product?.packagingQty ?? 1,
        isActive: product?.isActive ?? true,
        isSaleable: product?.isSaleable ?? true,
        images: product?.images ?? [],
        metadata: {
            weight: metadata.weight ?? 0,
            width: metadata.width ?? 0,
            height: metadata.height ?? 0,
            length: metadata.length ?? 0,
        },
    };
}
