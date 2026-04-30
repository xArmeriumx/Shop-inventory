/**
 * Log Redaction Utility
 * Recursively masks sensitive fields (passwords, tokens, secrets, base64 strings)
 * to prevent PII and security credentials from leaking into application or audit logs.
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /private.?key/i,
  /api.?key/i,
  /service.?role.?key/i,
  /csrf/i,
  /jwt/i,
  /image.?base64/i,
  /base64/i
];

const SAFE_KEYS = new Set([
  'sessionversion',
  'permissionversion',
  'roleid',
  'isowner'
]);

const MASK_STRING = '***REDACTED***';

/**
 * Redacts tokens, API keys, and credentials found within arbitrary text/strings.
 */
export function redactString(value: string): string {
  if (!value) return value;
  return value
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1***REDACTED***')
    .replace(/((?:api[_-]?key|token|session[_-]?token|jwt|secret|password|cookie)\s*[:=]\s*)[^\s,;]+/gi, '$1***REDACTED***')
    .replace(/([?&](?:api[_-]?key|token|session[_-]?token|jwt|secret|password)=)[^&\s]+/gi, '$1***REDACTED***');
}

/**
 * Recursively redacts sensitive fields in an object or array.
 * @param obj The object to redact
 * @returns A new redacted object
 */
export function redact(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item));
  }

  // Handle Objects
  if (typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof Buffer)) {
    const redactedObj: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
      
      if (SAFE_KEYS.has(normalizedKey)) {
        redactedObj[key] = obj[key];
      } else if (SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key))) {
        redactedObj[key] = MASK_STRING;
      } else if (typeof obj[key] === 'string' && obj[key].length > 1000 && (normalizedKey.includes('image') || /^[A-Za-z0-9+/=]+$/.test(obj[key].replace(/^data:image\/[a-z]+;base64,/, '').substring(0, 100)))) {
        // Broad heuristic to catch base64 image strings or long base64 strings
        redactedObj[key] = `***REDACTED_LARGE_STRING(${obj[key].length} bytes)***`;
      } else {
        redactedObj[key] = redact(obj[key]);
      }
    }
    return redactedObj;
  }

  // Handle primitives (strings)
  if (typeof obj === 'string') {
    return redactString(obj);
  }

  // Return primitives directly
  return obj;
}
