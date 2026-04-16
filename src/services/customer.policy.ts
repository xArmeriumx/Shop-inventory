import { AUDIT_ACTIONS } from './audit.service';

/**
 * Audit Policy for Customer / CRM (ERP Rule 8)
 */
export const CUSTOMER_AUDIT_POLICIES = {
  CREATE: (name: string) => ({
    action: 'CUSTOMER_CREATE',
    targetType: 'Customer',
    allowlist: ['name', 'phone', 'email', 'address', 'taxId', 'region', 'groupCode', 'creditLimit', 'creditTerm'],
    note: `เพิ่มลูกค้าใหม่: ${name}`,
  }),

  UPDATE: (id: string, name: string) => ({
    action: 'CUSTOMER_UPDATE',
    targetType: 'Customer',
    targetId: id,
    allowlist: ['name', 'phone', 'email', 'address', 'taxId', 'region', 'groupCode', 'creditLimit', 'creditTerm'],
    note: `แก้ไขข้อมูลลูกค้า: ${name}`,
  }),

  DELETE: (id: string, name: string) => ({
    action: 'CUSTOMER_DELETE',
    targetType: 'Customer',
    targetId: id,
    allowlist: ['deletedAt'],
    note: `ลบลูกค้า: ${name}`,
  }),

  ADDRESS_CREATE: (customerName: string) => ({
    action: 'CUSTOMER_ADDRESS_CREATE',
    targetType: 'CustomerAddress',
    allowlist: ['name', 'phone', 'address', 'isDefault'],
    note: `เพิ่มที่อยู่สำหรับลูกค้า: ${customerName}`,
  }),

  ADDRESS_UPDATE: (id: string, customerName: string) => ({
    action: 'CUSTOMER_ADDRESS_UPDATE',
    targetType: 'CustomerAddress',
    targetId: id,
    allowlist: ['name', 'phone', 'address', 'isDefault'],
    note: `แก้ไขที่อยู่สำหรับลูกค้า: ${customerName}`,
  }),

  ADDRESS_DELETE: (id: string, customerName: string) => ({
    action: 'CUSTOMER_ADDRESS_DELETE',
    targetType: 'CustomerAddress',
    targetId: id,
    allowlist: ['deletedAt'],
    note: `ลบที่อยู่สำหรับลูกค้า: ${customerName}`,
  }),
};
