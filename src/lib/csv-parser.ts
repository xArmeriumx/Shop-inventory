/**
 * CSV Parser — Reusable utility for parsing CSV files
 * Supports Thai/English header auto-mapping and validation
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CSVRow {
  [key: string]: string;
}

export interface ParsedProduct {
  name: string;
  sku: string | null;
  category: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  _rowNumber: number;      // Original row number for error reporting
  _errors: string[];       // Validation errors for this row
  _isValid: boolean;
}

export interface ParsedCSVResult {
  headers: string[];
  products: ParsedProduct[];
  validCount: number;
  errorCount: number;
  totalRows: number;
}

// =============================================================================
// HEADER MAPPING (Thai ↔ English)
// =============================================================================

const HEADER_MAP: Record<string, string> = {
  // Thai → internal field name
  'ชื่อสินค้า': 'name',
  'ชื่อ': 'name',
  'สินค้า': 'name',
  'รหัสสินค้า': 'sku',
  'รหัส': 'sku',
  'หมวดหมู่': 'category',
  'ประเภท': 'category',
  'ราคาทุน': 'costPrice',
  'ต้นทุน': 'costPrice',
  'ราคาขาย': 'salePrice',
  'สต็อก': 'stock',
  'จำนวน': 'stock',
  'คงเหลือ': 'stock',
  'สต็อกขั้นต่ำ': 'minStock',
  'ขั้นต่ำ': 'minStock',
  // English → internal field name
  'name': 'name',
  'product': 'name',
  'productname': 'name',
  'product name': 'name',
  'sku': 'sku',
  'code': 'sku',
  'productcode': 'sku',
  'category': 'category',
  'type': 'category',
  'costprice': 'costPrice',
  'cost': 'costPrice',
  'cost price': 'costPrice',
  'saleprice': 'salePrice',
  'price': 'salePrice',
  'selling price': 'salePrice',
  'sale price': 'salePrice',
  'sellingprice': 'salePrice',
  'stock': 'stock',
  'quantity': 'stock',
  'qty': 'stock',
  'minstock': 'minStock',
  'min stock': 'minStock',
  'minimum stock': 'minStock',
  'reorder level': 'minStock',
};

const VALID_CATEGORIES = ['EBIKE', 'PARTS', 'ACCESSORIES', 'SERVICE', 'OTHER'];

// =============================================================================
// PARSER
// =============================================================================

/**
 * Parse a CSV file into structured product data with validation.
 */
export async function parseCSVFile(file: File): Promise<ParsedCSVResult> {
  const text = await file.text();
  return parseCSVText(text);
}

export function parseCSVText(text: string): ParsedCSVResult {
  // Handle BOM
  const clean = text.replace(/^\uFEFF/, '');
  
  const lines = clean.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    return {
      headers: [],
      products: [],
      validCount: 0,
      errorCount: 0,
      totalRows: 0,
    };
  }

  // Parse header row
  const rawHeaders = parseCSVLine(lines[0]);
  const mappedFields = rawHeaders.map(h => {
    const normalized = h.trim().toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
    return HEADER_MAP[normalized] || HEADER_MAP[h.trim()] || null;
  });

  // Check required headers exist
  const hasName = mappedFields.includes('name');
  const hasCategory = mappedFields.includes('category');
  const hasCostPrice = mappedFields.includes('costPrice');
  const hasSalePrice = mappedFields.includes('salePrice');

  // Parse data rows
  const products: ParsedProduct[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.every(v => v.trim() === '')) continue; // skip empty rows

    const row: Record<string, string> = {};
    mappedFields.forEach((field, idx) => {
      if (field && values[idx] !== undefined) {
        row[field] = values[idx].trim();
      }
    });

    const errors: string[] = [];

    // Validate required fields
    if (!hasName || !row.name) {
      errors.push('ไม่มีชื่อสินค้า');
    }
    if (!hasCategory || !row.category) {
      errors.push('ไม่มีหมวดหมู่');
    }
    if (!hasCostPrice && !row.costPrice) {
      errors.push('ไม่มีราคาทุน');
    }
    if (!hasSalePrice && !row.salePrice) {
      errors.push('ไม่มีราคาขาย');
    }

    // Validate category value
    const category = row.category?.toUpperCase() || '';
    if (row.category && !VALID_CATEGORIES.includes(category)) {
      errors.push(`หมวดหมู่ไม่ถูกต้อง: "${row.category}" (ใช้: ${VALID_CATEGORIES.join(', ')})`);
    }

    // Parse numbers
    const costPrice = parseFloat(row.costPrice || '0');
    const salePrice = parseFloat(row.salePrice || '0');
    const stock = parseInt(row.stock || '0', 10);
    const minStock = parseInt(row.minStock || '5', 10);

    if (row.costPrice && isNaN(costPrice)) {
      errors.push('ราคาทุนไม่ใช่ตัวเลข');
    }
    if (row.salePrice && isNaN(salePrice)) {
      errors.push('ราคาขายไม่ใช่ตัวเลข');
    }
    if (costPrice < 0) errors.push('ราคาทุนต้องไม่ติดลบ');
    if (salePrice < 0) errors.push('ราคาขายต้องไม่ติดลบ');
    if (stock < 0) errors.push('สต็อกต้องไม่ติดลบ');

    products.push({
      name: row.name || '',
      sku: row.sku || null,
      category: VALID_CATEGORIES.includes(category) ? category : '',
      costPrice: isNaN(costPrice) ? 0 : costPrice,
      salePrice: isNaN(salePrice) ? 0 : salePrice,
      stock: isNaN(stock) ? 0 : stock,
      minStock: isNaN(minStock) ? 5 : minStock,
      _rowNumber: i + 1,
      _errors: errors,
      _isValid: errors.length === 0,
    });
  }

  return {
    headers: rawHeaders,
    products,
    validCount: products.filter(p => p._isValid).length,
    errorCount: products.filter(p => !p._isValid).length,
    totalRows: products.length,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse a single CSV line handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}
