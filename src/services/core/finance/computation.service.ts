import { money, toNumber } from '@/lib/money';

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type TaxKind = 'VAT' | 'ZERO_RATED' | 'EXEMPT' | 'NO_VAT';
export type TaxCalculationMode = 'EXCLUSIVE' | 'INCLUSIVE';
export type DiscountType = 'FIXED' | 'PERCENT';

export interface CalculationItemInput {
    qty: number;
    unitPrice: number;
    costPrice?: number;
    lineDiscount?: number;
    taxRate?: number;
    taxKind?: TaxKind;
    taxMode?: TaxCalculationMode;
}

export interface CalculationResult {
    lines: LineResult[];
    totals: HeaderTotals;
}

export interface LineResult {
    qty: number;
    unitPrice: number;
    costPrice: number;
    lineSubtotal: number; // qty * unitPrice
    lineDiscount: number;
    billDiscountAllocation: number;
    taxableBase: number; // lineSubtotal - lineDiscount - billDiscountAllocation
    taxAmount: number;
    lineNet: number; // taxableBase + taxAmount
    lineCost: number; // qty * costPrice
    lineProfit: number; // lineNet - lineCost
}

export interface HeaderTotals {
    subtotalAmount: number; // sum(lineSubtotal)
    billDiscountAmount: number;
    taxableBaseAmount: number; // sum(taxableBase)
    taxAmount: number; // sum(taxAmount)
    netAmount: number; // taxableBaseAmount + taxAmount
    totalCost: number;
    totalProfit: number;
}

// ─── CORE ARITHMETIC (Precision Guardrails) ───────────────────────────────

/**
 * Normalize any input to a clean number via Decimal.js
 */
const normalizeMoney = (val: unknown): number => toNumber(val);

/**
 * Standard rounding (Default 2 decimals for Baht)
 */
const roundMoney = (val: number, decimals: number = 2): number => money.round(val, decimals);

/**
 * Precision-aware summation
 */
const sumMoney = (values: number[]): number => money.sumArray(values);

/**
 * Precision-aware comparison
 */
const compareMoney = (a: number, b: number): boolean => money.isEqual(a, b);

/**
 * Deterministic Remainder Distribution
 * Policy: Allocate residual cents to the first line following a proportional split
 */
const distributeRemainder = (
    lines: number[],
    targetTotal: number
): number[] => {
    if (lines.length === 0) return [];
    const currentTotal = sumMoney(lines);
    const diff = money.subtract(targetTotal, currentTotal);

    if (compareMoney(diff, 0)) return lines;

    // Add the difference to the first line to ensure the total is exact
    const result = [...lines];
    result[0] = money.add(result[0], diff);
    return result;
};

// ─── BUSINESS LOGIC ─────────────────────────────────────────────────────────

/**
 * Calculate bill-level discount allocation proportionally across lines
 */
const allocateBillDiscount = (
    lineSubtotals: number[],
    billDiscount: number
): number[] => {
    if (billDiscount === 0 || lineSubtotals.length === 0) {
        return lineSubtotals.map(() => 0);
    }

    const totalSubtotal = sumMoney(lineSubtotals);
    if (totalSubtotal === 0) return lineSubtotals.map(() => 0);

    const allocations = lineSubtotals.map(subtotal => {
        const ratio = money.divide(subtotal, totalSubtotal);
        return roundMoney(money.multiply(ratio, billDiscount));
    });

    return distributeRemainder(allocations, billDiscount);
};

/**
 * Core VAT Logic for a single line
 */
const calculateLineTax = (
    rawBase: number,
    taxRate: number,
    mode: TaxCalculationMode,
    kind: TaxKind
): { taxableBase: number; taxAmount: number } => {
    if (kind === 'EXEMPT' || kind === 'NO_VAT' || taxRate === 0) {
        return { taxableBase: rawBase, taxAmount: 0 };
    }

    if (mode === 'INCLUSIVE') {
        // base = gross / (1 + rate/100)
        const divisor = money.add(1, money.divide(taxRate, 100));
        const taxableBase = roundMoney(money.divide(rawBase, divisor));
        const taxAmount = money.subtract(rawBase, taxableBase);
        return { taxableBase, taxAmount };
    } else {
        // EXCLUSIVE: tax = base * (rate/100)
        const taxAmount = roundMoney(money.divide(money.multiply(rawBase, taxRate), 100));
        return { taxableBase: rawBase, taxAmount };
    }
};

/**
 * Calculate full document totals
 */
export const ComputationEngine = {
    normalizeMoney,
    roundMoney,
    sumMoney,
    compareMoney,
    distributeRemainder,

    calculateTotals: (
        items: CalculationItemInput[],
        headerDiscount: { type: DiscountType; value: number } = { type: 'FIXED', value: 0 },
        globalTaxConfig: { rate: number; mode: TaxCalculationMode; kind: TaxKind } = { rate: 7, mode: 'EXCLUSIVE', kind: 'VAT' }
    ): CalculationResult => {
        // 1. Line-level Subtotals & Costs
        const lineSubtotals = items.map(item =>
            money.multiply(normalizeMoney(item.qty), normalizeMoney(item.unitPrice))
        );

        const totalSubtotalBeforeDiscount = sumMoney(lineSubtotals);

        // 2. Determine Header Discount Amount
        let billDiscountAmount = 0;
        if (headerDiscount.type === 'PERCENT') {
            billDiscountAmount = roundMoney(
                money.multiply(totalSubtotalBeforeDiscount, money.divide(headerDiscount.value, 100))
            );
        } else {
            billDiscountAmount = normalizeMoney(headerDiscount.value);
        }

        // Guard: Bill discount cannot exceed total
        if (billDiscountAmount > totalSubtotalBeforeDiscount) {
            billDiscountAmount = totalSubtotalBeforeDiscount;
        }

        // 3. Allocate Bill Discount
        const billDiscountAllocations = allocateBillDiscount(lineSubtotals, billDiscountAmount);

        // 4. Calculate each line
        const lineResults: LineResult[] = items.map((item, idx) => {
            const lineSubtotal = lineSubtotals[idx];
            const lineDiscount = normalizeMoney(item.lineDiscount || 0);
            const billDiscountAllocation = billDiscountAllocations[idx];
            const costPrice = normalizeMoney(item.costPrice || 0);
            const lineCost = money.multiply(normalizeMoney(item.qty), costPrice);

            // Step: Subtract ALL discounts before tax
            const rawBase = money.subtract(money.subtract(lineSubtotal, lineDiscount), billDiscountAllocation);

            // Step: Apply Tax
            const taxRate = item.taxRate ?? globalTaxConfig.rate;
            const taxMode = item.taxMode ?? globalTaxConfig.mode;
            const taxKind = item.taxKind ?? globalTaxConfig.kind;

            const { taxableBase, taxAmount } = calculateLineTax(rawBase, taxRate, taxMode, taxKind);
            const lineNet = money.add(taxableBase, taxAmount);

            return {
                qty: item.qty,
                unitPrice: item.unitPrice,
                costPrice,
                lineSubtotal: roundMoney(lineSubtotal),
                lineDiscount: roundMoney(lineDiscount),
                billDiscountAllocation: roundMoney(billDiscountAllocation),
                taxableBase: roundMoney(taxableBase),
                taxAmount: roundMoney(taxAmount),
                lineNet: roundMoney(lineNet),
                lineCost: roundMoney(lineCost),
                lineProfit: roundMoney(money.subtract(lineNet, lineCost))
            };
        });

        // 5. Aggregate Header
        const totals: HeaderTotals = {
            subtotalAmount: roundMoney(sumMoney(lineResults.map(l => l.lineSubtotal))),
            billDiscountAmount: roundMoney(billDiscountAmount),
            taxableBaseAmount: roundMoney(sumMoney(lineResults.map(l => l.taxableBase))),
            taxAmount: roundMoney(sumMoney(lineResults.map(l => l.taxAmount))),
            netAmount: roundMoney(sumMoney(lineResults.map(l => l.lineNet))),
            totalCost: roundMoney(sumMoney(lineResults.map(l => l.lineCost))),
            totalProfit: roundMoney(sumMoney(lineResults.map(l => l.lineProfit)))
        };

        return {
            lines: lineResults,
            totals: totals
        };
    },

    /**
     * Withholding Tax (WHT) Utility
     * Support for Gross-up (Employer pays tax)
     */
    calculateWHT: (
        base: number,
        rate: number,
        isGrossUp: boolean = false
    ): { base: number; taxAmount: number; netPaid: number } => {
        const normalizedBase = normalizeMoney(base);
        const normalizedRate = normalizeMoney(rate);

        let taxAmount: number;
        if (isGrossUp) {
            // Gross-up: amount * (rate / (100 - rate))
            const denominator = money.subtract(100, normalizedRate);
            taxAmount = roundMoney(money.multiply(normalizedBase, money.divide(normalizedRate, denominator)));
        } else {
            // Normal: amount * (rate / 100)
            taxAmount = roundMoney(money.divide(money.multiply(normalizedBase, normalizedRate), 100));
        }

        return {
            base: normalizedBase,
            taxAmount,
            netPaid: roundMoney(money.subtract(normalizedBase, taxAmount))
        };
    }
};
