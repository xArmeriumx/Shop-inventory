import { AuditPolicy } from '@/services/core/system/audit.service';

/**
 * ERP Audit Policies for Stock Take
 */
export const STOCK_TAKE_AUDIT_POLICIES = {
    CREATE: (productCount: number): AuditPolicy => ({
        action: 'STOCK_TAKE_CREATE',
        targetType: 'StockTakeSession',
        note: `เริ่มรายการตรวจนับสินค้าใหม่ (${productCount} รายการ)`,
    }),

    SUBMIT: (id: string): AuditPolicy => ({
        action: 'STOCK_TAKE_SUBMIT',
        targetType: 'StockTakeSession',
        targetId: id,
        note: `ส่งตรวจรายการนับสต็อก ID: ${id}`,
    }),

    COMPLETE: (id: string): AuditPolicy => ({
        action: 'STOCK_TAKE_COMPLETE',
        targetType: 'StockTakeSession',
        targetId: id,
        note: `อนุมัติและปรับปรุงสต็อกจากการตรวจนับ ID: ${id}`,
    }),

    CANCEL: (id: string, reason: string): AuditPolicy => ({
        action: 'STOCK_TAKE_CANCEL',
        targetType: 'StockTakeSession',
        targetId: id,
        note: `ยกเลิกรายการตรวจนับ: ${reason}`,
    })
};
