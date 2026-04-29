/**
 * Backfill Script: Sale Lock Status Normalization (Phase 2) — COMPLETED
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ COMPLETED: Script นี้รันเสร็จแล้ว DB clean (drift=0, orphan=0)
 *              isLocked ถูกลบออกจาก Schema และ DB แล้ว
 *
 * เก็บไว้เป็น Historical Reference — ไม่ต้องรันอีกแล้ว
 *
 * ผลลัพธ์:
 *   Drift detected  : 0 records
 *   Orphan count    : 0 records
 *   Schema cleanup  : isLocked dropped from Sale table
 * ─────────────────────────────────────────────────────────────────────────────
 */

export {};

// Script completed — isLocked column has been dropped from the Sale table.
// editLockStatus (via SaleStatus child table) is now the Single Source of Truth.
