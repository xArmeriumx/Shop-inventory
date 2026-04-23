import { money, toNumber } from '@/lib/money';

/**
 * TaxCalculationService — Single Source of Truth สำหรับคำนวณภาษี
 *
 * กฎสำคัญ:
 * - ห้ามคิด VAT ใน PDF template, UI form, หรือ payment
 * - ทุกการคำนวณภาษีต้องมาจาก service นี้เท่านั้น
 * - สูตร EXCLUSIVE: net = base + tax
 * - สูตร INCLUSIVE: ต้อง back-calculate base จาก gross
 */

export type TaxKind = 'VAT' | 'ZERO_RATED' | 'EXEMPT' | 'NO_VAT';
export type TaxCalculationMode = 'EXCLUSIVE' | 'INCLUSIVE';

export interface LineCalcInput {
    qty: number;
    unitPrice: number;
    lineDiscount?: number; // ส่วนลดระดับ line
    billDiscountAllocation?: number; // ส่วนลดจาก bill level ที่ allocate มา
    taxRate: number; // เช่น 7 (ไม่ใช่ 0.07)
    calculationMode: TaxCalculationMode;
    taxKind: TaxKind;
}

export interface LineCalcResult {
    lineSubtotal: number; // qty × unitPrice (ก่อนส่วนลด)
    discountAmount: number; // lineDiscount + billDiscountAllocation
    taxableBase: number; // lineSubtotal - discount (ฐานภาษี)
    taxAmount: number; // VAT คำนวณจากฐาน (0 ถ้า EXEMPT/NO_VAT)
    lineNet: number; // taxableBase + taxAmount
}

export interface HeaderTotals {
    subtotalAmount: number; // sum ของ lineSubtotal ทุก line
    discountAmount: number; // sum ของ discount ทุก line
    taxableBaseAmount: number; // sum ของ taxableBase ทุก line (ฐานภาษีรวม)
    taxAmount: number; // sum ของ taxAmount ทุก line (VAT รวม)
    netAmount: number; // taxableBaseAmount + taxAmount
}

/**
 * คำนวณภาษีระดับ line item
 */
function calculateLine(input: LineCalcInput): LineCalcResult {
    const { qty, unitPrice, lineDiscount = 0, billDiscountAllocation = 0 } = input;
    const { taxRate, calculationMode, taxKind } = input;

    // Use money library for all operations
    const lineSubtotal = money.multiply(qty, unitPrice);
    const discountAmount = money.add(lineDiscount, billDiscountAllocation);

    let taxableBase: number;
    let taxAmount: number;
    let lineNet: number;

    if (taxKind === 'EXEMPT' || taxKind === 'NO_VAT') {
        // ยกเว้นภาษีหรือไม่มี VAT — ไม่คิด tax เลย
        taxableBase = money.subtract(lineSubtotal, discountAmount);
        taxAmount = 0;
        lineNet = taxableBase;
    } else if (calculationMode === 'INCLUSIVE') {
        // VAT รวมในราคาแล้ว — back-calculate
        // gross = base * (1 + rate/100) => base = gross / (1 + rate/100)
        const gross = money.subtract(lineSubtotal, discountAmount);
        const divisor = money.add(1, money.divide(taxRate, 100));

        taxableBase = money.round(money.divide(gross, divisor), 2);
        taxAmount = money.subtract(gross, taxableBase);
        lineNet = gross;
    } else {
        // EXCLUSIVE (ค่า default สำหรับไทย) — VAT บวกเพิ่ม
        taxableBase = money.subtract(lineSubtotal, discountAmount);
        taxAmount = money.round(money.divide(money.multiply(taxableBase, taxRate), 100), 2);
        lineNet = money.add(taxableBase, taxAmount);
    }

    return {
        lineSubtotal: money.round(lineSubtotal, 2),
        discountAmount: money.round(discountAmount, 2),
        taxableBase: money.round(taxableBase, 2),
        taxAmount: money.round(taxAmount, 2),
        lineNet: money.round(lineNet, 2)
    };
}

/**
 * รวม header totals จากทุก line
 */
function aggregateHeader(lines: LineCalcResult[]): HeaderTotals {
    const subtotalAmount = money.sumArray(lines.map(l => l.lineSubtotal));
    const discountAmount = money.sumArray(lines.map(l => l.discountAmount));
    const taxableBaseAmount = money.sumArray(lines.map(l => l.taxableBase));
    const taxAmount = money.sumArray(lines.map(l => l.taxAmount));
    const netAmount = money.add(taxableBaseAmount, taxAmount);

    return {
        subtotalAmount: money.round(subtotalAmount, 2),
        discountAmount: money.round(discountAmount, 2),
        taxableBaseAmount: money.round(taxableBaseAmount, 2),
        taxAmount: money.round(taxAmount, 2),
        netAmount: money.round(netAmount, 2)
    };
}

/**
 * คำนวณ bill-level discount allocation แบบ proportional
 * ใช้เมื่อมีส่วนลดระดับ header ที่ต้อง allocate ไปแต่ละ line
 *
 * @param lines - array of { lineSubtotal } ก่อนส่วนลด
 * @param billDiscount - ส่วนลดรวมระดับ bill
 * @returns allocations แบบ proportional (แก้ rounding error บน last line)
 */
function allocateBillDiscount(
    lines: { lineSubtotal: number }[],
    billDiscount: number
): number[] {
    if (billDiscount === 0 || lines.length === 0) return lines.map(() => 0);

    const total = money.sumArray(lines.map(l => l.lineSubtotal));
    if (total === 0) return lines.map(() => 0);

    const allocations: number[] = [];
    let allocated = 0;

    for (let i = 0; i < lines.length - 1; i++) {
        // allocation = (lineSubtotal / total) * billDiscount
        const ratio = money.divide(lines[i].lineSubtotal, total);
        const alloc = money.round(money.multiply(ratio, billDiscount), 2);
        allocations.push(alloc);
        allocated = money.add(allocated, alloc);
    }

    // Last line รับ rounding remainder ทั้งหมด
    allocations.push(money.round(money.subtract(billDiscount, allocated), 2));
    return allocations;
}

export const TaxCalculationService = {
    calculateLine,
    aggregateHeader,
    allocateBillDiscount,
};

