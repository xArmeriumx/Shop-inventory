/**
 * Lock Helpers — SSOT สำหรับ Sale Lock System
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2 (post-backfill): isLocked ลบออกจาก Schema แล้ว
 * editLockStatus เป็น Single Source of Truth เพียงอย่างเดียว
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type LockStatus = 'NONE' | 'LOCKED' | 'BILLED';

/**
 * ✅ SSOT Read: อ่านสถานะล็อกจาก editLockStatus
 *
 * ใช้แทนการเขียน:
 *   sale.editLockStatus === 'LOCKED'  // ❌ prone to missing other statuses
 *   resolveLocked(sale)               // ✅ ครอบคลุมทุก non-NONE status
 */
export function resolveLocked(sale: {
    editLockStatus?: string | null;
}): boolean {
    return !!sale.editLockStatus && sale.editLockStatus !== 'NONE';
}

/**
 * ✅ SSOT Write: สร้าง lock payload
 *
 * ใช้แทนการเขียน:
 *   { editLockStatus: 'LOCKED' }   // ❌ ลืม lockReason บ่อย
 *   buildLockData('LOCKED', 'เหตุผล') // ✅
 *
 * @param status - สถานะล็อก: 'NONE' | 'LOCKED' | 'BILLED'
 * @param reason - เหตุผล (undefined = ไม่แตะ lockReason, null = clear)
 */
export function buildLockData(
    status: LockStatus,
    reason?: string | null
): { editLockStatus: string; lockReason?: string | null } {
    return {
        editLockStatus: status,
        ...(reason !== undefined && { lockReason: reason }),
    };
}
