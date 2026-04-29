/**
 * Lock Helpers — SSOT สำหรับ Sale Lock System
 * ─────────────────────────────────────────────────────────────────────────────
 * ปัญหาเดิม: isLocked (Boolean) กับ editLockStatus (String) encode ข้อมูลเดิมซ้อนกัน
 *            ทำให้เกิด Impossible States เมื่อ update ไม่ sync กัน
 *
 * แนวทาง: Write-Through pattern
 *   - ทุก Write → ใช้ buildLockData() เพื่อ sync ทั้งสองฟิลด์พร้อมกัน
 *   - ทุก Read  → ใช้ resolveLocked() เพื่ออ่านจาก editLockStatus เป็นหลัก
 *                 พร้อม fallback ไป isLocked สำหรับ Record เก่าที่ยังไม่ Backfill
 *
 * Phase 2 (post-backfill): ลบ isLocked ออกจาก Schema และลบ fallback path ออก
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type LockStatus = 'NONE' | 'LOCKED' | 'BILLED';

/**
 * ✅ SSOT Read: อ่านสถานะล็อกจาก editLockStatus เป็นหลัก
 * Fallback ไป isLocked สำหรับ Record เก่า (ก่อน Phase 2 Backfill)
 *
 * ใช้แทนการเขียน:
 *   sale.isLocked || sale.editLockStatus === 'LOCKED'  // ❌ เดิม
 *   resolveLocked(sale)                                 // ✅ ใหม่
 */
export function resolveLocked(sale: {
    isLocked?: boolean | null;
    editLockStatus?: string | null;
}): boolean {
    // ถ้ามี editLockStatus → เชื่อค่านี้เป็นหลัก (SSOT)
    if (sale.editLockStatus !== undefined && sale.editLockStatus !== null) {
        return sale.editLockStatus !== 'NONE';
    }
    // Fallback: isLocked (deprecated — ใช้เฉพาะ Record เก่า)
    return !!sale.isLocked;
}

/**
 * ✅ SSOT Write: สร้าง lock payload ที่ sync ทั้งสองฟิลด์พร้อมกัน
 *
 * ใช้แทนการเขียน:
 *   { isLocked: true, editLockStatus: 'LOCKED' }  // ❌ เดิม (ลืม sync บ่อย)
 *   buildLockData('LOCKED', 'เหตุผล')              // ✅ ใหม่
 *
 * @param status   - สถานะล็อก: 'NONE' | 'LOCKED' | 'BILLED'
 * @param reason   - เหตุผล (undefined = ไม่แตะ lockReason, null = clear)
 */
export function buildLockData(
    status: LockStatus,
    reason?: string | null
): { editLockStatus: string; isLocked: boolean; lockReason?: string | null } {
    return {
        editLockStatus: status,
        isLocked: status !== 'NONE', // ⚠️ Deprecated mirror — จะลบใน Phase 2
        ...(reason !== undefined && { lockReason: reason }),
    };
}
