/**
 * Global Accounting Constants
 * Single Source of Truth for financial business rules and UI configuration.
 */

export const ACCOUNTING_CONFIG = {
    // Reconciliation
    RECONCILE_BUFFER_DAYS: 7, // +/- days to search for match candidates

    // Status Display Colors (Tailwind classes)
    STATUS_COLORS: {
        UNMATCHED: 'text-orange-600 bg-orange-50',
        MATCHED: 'text-green-600 bg-green-50',
        IGNORED: 'text-gray-600 bg-gray-50',
        CLEARED: 'text-blue-600 bg-blue-50',
        UNCLEARED: 'text-red-600 bg-red-50',
    },

    // Transaction Types
    SOURCE_TYPES: {
        INVOICE: 'INVOICE',
        PAYMENT: 'PAYMENT',
        JOURNAL: 'JOURNAL',
        TAX: 'TAX',
        BANK: 'BANK'
    },

    /**
     * มาตรฐานการแมปผังบัญชี (Account Mapping Master)
     * ป้องกันการ Hardcode ในระดับ Logic
     */
    ACCOUNT_MAPPING: {
        INVOICE_AR: '1101-00',           // ลูกหนี้การค้า
        INVOICE_REVENUE: '4101-00',      // รายได้จากการขาย
        INVOICE_VAT: '2130-00',          // ภาษีขาย
        PAYMENT_CASH_BANK: '1101-01',    // เงินสด/ธนาคาร (Pending GL mapping UI)
        PAYMENT_AR_OFFSET: '1101-00',    // ตัดยอดลูกหนี้ (AR)
        PURCHASE_AP: '2101-00',          // เจ้าหนี้การค้า
        PURCHASE_STOCK: '1105-00',       // สต็อกสินค้า
        PURCHASE_VAT: '1130-00',         // ภาษีซื้อ
        COGS_EXPENSE: '5101-00',         // ต้นทุนขาย (COGS)
        INVENTORY_ASSET: '1105-00',      // สินทรัพย์สินค้าคงเหลือ
        STOCK_ADJUST_EXPENSE: '5201-00', // ส่วนปรับปรุงมูลค่าสต็อก (Variance)
        SALES_RETURN: '4101-01',         // รับคืนสินค้า (Revenue Contra)
    }
};

