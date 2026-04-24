import { AUDIT_ACTIONS } from '@/services/core/system/audit.service';

/**
 * Audit Policy for Finance & Billing (ERP Rule 6)
 */
export const FINANCE_AUDIT_POLICIES = {
  INCOME_CREATE: (description: string) => ({
    action: 'INCOME_CREATE',
    targetType: 'Income',
    allowlist: ['amount', 'description', 'date', 'category', 'categoryId', 'paymentMethod'],
    note: `บันทึกรายรับ: ${description}`,
  }),

  INCOME_UPDATE: (id: string, description: string) => ({
    action: 'INCOME_UPDATE',
    targetType: 'Income',
    targetId: id,
    allowlist: ['amount', 'description', 'date', 'category', 'categoryId', 'paymentMethod'],
    note: `แก้ไขรายรับ: ${description}`,
  }),

  INCOME_DELETE: (id: string, description: string) => ({
    action: 'INCOME_DELETE',
    targetType: 'Income',
    targetId: id,
    allowlist: ['amount', 'description', 'deletedAt'],
    note: `ลบรายรับ: ${description}`,
  }),

  EXPENSE_CREATE: (description: string) => ({
    action: 'EXPENSE_CREATE',
    targetType: 'Expense',
    allowlist: ['amount', 'description', 'date', 'category', 'categoryId'],
    note: `บันทึกค่าใช้จ่าย: ${description}`,
  }),

  EXPENSE_UPDATE: (id: string, description: string) => ({
    action: 'EXPENSE_UPDATE',
    targetType: 'Expense',
    targetId: id,
    allowlist: ['amount', 'description', 'date', 'category', 'categoryId'],
    note: `แก้ไขค่าใช้จ่าย: ${description}`,
  }),

  EXPENSE_DELETE: (id: string, description: string) => ({
    action: 'EXPENSE_DELETE',
    targetType: 'Expense',
    targetId: id,
    allowlist: ['amount', 'description', 'deletedAt'],
    note: `ลบค่าใช้จ่าย: ${description}`,
  }),

  SALE_BILLING_MARK: (invoiceNumber: string) => ({
    action: 'SALE_BILLING_MARK',
    targetType: 'Sale',
    allowlist: ['billingStatus', 'invoiceNumber'],
    note: `วางบิลรายการขาย: ${invoiceNumber}`,
  }),
};
