/**
 * ERP Financial Constants (Layer 2.1)
 * Centralized mapping for statuses, labels, and UI aesthetics.
 */

export const PAYMENT_METHODS = {
    CASH: { code: 'CASH', label: 'เงินสด', color: 'green' },
    TRANSFER: { code: 'TRANSFER', label: 'เงินโอน', color: 'blue' },
    CREDIT_CARD: { code: 'CREDIT_CARD', label: 'บัตรเครดิต', color: 'purple' },
    CHEQUE: { code: 'CHEQUE', label: 'เช็ค', color: 'orange' },
} as const;

export const PAYMENT_STATUS_META = {
    POSTED: { label: 'บันทึกแล้ว', color: 'green', description: 'รายการชำระปกติ' },
    VOIDED: { label: 'ยกเลิกแล้ว', color: 'red', description: 'รายการชำระที่ถูกยกเลิก (Audit Only)' },
} as const;

export const DOC_PAYMENT_STATUS_META = {
    UNPAID: { label: 'รอชำระ', color: 'gray', badge: 'secondary' },
    PARTIAL: { label: 'ชำระบางส่วน', color: 'blue', badge: 'warning' },
    PAID: { label: 'ชำระครบแล้ว', color: 'green', badge: 'success' },
} as const;

export const CURRENCIES = {
    THB: { code: 'THB', symbol: '฿', name: 'Thai Baht' },
} as const;
