/**
 * src/config/reason-codes.ts
 * 
 * Central Reason Code Registry — Phase OB5.1 SSOT
 * 
 * Rules:
 * - Use STABLE machine codes (won't change with label translations)
 * - Labels (Thai/EN) live here only — never hardcoded in components
 * - Add new reasons here without touching any other file
 */

export interface ReasonCode {
    code: string;
    label: string;
    labelEn?: string;
    requiresDetail?: boolean; // Whether the user must supply a free-text reason
}

// ==================== Sale Cancel Reasons ====================

export const SALE_CANCEL_REASONS: ReasonCode[] = [
    { code: 'WRONG_ENTRY', label: 'บันทึกผิดพลาด', labelEn: 'Wrong Entry' },
    { code: 'CUSTOMER_REQUEST', label: 'ลูกค้าขอยกเลิก', labelEn: 'Customer Request' },
    { code: 'DAMAGED', label: 'สินค้าชำรุด', labelEn: 'Damaged Goods' },
    { code: 'DUPLICATE', label: 'รายการซ้ำ', labelEn: 'Duplicate Order' },
    { code: 'OUT_OF_STOCK', label: 'สินค้าหมด', labelEn: 'Out of Stock' },
    { code: 'OTHER', label: 'อื่นๆ', labelEn: 'Other', requiresDetail: true },
];

// ==================== Return Reasons ====================

export const RETURN_REASONS: ReasonCode[] = [
    { code: 'WRONG_ITEM', label: 'สินค้าผิดรายการ', labelEn: 'Wrong Item' },
    { code: 'DAMAGED', label: 'สินค้าชำรุด/บกพร่อง', labelEn: 'Damaged / Defective' },
    { code: 'CUSTOMER_CHANGE', label: 'ลูกค้าเปลี่ยนใจ', labelEn: 'Customer Changed Mind' },
    { code: 'WRONG_QTY', label: 'จำนวนไม่ตรง', labelEn: 'Wrong Quantity' },
    { code: 'OTHER', label: 'อื่นๆ', labelEn: 'Other', requiresDetail: true },
];

// ==================== Purchase Cancel Reasons ====================

export const PURCHASE_CANCEL_REASONS: ReasonCode[] = [
    { code: 'SUPPLIER_CANCELLED', label: 'ซัพพลายเออร์ยกเลิก', labelEn: 'Supplier Cancelled' },
    { code: 'WRONG_ENTRY', label: 'บันทึกผิดพลาด', labelEn: 'Wrong Entry' },
    { code: 'PRICE_CHANGE', label: 'ราคาเปลี่ยน', labelEn: 'Price Changed' },
    { code: 'OTHER', label: 'อื่นๆ', labelEn: 'Other', requiresDetail: true },
];

// ==================== Helpers ====================

/**
 * Resolve a reason code to human-readable label.
 * Falls back to the code itself if not found.
 */
export function resolveReasonLabel(
    reasons: ReasonCode[],
    code: string,
    detail?: string
): string {
    const found = reasons.find(r => r.code === code);
    if (!found) return code;
    if (found.requiresDetail && detail?.trim()) {
        return `${found.label}: ${detail.trim()}`;
    }
    return found.label;
}

/**
 * Validate reason code and detail requirement.
 * Throws if the code is invalid or detail is missing when required.
 */
export function validateReason(
    reasons: ReasonCode[],
    code: string,
    detail?: string
): void {
    const found = reasons.find(r => r.code === code);
    if (!found) throw new Error(`รหัสเหตุผลไม่ถูกต้อง: ${code}`);
    if (found.requiresDetail && !detail?.trim()) {
        throw new Error(`กรุณากรอกรายละเอียดสำหรับเหตุผล "${found.label}"`);
    }
}
