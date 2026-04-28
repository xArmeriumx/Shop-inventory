/**
 * ERP-Namfon: Cache Tag Registry (SSOT)
 * centralizes all revalidation tags to prevent typos and ensure consistency.
 */

export const INVENTORY_TAGS = {
  LIST: 'products:list',
  DETAIL: (id: string) => `product:detail:${id}`,
  STOCK: (id: string) => `product:stock:${id}`,
  SELECT: 'products:select',
  LOW_STOCK: 'products:low-stock',
  WAREHOUSE: {
    LIST: 'warehouses:list',
    DETAIL: (id: string) => `warehouse:detail:${id}`,
  },
  STOCK_TAKE: {
    LIST: 'stock-takes:list',
    DETAIL: (id: string) => `stock-take:detail:${id}`,
  }
} as const;

export const SALES_TAGS = {
  LIST: 'sales:list',
  DETAIL: (id: string) => `sale:detail:${id}`,
  DASHBOARD: 'sales:dashboard',
} as const;

export const PURCHASE_TAGS = {
  LIST: 'purchases:list',
  REQUESTS: 'purchases:requests',
  ORDERS: 'purchases:orders',
  DETAIL: (id: string) => `purchase:detail:${id}`,
} as const;

export const ACCOUNTING_TAGS = {
  INCOME: 'accounting:income',
  EXPENSE: 'accounting:expense',
  JOURNAL: 'accounting:journal',
  PERIODS: 'accounting:periods',
} as const;

export const INVOICE_TAGS = {
  LIST: 'invoices:list',
  DETAIL: (id: string) => `invoice:detail:${id}`,
  STATS: 'invoices:stats',
} as const;

export const LOGISTICS_TAGS = {
  SHIPMENT: {
    LIST: 'shipments:list',
    DETAIL: (id: string) => `shipment:detail:${id}`,
  },
  DELIVERY: {
    LIST: 'deliveries:list',
    DETAIL: (id: string) => `delivery:detail:${id}`,
  }
} as const;

export const RETURNS_TAGS = {
  LIST: 'returns:list',
  DETAIL: (id: string) => `return:detail:${id}`,
} as const;

export const QUOTATION_TAGS = {
  LIST: 'quotations:list',
  DETAIL: (id: string) => `quotation:detail:${id}`,
} as const;

export const CUSTOMER_TAGS = {
  LIST: 'customers:list',
  DETAIL: (id: string) => `customer:detail:${id}`,
} as const;

export const ORDER_REQUEST_TAGS = {
  LIST: 'order-requests:list',
  DETAIL: (id: string) => `order-request:detail:${id}`,
} as const;

export const TAX_TAGS = {
  PURCHASE_TAX: {
    LIST: 'tax:purchase-tax:list',
    DETAIL: (id: string) => `tax:purchase-tax:detail:${id}`,
  },
  WHT: {
    LIST: 'tax:wht:list',
    DETAIL: (id: string) => `tax:wht:detail:${id}`,
  },
  VAT: {
    LIST: 'tax:vat:list',
    SUMMARY: 'tax:vat:summary',
  },
  SETTINGS: 'tax:settings',
} as const;
