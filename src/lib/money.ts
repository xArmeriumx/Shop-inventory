import Decimal from 'decimal.js';

/**
 * Configure Decimal.js for financial calculations
 * - precision: 20 digits (safe for large Thai Baht amounts)
 * - rounding: HALF_UP (standard financial rounding)
 */
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP 
});

/**
 * Money calculation utilities with precision handling
 * 
 * ป้องกัน JavaScript floating-point bugs:
 * - 0.1 + 0.2 = 0.30000000000000004 ❌
 * - money.add(0.1, 0.2) = 0.3 ✅
 * 
 * @example
 * ```ts
 * import { money, toNumber } from '@/lib/money';
 * 
 * const subtotal = money.multiply(19.99, 3);     // 59.97
 * const profit = money.subtract(100, 30.5);      // 69.5
 * const total = money.add(subtotal, profit);     // 129.47
 * const dbValue = toNumber(prismaDecimalField);  // safe conversion
 * ```
 */
export const money = {
  /**
   * Add two numbers with precision
   */
  add: (a: number, b: number): number => 
    new Decimal(a).plus(b).toNumber(),
  
  /**
   * Subtract b from a with precision
   */
  subtract: (a: number, b: number): number => 
    new Decimal(a).minus(b).toNumber(),
  
  /**
   * Multiply two numbers with precision
   */
  multiply: (a: number, b: number): number => 
    new Decimal(a).times(b).toNumber(),
  
  /**
   * Divide a by b with precision
   */
  divide: (a: number, b: number): number => 
    new Decimal(a).dividedBy(b).toNumber(),
  
  /**
   * Sum multiple numbers with precision
   */
  sum: (...values: number[]): number => 
    values.reduce((acc, val) => acc.plus(val), new Decimal(0)).toNumber(),
  
  /**
   * Sum an array of numbers with precision
   */
  sumArray: (arr: number[]): number => 
    arr.reduce((acc, val) => acc.plus(val), new Decimal(0)).toNumber(),
  
  /**
   * Round to specified decimal places (default: 2)
   */
  round: (value: number, decimals: number = 2): number => 
    new Decimal(value).toDecimalPlaces(decimals).toNumber(),
  
  /**
   * Format number for Thai Baht display
   */
  format: (value: number): string =>
    new Intl.NumberFormat('th-TH', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(value),
  
  /**
   * Check if two numbers are equal (handles floating point comparison)
   */
  isEqual: (a: number, b: number): boolean =>
    new Decimal(a).equals(b),
  
  /**
   * Check if a > b
   */
  isGreaterThan: (a: number, b: number): boolean =>
    new Decimal(a).greaterThan(b),
  
  /**
   * Check if a < b
   */
  isLessThan: (a: number, b: number): boolean =>
    new Decimal(a).lessThan(b),
  
  /**
   * Check if a >= b
   */
  isGreaterOrEqual: (a: number, b: number): boolean =>
    new Decimal(a).greaterThanOrEqualTo(b),
  
  /**
   * Check if a <= b
   */
  isLessOrEqual: (a: number, b: number): boolean =>
    new Decimal(a).lessThanOrEqualTo(b),
};

/**
 * Safely convert any value to number (handles Prisma Decimal, null, undefined)
 * 
 * @param value - Prisma Decimal, number, string, null, or undefined
 * @returns number (0 if input is null/undefined)
 * 
 * @example
 * ```ts
 * const salePrice = toNumber(product.salePrice);  // Prisma Decimal -> number
 * const amount = toNumber(null);  // 0
 * ```
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  try {
    return new Decimal(String(value)).toNumber();
  } catch {
    return 0;
  }
}

/**
 * Calculate subtotal with precision (quantity × price)
 */
export function calcSubtotal(quantity: number, price: number): number {
  return money.multiply(quantity, price);
}

/**
 * Calculate profit with precision (revenue - cost)
 */
export function calcProfit(revenue: number, cost: number): number {
  return money.subtract(revenue, cost);
}

/**
 * Accumulate running total with precision
 * Used in reduce operations
 */
export function accumulate(sum: number, value: number): number {
  return money.add(sum, value);
}
