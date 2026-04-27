import { z } from 'zod';

export const purchaseReceiptLineSchema = z.object({
  purchaseItemId: z.string().min(1, 'ต้องมีรหัสรายการสั่งซื้อ'),
  productId: z.string().min(1, 'ต้องมีรหัสสินค้า'),
  receivedQuantity: z.number().min(0.01, 'จำนวนที่รับต้องมากกว่า 0'),
  warehouseId: z.string().min(1, 'กรุณาเลือกคลังสินค้า'),
});

export const purchaseReceiptSchema = z.object({
  purchaseId: z.string().min(1, 'ต้องมีรหัสใบสั่งซื้อ'),
  receivedDate: z.date().default(() => new Date()),
  notes: z.string().optional(),
  lineItems: z.array(purchaseReceiptLineSchema).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
});

export type PurchaseReceiptInput = z.infer<typeof purchaseReceiptSchema>;
export type PurchaseReceiptLineInput = z.infer<typeof purchaseReceiptLineSchema>;
