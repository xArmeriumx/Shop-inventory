import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร').max(100, 'ชื่อยาวเกินไป'),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').toLowerCase().trim(),
  password: z.string().min(10, 'รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร'),
});

export const loginSchema = z.object({
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').toLowerCase().trim(),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
