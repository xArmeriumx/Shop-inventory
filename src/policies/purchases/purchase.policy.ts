import { AuditPolicy } from '@/services/core/system/audit.service';
import { PurchaseStatus } from '@/types/domain';

/**
 * ERP Audit Policies for Purchase Module
 * Handles PR, PO, and Stock Reception snapshots.
 */
export const PURCHASE_AUDIT_POLICIES = {
  CREATE: (purchaseNumber: string): AuditPolicy => ({
    action: 'PURCHASE_CREATE',
    targetType: 'Purchase',
    note: `สร้างรายการซื้อ ${purchaseNumber}`,
    afterSnapshot: (data: any) => ({
      purchaseNumber: data.purchaseNumber,
      vendorName: data.vendorName,
      totalCost: data.totalCost,
      itemCount: data.items?.length || 0,
    })
  }),

  CANCEL: (purchaseNumber: string, reason: string): AuditPolicy => ({
    action: 'PURCHASE_VOID',
    targetType: 'Purchase',
    note: `ยกเลิกรายการซื้อ ${purchaseNumber}${reason ? ` (สาเหตุ: ${reason})` : ''}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      status: 'CANCELLED',
    })
  }),

  CONVERT_PR_TO_PO: (prNumber: string, poNumber: string): AuditPolicy => ({
    action: 'PURCHASE_CONVERT',
    targetType: 'Purchase',
    note: `เปลี่ยน PR ${prNumber} เป็น PO ${poNumber}`,
  }),

  APPROVE: (prNumber: string): AuditPolicy => ({
    action: 'APPROVAL_ACTION',
    targetType: 'Purchase',
    note: `อนุมัติใบขอซื้อ ${prNumber}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      purchaseNumber: data.purchaseNumber,
      status: PurchaseStatus.APPROVED,
    }),
  }),

  RECEIVE: (purchaseNumber: string): AuditPolicy => ({
    action: 'PURCHASE_RECEIVE',
    targetType: 'Purchase',
    note: `รับสินค้าเข้าสต็อกจากการซื้อ ${purchaseNumber}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      status: 'COMPLETED',
      receivedAt: new Date(),
    })
  }),

  CHARGE_ALLOCATION: (purchaseNumber: string, totalCharges: number): AuditPolicy => ({
    action: 'PURCHASE_CHARGE_ALLOCATION',
    targetType: 'Purchase',
    note: `กระจายค่าใช้จ่ายเพิ่มเติม (รวม ${totalCharges}) ลงในรายการสินค้า ${purchaseNumber}`,
  })
};
