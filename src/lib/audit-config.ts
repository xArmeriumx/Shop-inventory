import { format } from 'date-fns';
import { th } from 'date-fns/locale';

/**
 * Fields to quietly ignore during visual diffing to reduce noise.
 */
export const AUDIT_IGNORE_FIELDS = new Set([
  'updatedAt',
  'createdAt',
  'lastSeenAt',
  'version',
  'sessionVersion',
  'snapshotId',
  'password',
  'salt',
  'token',
]);

/**
 * Preferred order for field display in diffs. 
 * Fields not listed here will be sorted alphabetically after these.
 */
export const AUDIT_FIELD_ORDER = [
  'id',
  'status',
  'state',
  'action',
  'name',
  'email',
  'customerName',
  'saleNumber',
  'price',
  'salePrice',
  'costPrice',
  'qty',
  'onHandQty',
  'reservedQty',
  'availableQty',
  'total',
  'totalAmount',
  'subtotal',
  'roleId',
  'departmentCode',
];

/**
 * Map of raw code identifiers to Human-Readable UI names.
 */
export const AUDIT_FIELD_LABEL_MAP: Record<string, string> = {
  // Common / Identity
  'id': 'ID',
  'name': 'Name',
  'email': 'Email',
  'phone': 'Phone',
  'roleId': 'Role / Permission',
  'departmentCode': 'Department',
  'status': 'Status',
  'state': 'State',

  // Sales
  'saleNumber': 'Sale Document No.',
  'customerId': 'Customer ID',
  'totalAmount': 'Total Amount',
  'paymentMethod': 'Payment Method',
  'salePrice': 'Sale Price',
  'costPrice': 'Cost Price',
  'qty': 'Quantity',

  // Inventory / Product
  'onHandQty': 'On Hand Quantity',
  'reservedQty': 'Reserved Quantity',
  'availableQty': 'Available Quantity',
  'sku': 'SKU',
  'barcode': 'Barcode',
  'category': 'Category',
  
  // Shipping
  'trackingNumber': 'Tracking Number',
  'shippingProvider': 'Shipping Provider',
  'shippingCost': 'Shipping Cost',
};

/**
 * Helper to resolve the best Human-Readable label for a field key.
 * Handles nested arrays e.g., "lines[0].price" -> "Line 1 - price"
 */
export function getFieldLabel(keyPath: string): { label: string; tooltip: string } {
  const parts = keyPath.split(/[.[\]]+/).filter(Boolean);
  const lastPart = parts[parts.length - 1] || keyPath;
  
  let readableLabel = AUDIT_FIELD_LABEL_MAP[lastPart];

  // If it's a nested array line (e.g., lines.0.price or lines[0].price)
  if (parts.length > 2 && !isNaN(Number(parts[parts.length - 2]))) {
    const arrKey = parts[parts.length - 3] || 'Item';
    const index = parseInt(parts[parts.length - 2], 10) + 1;
    readableLabel = `${arrKey} ${index} - ${readableLabel || lastPart}`;
  } else if (!readableLabel) {
    readableLabel = lastPart; // Fallback to raw code name
  }

  return {
    label: readableLabel,
    tooltip: keyPath, // The raw path string for debugging/tracing
  };
}

/**
 * Formats a raw value into a UI-friendly string representation.
 */
export function formatAuditValue(value: any): string {
  if (value === null || value === undefined) return '—';
  
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (typeof value === 'object') {
    return JSON.stringify(value); // Fallback for unflattened remaining objects
  }

  // Attempt to parse ISO Dates safely
  if (typeof value === 'string' && value.endsWith('Z') && value.includes('T') && value.length > 18) {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
         return format(d, 'dd MMM yyyy HH:mm:ss', { locale: th });
      }
    } catch {}
  }

  // Format Numbers
  if (typeof value === 'number') {
    // If it's a large whole number it might be an ID or timestamp, but standard formatting is generally safe.
    // We avoid decimal places unless they exist natively
    return new Intl.NumberFormat('th-TH').format(value);
  }

  return String(value);
}
