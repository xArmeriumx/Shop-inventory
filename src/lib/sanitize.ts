/**
 * Input Sanitization Utilities
 * 
 * ป้องกัน XSS (Cross-Site Scripting) attacks
 * 
 * @example
 * // ใน Zod schema
 * z.string().transform(sanitizeText)
 * 
 * // ใน component (ปกติไม่จำเป็น เพราะ React escape ให้อัตโนมัติ)
 * <div>{sanitizeText(unsafeInput)}</div>
 */

/**
 * Sanitize text input by escaping HTML entities
 * ใช้สำหรับ text fields ทั่วไป (name, description, notes, etc.)
 */
export function sanitizeText(input: string): string {
  if (!input) return input;
  
  return input
    .replace(/&/g, '&amp;')   // Must be first
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

/**
 * Strict sanitization - only allows alphanumeric, Thai, and basic punctuation
 * ใช้สำหรับ fields ที่ต้องการความปลอดภัยสูง (SKU, codes, etc.)
 */
export function sanitizeStrict(input: string): string {
  if (!input) return input;
  
  // Allow: A-Z, a-z, 0-9, Thai characters (U+0E00-U+0E7F), spaces, and basic punctuation
  return input.replace(/[^A-Za-z0-9\u0E00-\u0E7F\s\-_.@]/g, '');
}

/**
 * Sanitize and validate URL
 * ใช้สำหรับ fields ที่รับ URL (images, links, etc.)
 */
export function sanitizeUrl(input: string): string | null {
  if (!input) return null;
  
  const trimmed = input.trim();
  
  // Only allow http, https, and data URLs for images
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/')
  ) {
    // Additional check: no javascript in URL
    if (trimmed.toLowerCase().includes('javascript:')) {
      return null;
    }
    return trimmed;
  }
  
  return null;
}

/**
 * Create a Zod transform function for text sanitization
 * Preserves null/undefined handling
 */
export function createSanitizeTransform() {
  return (val: string | null | undefined) => {
    if (val === null || val === undefined) return val;
    return sanitizeText(val);
  };
}
