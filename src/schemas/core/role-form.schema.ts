/**
 * Role Form Schema
 * 
 * Client-side validation for react-hook-form.
 */
import { z } from 'zod';

export const roleFormSchema = z.object({
    name: z.string().min(1, 'กรุณากรอกชื่อ Role').max(100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร'),
    description: z.string().max(500, 'คำอธิบายต้องไม่เกิน 500 ตัวอักษร').optional().nullable(),
    isDefault: z.boolean().default(false),
    permissions: z.array(z.string()).min(1, 'กรุณาเลือกอย่างน้อย 1 สิทธิ์'),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;

export function getRoleFormDefaults(role?: any): RoleFormValues {
    return {
        name: role?.name ?? '',
        description: role?.description ?? '',
        isDefault: role?.isDefault ?? false,
        permissions: role?.permissions ?? [],
    };
}
