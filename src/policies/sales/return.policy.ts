import { AuditPolicy } from '@/services/core/system/audit.service';

/**
 * ERP Audit Policies for Return Module
 */
export const RETURN_AUDIT_POLICIES = {
  CREATE: (returnNumber: string, invoiceNumber: string): AuditPolicy => ({
    action: 'RETURN_CREATE',
    targetType: 'Return',
    note: `บันทึกการคืนสินค้า ${returnNumber} จากบิล ${invoiceNumber}`,
    afterSnapshot: (data: any) => ({
      returnNumber: data.returnNumber,
      saleInvoiceNumber: invoiceNumber,
      refundAmount: data.refundAmount,
      itemCount: data.items?.length || 0,
    })
  })
};
