import { AUDIT_ACTIONS } from '@/services/core/audit.service';

/**
 * Audit Policy for Supplier / Procurement (ERP Rule 10)
 */
export const SUPPLIER_AUDIT_POLICIES = {
  CREATE: (name: string) => ({
    action: 'PURCHASE_CREATE',
    targetType: 'Supplier',
    allowlist: ['name', 'code', 'contactName', 'phone', 'email', 'address', 'taxId', 'moq', 'purchaseNote', 'groupCode'],
    note: `เพิ่มผู้จำหน่ายใหม่: ${name}`,
  }),

  UPDATE: (id: string, name: string) => ({
    action: 'PURCHASE_UPDATE',
    targetType: 'Supplier',
    targetId: id,
    allowlist: ['name', 'code', 'contactName', 'phone', 'email', 'address', 'taxId', 'moq', 'purchaseNote', 'groupCode'],
    note: `แก้ไขข้อมูลผู้จำหน่าย: ${name}`,
  }),

  DELETE: (id: string, name: string) => ({
    action: 'PURCHASE_DELETE',
    targetType: 'Supplier',
    targetId: id,
    allowlist: ['deletedAt'],
    note: `ลบผู้จำหน่าย: ${name}`,
  }),

  PRODUCT_UPSERT: (supplierName: string, productSku: string) => ({
    action: 'SUPPLIER_PRODUCT_UPSERT',
    targetType: 'SupplierProduct',
    allowlist: ['vendorSku', 'vendorPrice', 'moq', 'leadTime'],
    note: `อัปเดตข้อมูลสินค้าจากคู่ค้า: ${productSku} (${supplierName})`,
  }),

  PRODUCT_REMOVE: (supplierName: string, productSku: string) => ({
    action: 'SUPPLIER_PRODUCT_REMOVE',
    targetType: 'SupplierProduct',
    allowlist: ['deletedAt'],
    note: `ยกเลิกรายการสินค้าจากคู่ค้า: ${productSku} (${supplierName})`,
  }),
};
