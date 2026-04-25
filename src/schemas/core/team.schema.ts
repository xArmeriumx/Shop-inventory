/**
 * Team Management Schemas
 */
import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z.string().email('กรุณาระบุอีเมลที่ถูกต้อง'),
  roleId: z.string().min(1, 'กรุณาเลือกบทบาท'),
});

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;

export function getInviteMemberDefaults(): InviteMemberValues {
  return {
    email: '',
    roleId: '',
  };
}
