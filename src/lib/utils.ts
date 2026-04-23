import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'THB', locale = 'th-TH') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string | number) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Deeply serializes data to be safe for Client Components.
 * Converts Prisma Decimal, BigInt, and ensures plain objects.
 */
export function serialize<T>(data: T): T {
  if (data === null || data === undefined) return data;

  return JSON.parse(JSON.stringify(data, (key, value) => {
    // Handle Decimal objects from Prisma
    if (value && typeof value === 'object' && (value.d || value.constructor?.name === 'Decimal')) {
      return Number(value);
    }
    // Handle BigInt
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return value;
  }));
}

