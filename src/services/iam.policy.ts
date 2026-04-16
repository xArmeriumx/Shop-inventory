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
    allowlist: ['id', 'name', 'permissions', 'description', 'isDefault'],
  }),

  UPDATE_ROLE: (roleId: string, roleName: string, shopId?: string | null): AuditPolicy => ({
    action: 'IAM_ROLE_UPDATE',
    targetType: 'Role',
    targetId: roleId,
    note: `แก้ไขบทบาท: ${roleName}`,
    allowlist: ['id', 'name', 'permissions', 'description', 'isDefault'],
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
    allowlist: ['id', 'email', 'name', 'roleId'],
  }),

  UPDATE_MEMBER_ROLE: (memberId: string, shopId?: string | null): AuditPolicy => ({
    action: 'IAM_MEMBER_ROLE_UPDATE',
    targetType: 'ShopMember',
    targetId: memberId,
    note: `เปลี่ยนบทบาทสมาชิก`,
    allowlist: ['id', 'roleId', 'userId', 'permissionVersion'],
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
  }),

  SESSION_REVOKE_ALL: (userId: string): AuditPolicy => ({
    action: 'SESSION_REVOKE_ALL',
    targetType: 'User',
    targetId: userId,
    note: 'ผู้ใช้ออกจากระบบทุกอุปกรณ์',
  }),

  SESSION_REVOKE_BY_ADMIN: (targetUserId: string, adminName: string): AuditPolicy => ({
    action: 'SESSION_REVOKE_BY_ADMIN',
    targetType: 'User',
    targetId: targetUserId,
    note: `Admin (${adminName}) เพิกถอน session ของผู้ใช้`,
  })
};
