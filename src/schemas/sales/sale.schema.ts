import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const saleItemSchema = z.object({
  productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
  quantity: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวน' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(1, 'จำนวนต้องมากกว่า 0'),
  salePrice: z
    .number({ invalid_type_error: 'กรุณากรอกราคาขาย' })
    .min(0, 'ราคาต้องไม่ติดลบ'),
  costPrice: z.number().min(0).optional(),
  // G4: Item-level discount (ส่วนลดต่อชิ้น เป็นบาท)
  discountAmount: z.number().min(0, 'ส่วนลดต้องไม่ติดลบ').default(0),
});

export const saleSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z
    .string()
    .max(200, 'ชื่อลูกค้าต้องไม่เกิน 200 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CREDIT'], {
    errorMap: () => ({ message: 'กรุณาเลือกวิธีชำระเงิน' }),
  }),
  notes: z
    .string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
  items: z
    .array(saleItemSchema)
    .min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
  receiptUrl: z.string().url().optional().nullable(),
  customerAddress: z.string().max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร').optional().nullable().transform((val) => val ? sanitizeText(val) : val),
  date: z.string().optional(),
  // G4: Bill-level discount (ส่วนลดทั้งบิล)
  discountType: z.enum(['PERCENT', 'FIXED']).optional().nullable(),
  discountValue: z.number().min(0, 'ส่วนลดต้องไม่ติดลบ').optional().nullable(),
  departmentCode: z.string().max(50).optional().nullable(),
  
  // Tax Mapping (G10/Phase 3 Standard)
  taxMode: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'NO_VAT']).default('INCLUSIVE'),
  taxRate: z.number().min(0).default(7),
});

export type SaleInput = z.input<typeof saleSchema>;
export type SaleItemInput = z.input<typeof saleItemSchema>;
export type SaleOutput = z.infer<typeof saleSchema>;
