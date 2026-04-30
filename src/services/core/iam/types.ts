import { Permission } from '@prisma/client';

export interface PermissionData {
  shopId: string;
  roleId?: string;
  permissions: Permission[];
  isOwner: boolean;
  version: number;
}

export interface RoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault?: boolean;
}

export interface InviteMemberInput {
  email: string;
  roleId: string;
}
