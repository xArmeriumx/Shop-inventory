import { AuditPolicy } from './audit.service';

/**
 * ERP Audit Policies for IAM (Identity & Access Management) Module
 * Handles Security-critical actions.
 */
export const IAM_AUDIT_POLICIES = {
  // --- Role Management ---
  CREATE_ROLE: (roleName: string): AuditPolicy => ({
    action: 'IAM_ROLE_CREATE',
    targetType: 'Role',
    note: `สร้างบทบาทใหม่: ${roleName}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      name: data.name,
      permissions: data.permissions,
    })
  }),

  UPDATE_ROLE: (roleId: string, roleName: string, shopId?: string | null): AuditPolicy => ({
    action: 'IAM_ROLE_UPDATE',
    targetType: 'Role',
    targetId: roleId,
    note: `แก้ไขบทบาท: ${roleName}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      name: data.name,
      permissions: data.permissions,
    })
  }),

  DELETE_ROLE: (roleId: string, shopId?: string | null): AuditPolicy => ({
    action: 'IAM_ROLE_DELETE',
    targetType: 'Role',
    targetId: roleId,
    note: `ลบบทบาท ID: ${roleId}`,
  }),

  // --- Member Management ---
  INVITE_MEMBER: (shopId: string): AuditPolicy => ({
    action: 'IAM_MEMBER_INVITE',
    targetType: 'Shop',
    targetId: shopId,
    note: `เชิญสมาชิกใหม่เข้าร้าน`,
    afterSnapshot: (data: any) => ({
      userId: data.id,
      email: data.email,
      name: data.name,
    })
  }),

  UPDATE_MEMBER_ROLE: (memberId: string, shopId?: string | null): AuditPolicy => ({
    action: 'IAM_MEMBER_ROLE_UPDATE',
    targetType: 'ShopMember',
    targetId: memberId,
    note: `เปลี่ยนบทบาทสมาชิก`,
    afterSnapshot: (data: any) => ({
      memberId: data.id,
      roleId: data.roleId,
      userId: data.userId,
    })
  }),

  REMOVE_MEMBER: (memberId: string, shopId?: string | null): AuditPolicy => ({
    action: 'IAM_MEMBER_REMOVE',
    targetType: 'ShopMember',
    targetId: memberId,
    note: `ลบสมาชิกออกจากร้าน`,
  }),

  // --- Security ---
  SHOP_OWNER_TRANSFER: (shopName: string, fromUser: string, toUser: string): AuditPolicy => ({
    action: 'IAM_SHOP_TRANSFER',
    targetType: 'Shop',
    note: `โอนกรรมสิทธิ์ร้าน ${shopName} จาก ${fromUser} ไปยัง ${toUser}`,
  })
};
