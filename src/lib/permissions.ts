/**
 * Predefined permission sets for common roles
 * Used when creating new roles to quickly assign permissions
 */
export const PERMISSION_PRESETS = {
  MANAGER: [
    'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRODUCT_VIEW_COST',
    'STOCK_VIEW_HISTORY', 'STOCK_ADJUST',
    'SALE_VIEW', 'SALE_CREATE', 'SALE_VIEW_PROFIT', 'SALE_CANCEL',
    'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_CANCEL',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
    'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_EDIT', 'EXPENSE_DELETE',
    'REPORT_VIEW_SALES', 'REPORT_VIEW_PROFIT', 'REPORT_EXPORT',
    'SETTINGS_SHOP', 'SETTINGS_LOOKUPS',
    'TEAM_VIEW',
    'POS_ACCESS',
    'SHIPMENT_VIEW', 'SHIPMENT_CREATE', 'SHIPMENT_EDIT', 'SHIPMENT_CANCEL',
    'PAYMENT_VERIFY',      // G1
    'RETURN_VIEW', 'RETURN_CREATE',  // G3
    'DELIVERY_VIEW', 'DELIVERY_VALIDATE', // ERP
  ] as const,

  CASHIER: [
    'PRODUCT_VIEW',
    'SALE_VIEW', 'SALE_CREATE',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'POS_ACCESS',
  ] as const,

  STOCK_KEEPER: [
    'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_VIEW_COST',
    'STOCK_VIEW_HISTORY', 'STOCK_ADJUST',
    'PURCHASE_VIEW', 'PURCHASE_CREATE',
  ] as const,
} as const;

/**
 * All available permissions grouped by category
 */
export const PERMISSION_GROUPS = {
  products: {
    label: 'สินค้า',
    permissions: [
      { key: 'PRODUCT_VIEW', label: 'ดูสินค้า' },
      { key: 'PRODUCT_CREATE', label: 'เพิ่มสินค้า' },
      { key: 'PRODUCT_EDIT', label: 'แก้ไขสินค้า' },
      { key: 'PRODUCT_DELETE', label: 'ลบสินค้า' },
      { key: 'PRODUCT_VIEW_COST', label: 'ดูราคาทุน' },
    ],
  },
  stock: {
    label: 'สต็อก',
    permissions: [
      { key: 'STOCK_VIEW_HISTORY', label: 'ดูประวัติสต็อก' },
      { key: 'STOCK_ADJUST', label: 'ปรับสต็อก' },
    ],
  },
  sales: {
    label: 'ขายสินค้า',
    permissions: [
      { key: 'SALE_VIEW', label: 'ดูรายการขาย' },
      { key: 'SALE_CREATE', label: 'บันทึกการขาย' },
      { key: 'SALE_VIEW_PROFIT', label: 'ดูกำไร' },
      { key: 'SALE_CANCEL', label: 'ยกเลิกรายการขาย' },
    ],
  },
  purchases: {
    label: 'ซื้อสินค้า',
    permissions: [
      { key: 'PURCHASE_VIEW', label: 'ดูรายการซื้อ' },
      { key: 'PURCHASE_CREATE', label: 'บันทึกการซื้อ' },
      { key: 'PURCHASE_CANCEL', label: 'ยกเลิกรายการซื้อ' },
    ],
  },
  customers: {
    label: 'ลูกค้า',
    permissions: [
      { key: 'CUSTOMER_VIEW', label: 'ดูลูกค้า' },
      { key: 'CUSTOMER_CREATE', label: 'เพิ่มลูกค้า' },
      { key: 'CUSTOMER_EDIT', label: 'แก้ไขลูกค้า' },
      { key: 'CUSTOMER_DELETE', label: 'ลบลูกค้า' },
    ],
  },
  expenses: {
    label: 'ค่าใช้จ่าย',
    permissions: [
      { key: 'EXPENSE_VIEW', label: 'ดูค่าใช้จ่าย' },
      { key: 'EXPENSE_CREATE', label: 'เพิ่มค่าใช้จ่าย' },
      { key: 'EXPENSE_EDIT', label: 'แก้ไขค่าใช้จ่าย' },
      { key: 'EXPENSE_DELETE', label: 'ลบค่าใช้จ่าย' },
    ],
  },
  reports: {
    label: 'รายงาน',
    permissions: [
      { key: 'REPORT_VIEW_SALES', label: 'ดูรายงานขาย' },
      { key: 'REPORT_VIEW_PROFIT', label: 'ดูรายงานกำไร' },
      { key: 'REPORT_EXPORT', label: 'ส่งออกรายงาน' },
    ],
  },
  settings: {
    label: 'ตั้งค่า',
    permissions: [
      { key: 'SETTINGS_SHOP', label: 'ตั้งค่าร้านค้า' },
      { key: 'SETTINGS_LOOKUPS', label: 'จัดการหมวดหมู่' },
    ],
  },
  team: {
    label: 'ทีม',
    permissions: [
      { key: 'TEAM_VIEW', label: 'ดูสมาชิก' },
      { key: 'TEAM_INVITE', label: 'เชิญสมาชิก' },
      { key: 'TEAM_EDIT', label: 'จัดการสมาชิก' },
      { key: 'TEAM_REMOVE', label: 'ลบสมาชิก' },
    ],
  },
  pos: {
    label: 'POS',
    permissions: [
      { key: 'POS_ACCESS', label: 'เข้าถึง POS' },
    ],
  },
  shipments: {
    label: 'การจัดส่ง',
    permissions: [
      { key: 'SHIPMENT_VIEW', label: 'ดูรายการจัดส่ง' },
      { key: 'SHIPMENT_CREATE', label: 'สร้างรายการจัดส่ง' },
      { key: 'SHIPMENT_EDIT', label: 'แก้ไขรายการจัดส่ง' },
      { key: 'SHIPMENT_CANCEL', label: 'ยกเลิกรายการจัดส่ง' },
    ],
  },
  payments: {
    label: 'การชำระเงิน',
    permissions: [
      { key: 'PAYMENT_VERIFY', label: 'ตรวจสอบหลักฐานการชำระเงิน' },
    ],
  },
  returns: {
    label: 'การคืนสินค้า',
    permissions: [
      { key: 'RETURN_VIEW', label: 'ดูรายการคืนสินค้า' },
      { key: 'RETURN_CREATE', label: 'สร้างรายการคืนสินค้า' },
    ],
  },
  deliveries: {
    label: 'ใบส่งสินค้า',
    permissions: [
      { key: 'DELIVERY_VIEW', label: 'ดูใบส่งสินค้า' },
      { key: 'DELIVERY_VALIDATE', label: 'ตรวจสอบใบส่งสินค้า' },
    ],
  },
} as const;

export type PermissionPresetKey = keyof typeof PERMISSION_PRESETS;
