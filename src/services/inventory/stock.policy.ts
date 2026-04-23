import { AuditPolicy } from '@/services/core/audit.service';

/**
 * ERP Audit Policies for Stock & Inventory
 * Handles manual adjustments and critical stock movements.
 */
export const STOCK_AUDIT_POLICIES = {
  MANUAL_ADJUST: (productName: string, type: string, quantity: number, reason: string): AuditPolicy => ({
    action: 'STOCK_ADJUST',
    targetType: 'Product',
    note: `ปรับปรุงสต็อก ${productName} (${type} ${quantity}): ${reason}`,
    afterSnapshot: (data: any) => ({
      productId: data.productId,
      quantity: data.quantity,
      type: data.type,
      note: data.note,
    })
  }),

  RESERVE: (productId: string, quantity: number): AuditPolicy => ({
    action: 'STOCK_RESERVE',
    targetType: 'Product',
    targetId: productId,
    note: `จองสต็อกสินค้า ID: ${productId} จำนวน ${quantity} ชิ้น`,
  }),

  RELEASE: (productId: string, quantity: number): AuditPolicy => ({
    action: 'STOCK_RELEASE',
    targetType: 'Product',
    targetId: productId,
    note: `คืนสต็อกสินค้า ID: ${productId} จำนวน ${quantity} ชิ้น`,
  }),

  DEDUCT: (productId: string, quantity: number): AuditPolicy => ({
    action: 'STOCK_DEDUCT',
    targetType: 'Product',
    targetId: productId,
    note: `ตัดสต็อกสินค้า ID: ${productId} จำนวน ${quantity} ชิ้น (ขาย)`,
  }),

  MOVE: (productId: string, type: string, quantity: number, note?: string): AuditPolicy => ({
    action: 'STOCK_MOVE',
    targetType: 'Product',
    targetId: productId,
    note: `บันทึกการเคลื่อนไหวสต็อก (${type} ${quantity})${note ? `: ${note}` : ''}`,
    afterSnapshot: (data: any) => ({
      productId: data.id || productId,
      qtyBefore: data.qtyBefore,
      qtyAfter: data.qtyAfter,
      changeQty: data.changeQty,
    })
  }),

  BULK_MOVE: (count: number): AuditPolicy => ({
    action: 'STOCK_BULK_MOVE',
    targetType: 'Product',
    note: `บันทึกการเคลื่อนไหวสต็อกแบบกลุ่ม (${count} รายการ)`,
    afterSnapshot: (data: any) => ({
      affectedCount: data.affectedCount,
      totalQuantityChange: data.totalQuantityChange,
      movementTypes: data.movementTypes,
    })
  })
};
