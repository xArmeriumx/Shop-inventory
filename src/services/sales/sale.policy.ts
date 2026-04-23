import { AuditPolicy } from '@/services/core/audit.service';
import { SaleStatus, BookingStatus } from '@/types/domain';

/**
 * ERP Audit Policies for Sales Module
 * High-complexity snapshots for business-critical transactions.
 */
export const SALE_AUDIT_POLICIES = {
  CREATE: (invoiceNumber: string): AuditPolicy => ({
    action: 'SALE_CREATE',
    targetType: 'Sale',
    note: `สร้างรายการขาย ${invoiceNumber}`,
    // Summary of items for quick view in audit logs
    afterSnapshot: (data: any) => ({
      invoiceNumber: data.invoiceNumber,
      customerName: data.customerName,
      totalAmount: data.totalAmount,
      itemCount: data.items?.length || 0,
    })
  }),

  UPDATE: (invoiceNumber: string, payload: any): AuditPolicy => ({
    action: 'SALE_UPDATE',
    targetType: 'Sale',
    note: `แก้ไขข้อมูลรายการขาย ${invoiceNumber}`,
  }),

  CANCEL: (invoiceNumber: string, reason: string): AuditPolicy => ({
    action: 'SALE_CANCEL',
    targetType: 'Sale',
    note: `ยกเลิกรายการขาย ${invoiceNumber}${reason ? ` (สาเหตุ: ${reason})` : ''}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      status: SaleStatus.CANCELLED,
      bookingStatus: BookingStatus.NONE,
    })
  }),

  CONFIRM: (invoiceNumber: string): AuditPolicy => ({
    action: 'SALE_CONFIRM',
    targetType: 'Sale',
    note: `ยืนยันรายการขาย ${invoiceNumber}`,
  }),

  COMPLETE: (invoiceNumber: string): AuditPolicy => ({
    action: 'SALE_COMPLETE',
    targetType: 'Sale',
    note: `จัดส่งและตัดสต็อกรายการขาย ${invoiceNumber}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      status: SaleStatus.COMPLETED,
      deliveryStatus: 'SHIPPED',
    })
  }),

  GENERATE_INVOICE: (invoiceNumber: string): AuditPolicy => ({
    action: 'SALE_INVOICE_GEN',
    targetType: 'Sale',
    note: `ออกใบกำกับภาษี/ใบเสร็จ ${invoiceNumber}`,
  }),

  PAYMENT: (invoiceNumber: string, status: string, note?: string): AuditPolicy => ({
    action: 'SALE_PAYMENT',
    targetType: 'Sale',
    note: `บันทึกการชำระเงิน ${invoiceNumber}: ${status}${note ? ` (${note})` : ''}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      paymentStatus: data.paymentStatus,
      paymentVerifiedAt: data.paymentVerifiedAt,
    })
  }),

  BILLING_MARK: (invoiceNumber: string): AuditPolicy => ({
    action: 'SALE_BILLING_MARK',
    targetType: 'Sale',
    note: `วางบิลรายการขาย ${invoiceNumber}`,
  })
};
