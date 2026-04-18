/**
 * Central Data Normalizers
 * Helper functions to clean and normalize data before validation.
 */

// Strip non-numeric characters for Phone, Tax ID, etc.
export function normalizeNumericString(input: string | null | undefined): string | null {
    if (!input) return null;
    const stripped = input.replace(/[^0-9]/g, '');
    return stripped || null;
}

export function normalizePhone(input: string | null | undefined): string | null {
    return normalizeNumericString(input);
}

export function normalizeTaxId(input: string | null | undefined): string | null {
    return normalizeNumericString(input);
}

export function normalizePostalCode(input: string | null | undefined): string | null {
    return normalizeNumericString(input);
}

// Uppercase and trim SKU
export function normalizeSku(input: string | null | undefined): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    return trimmed.toUpperCase();
}

// Convert empty string to null, lowercase email
export function normalizeEmail(input: string | null | undefined): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    return trimmed.toLowerCase();
}

// Trim whitespace and collapse multiple spaces (optional, depends on use case)
export function normalizeWhitespace(input: string | null | undefined): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    return trimmed;
}
