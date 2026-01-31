/**
 * OCR Matcher Utilities
 * Smart matching for products and suppliers with fuzzy search
 */

export interface MatchResult<T> {
  item: T;
  score: number; // 0-100, higher = better match
  matchedBy: 'exact_sku' | 'exact_name' | 'fuzzy_name' | 'partial' | 'none';
}

export interface ScannedItem {
  name?: string;
  model?: string;
  code?: string;
  quantity?: number;
  unitPrice?: number;
}

/**
 * Generate unique product name by combining base name with model/code
 * Prevents name collisions when OCR returns same generic name for different products
 * 
 * @example
 * generateUniqueProductName({ name: "แบตเตอรี่", model: "JL-301X6" })
 * // Returns: "แบตเตอรี่ JL-301X6"
 */
export function generateUniqueProductName(item: ScannedItem): string {
  const baseName = item.name || 'สินค้า';
  const identifier = item.model || item.code || '';
  
  // If identifier exists and isn't already in the name, append it
  if (identifier && !baseName.includes(identifier)) {
    return `${baseName} ${identifier}`.trim();
  }
  
  return baseName;
}

export interface ProductForMatch {
  id: string;
  name: string;
  sku: string | null;
  costPrice: number;
}

export interface SupplierForMatch {
  id: string;
  name: string;
  code: string | null;
}

/**
 * Normalize string for comparison
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sก-๙]/g, ''); // Keep alphanumeric and Thai chars
}

/**
 * Calculate similarity score between two strings (0-100)
 */
function similarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);
  
  if (normA === normB) return 100;
  if (normA.includes(normB) || normB.includes(normA)) return 80;
  
  // Levenshtein-based similarity
  const longer = normA.length > normB.length ? normA : normB;
  const shorter = normA.length > normB.length ? normB : normA;
  
  if (longer.length === 0) return 100;
  
  const editDistance = levenshtein(normA, normB);
  const score = Math.round(((longer.length - editDistance) / longer.length) * 100);
  
  return Math.max(0, score);
}

/**
 * Levenshtein distance
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Match a scanned item to existing products
 */
export function matchProduct(
  scannedItem: ScannedItem,
  products: ProductForMatch[]
): MatchResult<ProductForMatch> | null {
  const candidates: MatchResult<ProductForMatch>[] = [];

  for (const product of products) {
    let score = 0;
    let matchedBy: MatchResult<ProductForMatch>['matchedBy'] = 'none';

    // Priority 1: Exact SKU match
    if (product.sku && (scannedItem.code || scannedItem.model)) {
      const skuNorm = normalize(product.sku);
      const codeNorm = scannedItem.code ? normalize(scannedItem.code) : '';
      const modelNorm = scannedItem.model ? normalize(scannedItem.model) : '';

      if (skuNorm === codeNorm || skuNorm === modelNorm) {
        score = 100;
        matchedBy = 'exact_sku';
      } else if (skuNorm.includes(codeNorm) || skuNorm.includes(modelNorm)) {
        score = 90;
        matchedBy = 'partial';
      }
    }

    // Priority 2: Name match
    if (score < 80 && scannedItem.name) {
      const nameSimilarity = similarity(product.name, scannedItem.name);
      if (nameSimilarity === 100) {
        score = Math.max(score, 95);
        matchedBy = 'exact_name';
      } else if (nameSimilarity >= 70) {
        score = Math.max(score, nameSimilarity);
        matchedBy = 'fuzzy_name';
      }
    }

    // Priority 3: Model in name
    if (score < 70 && scannedItem.model) {
      const modelInName = normalize(product.name).includes(normalize(scannedItem.model));
      if (modelInName) {
        score = Math.max(score, 75);
        matchedBy = 'partial';
      }
    }

    if (score >= 60) {
      candidates.push({ item: product, score, matchedBy });
    }
  }

  // Return best match
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

/**
 * Match vendor name to existing suppliers
 */
export function matchSupplier(
  vendorName: string,
  suppliers: SupplierForMatch[]
): MatchResult<SupplierForMatch> | null {
  const candidates: MatchResult<SupplierForMatch>[] = [];

  for (const supplier of suppliers) {
    let score = 0;
    let matchedBy: MatchResult<SupplierForMatch>['matchedBy'] = 'none';

    // Exact name match
    const nameSimilarity = similarity(supplier.name, vendorName);
    if (nameSimilarity === 100) {
      score = 100;
      matchedBy = 'exact_name';
    } else if (nameSimilarity >= 70) {
      score = nameSimilarity;
      matchedBy = 'fuzzy_name';
    }

    // Code match
    if (supplier.code) {
      const codeSimilarity = similarity(supplier.code, vendorName);
      if (codeSimilarity > score) {
        score = codeSimilarity;
        matchedBy = codeSimilarity === 100 ? 'exact_sku' : 'partial';
      }
    }

    if (score >= 60) {
      candidates.push({ item: supplier, score, matchedBy });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

/**
 * Batch match all scanned items to products
 */
export function matchAllProducts(
  scannedItems: ScannedItem[],
  products: ProductForMatch[]
): Array<{ scanned: ScannedItem; match: MatchResult<ProductForMatch> | null }> {
  return scannedItems.map((scanned) => ({
    scanned,
    match: matchProduct(scanned, products),
  }));
}
