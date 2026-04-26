import { AuditPolicy } from '@/services/core/system/audit.service';

/**
 * ERP Audit Policies for Warehouse Management
 */
export const WAREHOUSE_AUDIT_POLICIES = {
    CREATE: (name: string, code: string): AuditPolicy => ({
        action: 'WAREHOUSE_CREATE',
        targetType: 'Warehouse',
        note: `สร้างคลังสินค้าใหม่: ${name} (${code})`,
        afterSnapshot: (data: any) => ({
            id: data.id,
            name: data.name,
            code: data.code,
            isDefault: data.isDefault
        })
    }),

    ADJUST_STOCK: (warehouseName: string, productName: string, delta: number): AuditPolicy => ({
        action: 'WAREHOUSE_STOCK_ADJUST',
        targetType: 'WarehouseStock',
        note: `ปรับสต็อกคลัง ${warehouseName} | สินค้า: ${productName} | จำนวน: ${delta > 0 ? '+' : ''}${delta}`,
        afterSnapshot: (data: any) => ({
            warehouseId: data.warehouseId,
            productId: data.productId,
            quantity: data.quantity
        })
    })
};
