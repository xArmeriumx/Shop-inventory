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

    const lineSubtotal = round(qty * unitPrice);
    const discountAmount = round(lineDiscount + billDiscountAllocation);

    let taxableBase: number;
    let taxAmount: number;
    let lineNet: number;

    if (taxKind === 'EXEMPT' || taxKind === 'NO_VAT') {
        // ยกเว้นภาษีหรือไม่มี VAT — ไม่คิด tax เลย
        taxableBase = round(lineSubtotal - discountAmount);
        taxAmount = 0;
        lineNet = taxableBase;
    } else if (calculationMode === 'INCLUSIVE') {
        // VAT รวมในราคาแล้ว — back-calculate
        const gross = round(lineSubtotal - discountAmount);
        taxableBase = round((gross * 100) / (100 + taxRate));
        taxAmount = round(gross - taxableBase);
        lineNet = gross;
    } else {
        // EXCLUSIVE (ค่า default สำหรับไทย) — VAT บวกเพิ่ม
        taxableBase = round(lineSubtotal - discountAmount);
        taxAmount = round((taxableBase * taxRate) / 100);
        lineNet = round(taxableBase + taxAmount);
    }

    return { lineSubtotal, discountAmount, taxableBase, taxAmount, lineNet };
}

/**
 * รวม header totals จากทุก line
 */
function aggregateHeader(lines: LineCalcResult[]): HeaderTotals {
    const subtotalAmount = round(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const discountAmount = round(lines.reduce((s, l) => s + l.discountAmount, 0));
    const taxableBaseAmount = round(lines.reduce((s, l) => s + l.taxableBase, 0));
    const taxAmount = round(lines.reduce((s, l) => s + l.taxAmount, 0));
    const netAmount = round(taxableBaseAmount + taxAmount);

    return { subtotalAmount, discountAmount, taxableBaseAmount, taxAmount, netAmount };
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

    const total = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    if (total === 0) return lines.map(() => 0);

    const allocations: number[] = [];
    let allocated = 0;

    for (let i = 0; i < lines.length - 1; i++) {
        const alloc = round((lines[i].lineSubtotal / total) * billDiscount);
        allocations.push(alloc);
        allocated += alloc;
    }

    // Last line รับ rounding remainder ทั้งหมด
    allocations.push(round(billDiscount - allocated));
    return allocations;
}

/** Helper: round ทศนิยม 2 ตำแหน่ง (Thai VAT standard) */
function round(value: number): number {
    return Math.round(value * 100) / 100;
}

export const TaxCalculationService = {
    calculateLine,
    aggregateHeader,
    allocateBillDiscount,
    round,
};
