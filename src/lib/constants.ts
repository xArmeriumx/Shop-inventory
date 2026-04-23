export const APP_NAME = 'Shop Inventory';

export const DB_TIMEOUTS = {
  DEFAULT: 5000,
  EXTENDED: 30000,
  LONG: 60000,
} as const;

export const PAGINATION_CONFIG = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Legacy aliases for compatibility
export const ITEMS_PER_PAGE = PAGINATION_CONFIG.DEFAULT_LIMIT;
export const MAX_ITEMS_PER_PAGE = PAGINATION_CONFIG.MAX_LIMIT;

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'เงินสด' },
  { value: 'TRANSFER', label: 'โอนเงิน' },
  { value: 'CREDIT', label: 'เครดิต/ผ่อน' },
] as const;

export const PRODUCT_CATEGORIES = [
  { value: 'EBIKE', label: 'มอเตอร์ไซค์ไฟฟ้า' },
  { value: 'PARTS', label: 'อะไหล่' },
  { value: 'ACCESSORIES', label: 'อุปกรณ์เสริม' },
  { value: 'SERVICE', label: 'บริการ' },
  { value: 'OTHER', label: 'อื่นๆ' },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: 'RENT', label: 'ค่าเช่า' },
  { value: 'UTILITIES', label: 'ค่าไฟ/น้ำ/เน็ต' },
  { value: 'SALARY', label: 'เงินเดือน' },
  { value: 'PARTS_PURCHASE', label: 'ซื้ออะไหล่' },
  { value: 'EQUIPMENT', label: 'อุปกรณ์/เครื่องมือ' },
  { value: 'MARKETING', label: 'โฆษณา/การตลาด' },
  { value: 'TRANSPORT', label: 'ค่าเดินทาง/ขนส่ง' },
  { value: 'OTHER', label: 'อื่นๆ' },
] as const;

export const SALES_CHANNELS = [
  { value: 'WALK_IN', label: 'หน้าร้าน' },
  { value: 'SHOPEE', label: 'Shopee' },
  { value: 'LAZADA', label: 'Lazada' },
  { value: 'LINE', label: 'LINE' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'OTHER', label: 'อื่นๆ' },
] as const;

export const SALES_STATUSES = [
  { value: 'ACTIVE', label: 'ปกติ' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]['value'];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['value'];
export type SalesChannel = (typeof SALES_CHANNELS)[number]['value'];
export type SalesStatus = (typeof SALES_STATUSES)[number]['value'];
