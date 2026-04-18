import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { normalizePhone, normalizeWhitespace } from '@/lib/normalizers';

export const shipmentSchema = z.object({
  saleId: z.string().min(1, 'กรุณาเลือกรายการขาย'),
  recipientName: z
    .string()
    .min(1, 'กรุณากรอกชื่อผู้รับ')
    .max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร')
    .transform(normalizeWhitespace)
    .transform((val) => val || '')
    .transform(sanitizeText),
  recipientPhone: z
    .string()
    .optional()
    .nullable()
    .transform((val) => normalizePhone(val))
    .refine((val) => !val || (val.length >= 9 && val.length <= 10), 'เบอร์โทรต้องมี 9-10 หลัก'),
  shippingAddress: z
    .string()
    .min(1, 'กรุณากรอกที่อยู่จัดส่ง')
    .transform(normalizeWhitespace)
    .transform((val) => val || '')
    .transform(sanitizeText),
  customerAddressId: z.string().optional().nullable(),
  trackingNumber: z
    .string()
    .max(100, 'หมายเลข Tracking ต้องไม่เกิน 100 ตัวอักษร')
    .optional()
    .nullable()
    .transform(normalizeWhitespace),
  shippingProvider: z
    .string()
    .max(100, 'บริษัทขนส่งต้องไม่เกิน 100 ตัวอักษร')
    .optional()
    .nullable()
    .transform(normalizeWhitespace),
  shippingCost: z.coerce.number().min(0, 'ค่าส่งต้องไม่ติดลบ').optional().nullable(),
  notes: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(normalizeWhitespace(val) || '') : val),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export type ShipmentInput = z.input<typeof shipmentSchema>;

export const updateShipmentSchema = z.object({
  id: z.string().min(1),
  trackingNumber: z.string().max(100).optional().nullable().transform(normalizeWhitespace),
  shippingProvider: z.string().max(100).optional().nullable().transform(normalizeWhitespace),
  shippingCost: z.coerce.number().min(0).optional().nullable(),
  recipientName: z.string().min(1).max(200).transform(sanitizeText).optional(),
  recipientPhone: z
    .string()
    .optional()
    .nullable()
    .transform((val) => normalizePhone(val))
    .refine((val) => !val || (val.length >= 9 && val.length <= 10), 'เบอร์โทรต้องมี 9-10 หลัก'),
  shippingAddress: z.string().min(1).transform(sanitizeText).optional(),
  notes: z.string().transform(sanitizeText).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export type UpdateShipmentInput = z.input<typeof updateShipmentSchema>;

export const updateShipmentStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'], {
    errorMap: () => ({ message: 'สถานะการจัดส่งไม่ถูกต้อง' }),
  }),
});

export type UpdateShipmentStatusInput = z.input<typeof updateShipmentStatusSchema>;
