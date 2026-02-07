import { z } from 'zod';

export const shipmentSchema = z.object({
  saleId: z.string().min(1, 'กรุณาเลือกรายการขาย'),
  recipientName: z.string().min(1, 'กรุณากรอกชื่อผู้รับ').max(200),
  recipientPhone: z.string().max(20).optional().nullable(),
  shippingAddress: z.string().min(1, 'กรุณากรอกที่อยู่จัดส่ง'),
  customerAddressId: z.string().optional().nullable(),
  trackingNumber: z.string().max(100).optional().nullable(),
  shippingProvider: z.string().max(100).optional().nullable(),
  shippingCost: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ShipmentInput = z.infer<typeof shipmentSchema>;

export const updateShipmentSchema = z.object({
  id: z.string().min(1),
  trackingNumber: z.string().max(100).optional().nullable(),
  shippingProvider: z.string().max(100).optional().nullable(),
  shippingCost: z.coerce.number().min(0).optional().nullable(),
  recipientName: z.string().min(1).max(200).optional(),
  recipientPhone: z.string().max(20).optional().nullable(),
  shippingAddress: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
});

export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;

export const updateShipmentStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED']),
});

export type UpdateShipmentStatusInput = z.infer<typeof updateShipmentStatusSchema>;
