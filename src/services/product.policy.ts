import { AuditPolicy } from './audit.service';

/**
 * ERP Audit Policies for Product Master Data
 */
export const PRODUCT_AUDIT_POLICIES = {
  CREATE: (name: string): AuditPolicy => ({
    action: 'PRODUCT_CREATE',
    targetType: 'Product',
    note: `สร้างสินค้าใหม่: ${name}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      name: data.name,
      sku: data.sku,
      salePrice: data.salePrice,
    })
  }),

  UPDATE: (id: string, name: string): AuditPolicy => ({
    action: 'PRODUCT_UPDATE',
    targetType: 'Product',
    targetId: id,
    note: `แก้ไขข้อมูลสินค้า: ${name}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      name: data.name,
      sku: data.sku,
      salePrice: data.salePrice,
      isActive: data.isActive,
    })
  }),

  DELETE: (id: string, name: string): AuditPolicy => ({
    action: 'PRODUCT_DELETE',
    targetType: 'Product',
    targetId: id,
    note: `ลบสินค้า (Soft Delete): ${name}`,
  }),

  BATCH_CREATE: (count: number): AuditPolicy => ({
    action: 'PRODUCT_BATCH_CREATE',
    targetType: 'Product',
    note: `นำเข้าสินค้าแบบกลุ่ม (${count} รายการ)`,
    afterSnapshot: (data: any) => ({
      count,
      successCount: data.created?.length || 0,
      failedCount: data.failed?.length || 0,
    })
  })
};
