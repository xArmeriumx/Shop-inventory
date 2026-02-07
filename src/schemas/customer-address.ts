import { z } from 'zod';

export const customerAddressSchema = z.object({
  customerId: z.string().min(1, 'กรุณาเลือกลูกค้า'),
  label: z.string().max(50).optional().nullable(),
  recipientName: z.string().min(1, 'กรุณากรอกชื่อผู้รับ').max(200),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().min(1, 'กรุณากรอกที่อยู่'),
  district: z.string().max(100).optional().nullable(),
  subDistrict: z.string().max(100).optional().nullable(),
  province: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(10).optional().nullable(),
  isDefault: z.boolean().default(false),
});

export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
