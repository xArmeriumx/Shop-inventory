import { describe, it, expect } from 'vitest';
import { ComputationEngine } from './computation.service';

// ─────────────────────────────────────────────────────────────────────────────
// ComputationEngine — Unit Tests
// Engine is pure: no DB, no ctx, no side effects → tests run in milliseconds
// ─────────────────────────────────────────────────────────────────────────────

describe('ComputationEngine.calculateTotals', () => {

  // ── VAT ────────────────────────────────────────────────────────────────────

  describe('VAT Inclusive (Back-calculation)', () => {
    it('should back-calculate taxable base from gross price', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 107 }],
        { type: 'FIXED', value: 0 },
        { rate: 7, mode: 'INCLUSIVE', kind: 'VAT' }
      );
      expect(result.totals.taxableBaseAmount).toBe(100);
      expect(result.totals.taxAmount).toBe(7);
      expect(result.totals.netAmount).toBe(107);
    });

    it('should handle multi-line inclusive VAT correctly', () => {
      const result = ComputationEngine.calculateTotals(
        [
          { qty: 2, unitPrice: 107 },
          { qty: 1, unitPrice: 214 },
        ],
        { type: 'FIXED', value: 0 },
        { rate: 7, mode: 'INCLUSIVE', kind: 'VAT' }
      );
      // 2×107 = 214, 1×214 = 214 → total gross 428
      // taxableBase = 428 / 1.07 ≈ 400, tax ≈ 28
      expect(result.totals.netAmount).toBe(428);
      expect(result.totals.taxableBaseAmount).toBe(400);
      expect(result.totals.taxAmount).toBe(28);
    });
  });

  describe('VAT Exclusive (Add-on)', () => {
    it('should add VAT on top of net amount', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 100 }],
        { type: 'FIXED', value: 0 },
        { rate: 7, mode: 'EXCLUSIVE', kind: 'VAT' }
      );
      expect(result.totals.taxableBaseAmount).toBe(100);
      expect(result.totals.taxAmount).toBe(7);
      expect(result.totals.netAmount).toBe(107);
    });
  });

  describe('No VAT', () => {
    it('should not apply tax when kind is NO_VAT', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 500 }],
        { type: 'FIXED', value: 0 },
        { rate: 7, mode: 'EXCLUSIVE', kind: 'NO_VAT' }
      );
      expect(result.totals.taxAmount).toBe(0);
      expect(result.totals.netAmount).toBe(500);
      expect(result.totals.taxableBaseAmount).toBe(500);
    });

    it('should not apply tax when kind is EXEMPT', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 3, unitPrice: 100 }],
        { type: 'FIXED', value: 0 },
        { rate: 7, mode: 'EXCLUSIVE', kind: 'EXEMPT' }
      );
      expect(result.totals.taxAmount).toBe(0);
      expect(result.totals.netAmount).toBe(300);
    });

    it('should not apply tax when rate is 0', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 100 }],
        { type: 'FIXED', value: 0 },
        { rate: 0, mode: 'EXCLUSIVE', kind: 'VAT' }
      );
      expect(result.totals.taxAmount).toBe(0);
      expect(result.totals.netAmount).toBe(100);
    });
  });

  // ── Discounts ──────────────────────────────────────────────────────────────

  describe('Bill-level Discount — FIXED', () => {
    it('should apply fixed discount and distribute proportionally', () => {
      const result = ComputationEngine.calculateTotals(
        [
          { qty: 1, unitPrice: 33.33 },
          { qty: 1, unitPrice: 33.33 },
          { qty: 1, unitPrice: 33.33 },
        ],
        { type: 'FIXED', value: 10 }
      );
      // Sum of all allocations must equal the discount exactly (no floating-point leak)
      const sumDiscounts = result.lines.reduce(
        (acc, l) => acc + l.billDiscountAllocation,
        0
      );
      expect(parseFloat(sumDiscounts.toFixed(2))).toBe(10);
      expect(result.totals.billDiscountAmount).toBe(10);
    });

    it('should clamp discount to total when discount exceeds subtotal', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 50 }],
        { type: 'FIXED', value: 100 } // discount > subtotal
      );
      expect(result.totals.billDiscountAmount).toBe(50); // clamped to 50
      expect(result.totals.netAmount).toBe(0);
    });
  });

  describe('Bill-level Discount — PERCENT', () => {
    it('should apply 10% discount correctly', () => {
      // Isolate discount behavior — explicitly disable VAT
      const result = ComputationEngine.calculateTotals(
        [{ qty: 2, unitPrice: 500 }],
        { type: 'PERCENT', value: 10 },
        { rate: 0, mode: 'EXCLUSIVE', kind: 'NO_VAT' }
      );
      expect(result.totals.subtotalAmount).toBe(1000);
      expect(result.totals.billDiscountAmount).toBe(100);
      expect(result.totals.netAmount).toBe(900);
    });

    it('should handle 0% discount (no-op)', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 200 }],
        { type: 'PERCENT', value: 0 },
        { rate: 0, mode: 'EXCLUSIVE', kind: 'NO_VAT' }
      );
      expect(result.totals.billDiscountAmount).toBe(0);
      expect(result.totals.netAmount).toBe(200);
    });

    it('should apply 10% discount then add VAT on discounted amount', () => {
      // Combined: discount first, then VAT on discounted base
      const result = ComputationEngine.calculateTotals(
        [{ qty: 2, unitPrice: 500 }],
        { type: 'PERCENT', value: 10 },
        { rate: 7, mode: 'EXCLUSIVE', kind: 'VAT' }
      );
      expect(result.totals.subtotalAmount).toBe(1000);
      expect(result.totals.billDiscountAmount).toBe(100);
      expect(result.totals.taxableBaseAmount).toBe(900);
      expect(result.totals.taxAmount).toBe(63);
      expect(result.totals.netAmount).toBe(963);
    });
  });

  describe('Line-level Discount', () => {
    it('should subtract line discount before tax', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 100, lineDiscount: 20 }],
        { type: 'FIXED', value: 0 },
        { rate: 7, mode: 'EXCLUSIVE', kind: 'VAT' }
      );
      // taxable base = 100 - 20 = 80, tax = 80 * 7% = 5.6, net = 85.6
      expect(result.lines[0].lineDiscount).toBe(20);
      expect(result.lines[0].taxableBase).toBe(80);
      expect(result.lines[0].taxAmount).toBe(5.6);
      expect(result.lines[0].lineNet).toBe(85.6);
    });
  });

  // ── Profit & Cost ──────────────────────────────────────────────────────────

  describe('Profit Calculation', () => {
    it('should calculate line profit correctly', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 5, unitPrice: 100, costPrice: 60 }],
        { type: 'FIXED', value: 0 },
        { rate: 0, mode: 'EXCLUSIVE', kind: 'NO_VAT' }
      );
      // revenue = 500, cost = 300, profit = 200
      expect(result.totals.totalCost).toBe(300);
      expect(result.totals.totalProfit).toBe(200);
    });

    it('should report zero profit when cost equals price', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 100, costPrice: 100 }],
        { type: 'FIXED', value: 0 },
        { rate: 0, mode: 'EXCLUSIVE', kind: 'NO_VAT' }
      );
      expect(result.totals.totalProfit).toBe(0);
    });
  });

  // ── Header Totals Consistency ──────────────────────────────────────────────

  describe('Header Totals Invariants', () => {
    it('netAmount should equal taxableBaseAmount + taxAmount', () => {
      const result = ComputationEngine.calculateTotals(
        [
          { qty: 3, unitPrice: 150, costPrice: 80 },
          { qty: 2, unitPrice: 250, costPrice: 120 },
        ],
        { type: 'PERCENT', value: 5 },
        { rate: 7, mode: 'EXCLUSIVE', kind: 'VAT' }
      );
      const { netAmount, taxableBaseAmount, taxAmount } = result.totals;
      expect(netAmount).toBeCloseTo(taxableBaseAmount + taxAmount, 2);
    });

    it('totalProfit should equal netAmount - totalCost (no-VAT scenario)', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 2, unitPrice: 300, costPrice: 200 }],
        { type: 'FIXED', value: 0 },
        { rate: 0, mode: 'EXCLUSIVE', kind: 'NO_VAT' }
      );
      const { netAmount, totalCost, totalProfit } = result.totals;
      expect(totalProfit).toBeCloseTo(netAmount - totalCost, 2);
    });

    it('sum of line nets should equal header netAmount', () => {
      const result = ComputationEngine.calculateTotals(
        [
          { qty: 1, unitPrice: 100 },
          { qty: 2, unitPrice: 50 },
          { qty: 3, unitPrice: 25 },
        ],
        { type: 'FIXED', value: 30 },
        { rate: 7, mode: 'EXCLUSIVE', kind: 'VAT' }
      );
      const sumLineNets = result.lines.reduce((acc, l) => acc + l.lineNet, 0);
      expect(parseFloat(sumLineNets.toFixed(2))).toBe(result.totals.netAmount);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle single item with no tax or discount', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 100 }],
        { type: 'FIXED', value: 0 },
        { rate: 0, mode: 'EXCLUSIVE', kind: 'NO_VAT' }
      );
      expect(result.totals.netAmount).toBe(100);
      expect(result.totals.billDiscountAmount).toBe(0);
      expect(result.totals.taxAmount).toBe(0);
    });

    it('should handle zero unit price', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 10, unitPrice: 0 }],
        { type: 'FIXED', value: 0 }
      );
      expect(result.totals.netAmount).toBe(0);
      expect(result.totals.subtotalAmount).toBe(0);
    });

    it('should handle floating-point amounts without precision errors', () => {
      const result = ComputationEngine.calculateTotals(
        [{ qty: 3, unitPrice: 33.33 }],
        { type: 'FIXED', value: 0 },
        { rate: 0, mode: 'EXCLUSIVE', kind: 'NO_VAT' }
      );
      // 3 × 33.33 = 99.99 (not 99.99000000000001)
      expect(result.totals.subtotalAmount).toBe(99.99);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ComputationEngine.calculateWHT — Withholding Tax
// ─────────────────────────────────────────────────────────────────────────────

describe('ComputationEngine.calculateWHT', () => {
  it('should calculate standard WHT (3% of 100)', () => {
    const result = ComputationEngine.calculateWHT(100, 3);
    expect(result.base).toBe(100);
    expect(result.taxAmount).toBe(3);
    expect(result.netPaid).toBe(97);
  });

  it('should calculate gross-up WHT (employer pays tax)', () => {
    // Formula: 100 × (3 / (100 - 3)) = 100 × (3/97) ≈ 3.09
    const result = ComputationEngine.calculateWHT(100, 3, true);
    expect(result.taxAmount).toBe(3.09);
    expect(result.netPaid).toBe(96.91);
  });

  it('should calculate 5% WHT correctly', () => {
    const result = ComputationEngine.calculateWHT(10000, 5);
    expect(result.taxAmount).toBe(500);
    expect(result.netPaid).toBe(9500);
  });

  it('should handle 1% WHT on small amount', () => {
    const result = ComputationEngine.calculateWHT(50, 1);
    expect(result.taxAmount).toBe(0.5);
    expect(result.netPaid).toBe(49.5);
  });

  it('should return zero tax for 0% rate', () => {
    const result = ComputationEngine.calculateWHT(1000, 0);
    expect(result.taxAmount).toBe(0);
    expect(result.netPaid).toBe(1000);
  });
});
