import { describe, it, expect, test } from 'vitest';
import { money, toNumber, calcSubtotal, calcProfit, accumulate } from '@/lib/money';

/**
 * Comprehensive tests for money.ts
 * 
 * Tests cover:
 * 1. Basic arithmetic operations (add, subtract, multiply, divide)
 * 2. Floating-point precision issues
 * 3. Array operations (sum, sumArray)
 * 4. Rounding and formatting
 * 5. Comparison operations
 * 6. Edge cases (null, undefined, strings, large numbers)
 * 7. Helper functions (toNumber, calcSubtotal, calcProfit, accumulate)
 */

describe('money utility', () => {
  // =============================================================================
  // ADDITION TESTS
  // =============================================================================
  describe('money.add', () => {
    it('should add two integers correctly', () => {
      expect(money.add(100, 200)).toBe(300);
    });

    it('should add decimals correctly', () => {
      expect(money.add(10.50, 20.75)).toBe(31.25);
    });

    it('should handle the infamous 0.1 + 0.2 floating-point issue', () => {
      // JavaScript: 0.1 + 0.2 = 0.30000000000000004
      expect(money.add(0.1, 0.2)).toBe(0.3);
    });

    it('should handle 19.99 + 0.01 correctly', () => {
      expect(money.add(19.99, 0.01)).toBe(20);
    });

    it('should add negative numbers', () => {
      expect(money.add(100, -30)).toBe(70);
    });

    it('should add zero correctly', () => {
      expect(money.add(100, 0)).toBe(100);
      expect(money.add(0, 100)).toBe(100);
      expect(money.add(0, 0)).toBe(0);
    });

    it('should handle very small decimals', () => {
      expect(money.add(0.001, 0.002)).toBe(0.003);
    });

    it('should handle large numbers', () => {
      expect(money.add(999999999.99, 0.01)).toBe(1000000000);
    });
  });

  // =============================================================================
  // SUBTRACTION TESTS
  // =============================================================================
  describe('money.subtract', () => {
    it('should subtract two integers correctly', () => {
      expect(money.subtract(300, 100)).toBe(200);
    });

    it('should subtract decimals correctly', () => {
      expect(money.subtract(100.50, 30.25)).toBe(70.25);
    });

    it('should handle floating-point precision', () => {
      // JavaScript: 100.10 - 50.05 = 50.04999999999999
      expect(money.subtract(100.10, 50.05)).toBe(50.05);
    });

    it('should handle 1 - 0.9 correctly', () => {
      expect(money.subtract(1, 0.9)).toBe(0.1);
    });

    it('should handle negative results', () => {
      expect(money.subtract(50, 100)).toBe(-50);
    });

    it('should subtract zero correctly', () => {
      expect(money.subtract(100, 0)).toBe(100);
    });

    it('should handle subtracting from zero', () => {
      expect(money.subtract(0, 100)).toBe(-100);
    });
  });

  // =============================================================================
  // MULTIPLICATION TESTS
  // =============================================================================
  describe('money.multiply', () => {
    it('should multiply two integers correctly', () => {
      expect(money.multiply(10, 5)).toBe(50);
    });

    it('should multiply decimals correctly', () => {
      expect(money.multiply(10.5, 2)).toBe(21);
    });

    it('should handle 19.99 × 3 correctly (common retail scenario)', () => {
      // JavaScript: 19.99 * 3 = 59.970000000000006
      expect(money.multiply(19.99, 3)).toBe(59.97);
    });

    it('should handle 0.1 × 0.2 correctly', () => {
      expect(money.multiply(0.1, 0.2)).toBe(0.02);
    });

    it('should handle tax calculations (price × 1.07)', () => {
      expect(money.multiply(100, 1.07)).toBe(107);
    });

    it('should handle discount calculations (price × 0.9)', () => {
      expect(money.multiply(199.99, 0.9)).toBe(179.991);
    });

    it('should multiply by zero', () => {
      expect(money.multiply(100, 0)).toBe(0);
      expect(money.multiply(0, 100)).toBe(0);
    });

    it('should multiply by one', () => {
      expect(money.multiply(100, 1)).toBe(100);
    });

    it('should handle negative multipliers', () => {
      expect(money.multiply(100, -1)).toBe(-100);
    });

    it('should handle quantity × price scenarios', () => {
      // Common POS calculation: 5 items at 149.99 each
      expect(money.multiply(5, 149.99)).toBe(749.95);
    });
  });

  // =============================================================================
  // DIVISION TESTS
  // =============================================================================
  describe('money.divide', () => {
    it('should divide two integers correctly', () => {
      expect(money.divide(100, 2)).toBe(50);
    });

    it('should divide with decimal result', () => {
      expect(money.divide(100, 3)).toBeCloseTo(33.333333333333336, 10);
    });

    it('should handle 0.3 / 0.1 correctly', () => {
      expect(money.divide(0.3, 0.1)).toBe(3);
    });

    it('should handle splitting bills', () => {
      // 999.99 split 3 ways
      expect(money.divide(999.99, 3)).toBeCloseTo(333.33, 2);
    });

    it('should divide by one', () => {
      expect(money.divide(100, 1)).toBe(100);
    });

    it('should handle zero as numerator', () => {
      expect(money.divide(0, 100)).toBe(0);
    });

    it('should handle percentages', () => {
      // 10% of 199.99
      expect(money.divide(199.99, 10)).toBe(19.999);
    });
  });

  // =============================================================================
  // SUM TESTS
  // =============================================================================
  describe('money.sum', () => {
    it('should sum multiple numbers', () => {
      expect(money.sum(10, 20, 30)).toBe(60);
    });

    it('should sum with floating-point precision', () => {
      expect(money.sum(0.1, 0.2, 0.3)).toBe(0.6);
    });

    it('should handle single number', () => {
      expect(money.sum(100)).toBe(100);
    });

    it('should handle empty arguments', () => {
      expect(money.sum()).toBe(0);
    });

    it('should sum many small decimals', () => {
      expect(money.sum(0.01, 0.01, 0.01, 0.01, 0.01)).toBe(0.05);
    });
  });

  describe('money.sumArray', () => {
    it('should sum an array of numbers', () => {
      expect(money.sumArray([10, 20, 30, 40])).toBe(100);
    });

    it('should handle floating-point precision in array', () => {
      expect(money.sumArray([0.1, 0.2, 0.3, 0.4])).toBe(1);
    });

    it('should handle empty array', () => {
      expect(money.sumArray([])).toBe(0);
    });

    it('should handle single element array', () => {
      expect(money.sumArray([99.99])).toBe(99.99);
    });

    it('should sum cart item subtotals (real scenario)', () => {
      const subtotals = [199.99, 49.50, 299.99, 15.00];
      expect(money.sumArray(subtotals)).toBe(564.48);
    });
  });

  // =============================================================================
  // ROUNDING TESTS
  // =============================================================================
  describe('money.round', () => {
    it('should round to 2 decimal places by default', () => {
      expect(money.round(10.555)).toBe(10.56);
      expect(money.round(10.554)).toBe(10.55);
    });

    it('should round up on 0.5', () => {
      expect(money.round(10.505)).toBe(10.51);
    });

    it('should handle already rounded values', () => {
      expect(money.round(10.50)).toBe(10.5);
    });

    it('should handle integers', () => {
      expect(money.round(100)).toBe(100);
    });

    it('should round to custom decimal places', () => {
      expect(money.round(10.5555, 3)).toBe(10.556);
      expect(money.round(10.5555, 1)).toBe(10.6);
      expect(money.round(10.5555, 0)).toBe(11);
    });

    it('should handle negative numbers', () => {
      // ROUND_HALF_UP rounds -10.555 to -10.56 (away from zero)
      expect(money.round(-10.555)).toBe(-10.56);
    });
  });

  // =============================================================================
  // FORMAT TESTS
  // =============================================================================
  describe('money.format', () => {
    it('should format integer as currency', () => {
      expect(money.format(1000)).toBe('1,000.00');
    });

    it('should format decimal as currency', () => {
      expect(money.format(1234.56)).toBe('1,234.56');
    });

    it('should format zero', () => {
      expect(money.format(0)).toBe('0.00');
    });

    it('should format large numbers with commas', () => {
      expect(money.format(1000000.99)).toBe('1,000,000.99');
    });

    it('should handle single decimal', () => {
      expect(money.format(100.5)).toBe('100.50');
    });
  });

  // =============================================================================
  // COMPARISON TESTS
  // =============================================================================
  describe('money.isEqual', () => {
    it('should compare equal integers', () => {
      expect(money.isEqual(100, 100)).toBe(true);
    });

    it('should compare equal decimals', () => {
      expect(money.isEqual(10.55, 10.55)).toBe(true);
    });

    it('should handle floating-point comparison', () => {
      // JavaScript: 0.1 + 0.2 !== 0.3
      const result = money.add(0.1, 0.2);
      expect(money.isEqual(result, 0.3)).toBe(true);
    });

    it('should detect unequal values', () => {
      expect(money.isEqual(100, 101)).toBe(false);
      expect(money.isEqual(10.55, 10.56)).toBe(false);
    });
  });

  describe('money.isGreaterThan', () => {
    it('should compare greater integers', () => {
      expect(money.isGreaterThan(100, 50)).toBe(true);
      expect(money.isGreaterThan(50, 100)).toBe(false);
    });

    it('should compare equal values', () => {
      expect(money.isGreaterThan(100, 100)).toBe(false);
    });

    it('should compare decimals', () => {
      expect(money.isGreaterThan(10.56, 10.55)).toBe(true);
    });
  });

  describe('money.isLessThan', () => {
    it('should compare less than integers', () => {
      expect(money.isLessThan(50, 100)).toBe(true);
      expect(money.isLessThan(100, 50)).toBe(false);
    });

    it('should compare equal values', () => {
      expect(money.isLessThan(100, 100)).toBe(false);
    });
  });

  describe('money.isGreaterOrEqual', () => {
    it('should handle greater than', () => {
      expect(money.isGreaterOrEqual(100, 50)).toBe(true);
    });

    it('should handle equal', () => {
      expect(money.isGreaterOrEqual(100, 100)).toBe(true);
    });

    it('should handle less than', () => {
      expect(money.isGreaterOrEqual(50, 100)).toBe(false);
    });
  });

  describe('money.isLessOrEqual', () => {
    it('should handle less than', () => {
      expect(money.isLessOrEqual(50, 100)).toBe(true);
    });

    it('should handle equal', () => {
      expect(money.isLessOrEqual(100, 100)).toBe(true);
    });

    it('should handle greater than', () => {
      expect(money.isLessOrEqual(100, 50)).toBe(false);
    });
  });
});

// =============================================================================
// toNumber TESTS
// =============================================================================
describe('toNumber helper', () => {
  it('should convert number to number', () => {
    expect(toNumber(100)).toBe(100);
    expect(toNumber(10.55)).toBe(10.55);
  });

  it('should convert string to number', () => {
    expect(toNumber('100')).toBe(100);
    expect(toNumber('10.55')).toBe(10.55);
  });

  it('should handle null', () => {
    expect(toNumber(null)).toBe(0);
  });

  it('should handle undefined', () => {
    expect(toNumber(undefined)).toBe(0);
  });

  it('should handle Prisma Decimal-like object with toString', () => {
    const prismaDecimal = { toString: () => '199.99' };
    expect(toNumber(prismaDecimal)).toBe(199.99);
  });

  it('should handle zero string', () => {
    expect(toNumber('0')).toBe(0);
  });

  it('should handle empty string by returning 0', () => {
    expect(toNumber('')).toBe(0);
  });

  it('should handle invalid string by returning 0', () => {
    expect(toNumber('invalid')).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(toNumber(-100)).toBe(-100);
    expect(toNumber('-100')).toBe(-100);
  });

  it('should handle very large numbers', () => {
    expect(toNumber('9999999999.99')).toBe(9999999999.99);
  });
});

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================
describe('calcSubtotal helper', () => {
  it('should calculate quantity × price', () => {
    expect(calcSubtotal(3, 19.99)).toBe(59.97);
  });

  it('should handle single item', () => {
    expect(calcSubtotal(1, 199.99)).toBe(199.99);
  });

  it('should handle zero quantity', () => {
    expect(calcSubtotal(0, 199.99)).toBe(0);
  });

  it('should handle large quantities', () => {
    expect(calcSubtotal(100, 9.99)).toBe(999);
  });

  it('should handle penny amounts', () => {
    expect(calcSubtotal(7, 0.01)).toBe(0.07);
  });
});

describe('calcProfit helper', () => {
  it('should calculate revenue - cost', () => {
    expect(calcProfit(100, 60)).toBe(40);
  });

  it('should handle decimal profit', () => {
    expect(calcProfit(199.99, 120.50)).toBe(79.49);
  });

  it('should handle zero profit', () => {
    expect(calcProfit(100, 100)).toBe(0);
  });

  it('should handle negative profit (loss)', () => {
    expect(calcProfit(100, 150)).toBe(-50);
  });

  it('should handle floating-point precision', () => {
    expect(calcProfit(100.10, 50.05)).toBe(50.05);
  });
});

describe('accumulate helper', () => {
  it('should add value to sum', () => {
    expect(accumulate(100, 50)).toBe(150);
  });

  it('should work in reduce pattern', () => {
    const values = [10, 20, 30, 40];
    const result = values.reduce(accumulate, 0);
    expect(result).toBe(100);
  });

  it('should handle floating-point in reduce', () => {
    const values = [0.1, 0.2, 0.3];
    const result = values.reduce(accumulate, 0);
    expect(result).toBe(0.6);
  });
});

// =============================================================================
// REAL-WORLD SCENARIO TESTS
// =============================================================================
describe('Real-world POS scenarios', () => {
  it('should calculate cart total correctly', () => {
    const cartItems = [
      { quantity: 2, price: 199.99 },
      { quantity: 3, price: 49.99 },
      { quantity: 1, price: 999.99 },
    ];

    let total = 0;
    for (const item of cartItems) {
      const subtotal = calcSubtotal(item.quantity, item.price);
      total = money.add(total, subtotal);
    }

    // 2×199.99 + 3×49.99 + 1×999.99 = 399.98 + 149.97 + 999.99 = 1549.94
    expect(total).toBe(1549.94);
  });

  it('should calculate profit margin correctly', () => {
    const revenue = 1549.94;
    const cost = 1000;
    const profit = calcProfit(revenue, cost);
    expect(profit).toBe(549.94);
  });

  it('should handle tax calculation correctly', () => {
    const subtotal = 999.99;
    const taxRate = 0.07; // 7% VAT
    const tax = money.multiply(subtotal, taxRate);
    const total = money.add(subtotal, tax);
    
    expect(tax).toBe(69.9993);
    expect(total).toBe(1069.9893);
  });

  it('should handle discount correctly', () => {
    const originalPrice = 299.99;
    const discountPercent = 0.15; // 15% off
    const discount = money.multiply(originalPrice, discountPercent);
    const finalPrice = money.subtract(originalPrice, discount);
    
    // 299.99 × 0.15 = 44.9985
    // 299.99 - 44.9985 = 254.9915
    expect(discount).toBe(44.9985);
    expect(finalPrice).toBe(254.9915);
  });

  it('should handle daily sales accumulation', () => {
    const dailySales = [
      1234.56,
      987.65,
      2345.67,
      567.89,
      3456.78,
    ];

    const total = money.sumArray(dailySales);
    expect(total).toBe(8592.55);
  });
});
