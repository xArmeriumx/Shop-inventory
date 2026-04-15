/**
 * ============================================================================
 * SequenceService — Single Source of Truth สำหรับเลขที่เอกสาร
 * ============================================================================
 *
 * ทุก Service ที่ต้องการรันเลขเอกสาร (INV, PO, PR, SHP, RET, ...)
 * ต้องเรียกผ่าน SequenceService.generate() เท่านั้น
 *
 * Features:
 * - Race-safe: ใช้ Prisma raw SQL `UPDATE ... SET counter = counter + 1` (Atomic)
 * - Auto-create: ถ้ายังไม่มี Sequence สำหรับ prefix นั้น สร้างใหม่อัตโนมัติ
 * - Flexible Format: รองรับ Prefix ตามแผนก, ปีไทย/สากล, Reset รายเดือน/ปี
 *
 * @example
 * // ภายใน db.$transaction:
 * const inv = await SequenceService.generate(ctx, 'INV', tx);
 * // → "INV-2604-00001"
 *
 * const po = await SequenceService.generate(ctx, 'PO', tx, { prefix: 'C', useBuddhistYear: false });
 * // → "C-PO-2604-00001"
 *
 * @module SequenceService
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  DocumentType,
  SequenceFormat,
  SequenceConfig,
  ServiceError,
  type RequestContext,
} from '@/types/domain';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default config สำหรับแต่ละ Document Type
 * Shop สามารถ Override ได้ผ่าน Settings ในอนาคต
 */
const DEFAULT_CONFIGS: Record<string, Omit<SequenceConfig, 'documentType'>> = {
  [DocumentType.SALE_INVOICE]: {
    format: SequenceFormat.STANDARD,
    resetCycle: 'MONTHLY',
    padLength: 5,
    useBuddhistYear: false,
  },
  [DocumentType.PURCHASE_ORDER]: {
    format: SequenceFormat.STANDARD,
    resetCycle: 'MONTHLY',
    padLength: 5,
    useBuddhistYear: false,
  },
  [DocumentType.PURCHASE_REQUEST]: {
    format: SequenceFormat.STANDARD,
    resetCycle: 'MONTHLY',
    padLength: 5,
    useBuddhistYear: false,
  },
  [DocumentType.SHIPMENT]: {
    format: SequenceFormat.STANDARD,
    resetCycle: 'MONTHLY',
    padLength: 5,
    useBuddhistYear: false,
  },
  [DocumentType.RETURN]: {
    format: SequenceFormat.STANDARD,
    resetCycle: 'MONTHLY',
    padLength: 5,
    useBuddhistYear: false,
  },
  [DocumentType.CREDIT_NOTE]: {
    format: SequenceFormat.STANDARD,
    resetCycle: 'MONTHLY',
    padLength: 5,
    useBuddhistYear: false,
  },
  [DocumentType.QUOTATION]: {
    format: SequenceFormat.STANDARD,
    resetCycle: 'MONTHLY',
    padLength: 5,
    useBuddhistYear: false,
  },
  [DocumentType.BILLING]: {
    format: SequenceFormat.STANDARD,
    resetCycle: 'MONTHLY',
    padLength: 5,
    useBuddhistYear: false,
  },
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * สร้าง Sequence Key จาก prefix + period
 * เช่น "INV" + 2026-04 → "INV"
 * เช่น "K" + "INV" + 2026-04 → "K-INV"
 */
function buildSequencePrefix(
  docType: DocumentType,
  overrides?: Partial<SequenceConfig> & { purchaseType?: string, invoiceType?: string },
): string {
  const dept = overrides?.departmentCode;
  const customPrefix = overrides?.prefix;

  // 1. Explicit Custom Prefix (Highest Priority) - UC 8 (OD prefix)
  if (customPrefix) return customPrefix;
  
  // 2. Special Purchase Logic - UC 5 (Local/Foreign)
  if (docType === DocumentType.PURCHASE_ORDER || docType === DocumentType.PURCHASE_REQUEST) {
    const pType = overrides?.purchaseType;
    if (pType === 'FOREIGN') return `T-${docType}`;
    if (pType === 'LOCAL') return `C-${docType}`;
  }

  // 3. Department-based Logic - UC 7 & UC 1 (K-INV, etc.)
  if (dept) return `${dept}-${docType}`;

  // 4. Default Document Type
  return docType;
}

/**
 * สร้าง Year/Month จากวันที่ปัจจุบัน
 */
function getPeriod(useBuddhistYear: boolean): { year: number; month: number; yearStr: string; monthStr: string } {
  const now = new Date();
  const gregorianYear = now.getFullYear();
  const year = useBuddhistYear ? gregorianYear + 543 : gregorianYear;
  const month = now.getMonth() + 1;

  return {
    year,
    month,
    yearStr: String(year).slice(-2),     // 2 หลัก: 26 หรือ 69
    monthStr: String(month).padStart(2, '0'),
  };
}

/**
 * ประกอบเลขเอกสารจาก prefix + period + counter
 */
function formatSequenceNumber(
  prefix: string,
  yearStr: string,
  monthStr: string,
  counter: number,
  padLength: number,
  resetCycle: 'MONTHLY' | 'YEARLY' | 'NEVER',
): string {
  const paddedCounter = String(counter).padStart(padLength, '0');

  switch (resetCycle) {
    case 'MONTHLY':
      return `${prefix}-${yearStr}${monthStr}-${paddedCounter}`;
    case 'YEARLY':
      return `${prefix}-${yearStr}-${paddedCounter}`;
    case 'NEVER':
      return `${prefix}-${paddedCounter}`;
  }
}

import { ISequenceService } from '@/types/service-contracts';

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export const SequenceService: ISequenceService = {
  /**
   * Generate — สร้างเลขเอกสารใหม่ (Atomic, Race-safe)
   *
   * ⚠️ ต้องเรียกภายใน db.$transaction เท่านั้น
   *
   * Algorithm:
   * 1. คำนวณ prefix + year + month จากข้อมูลปัจจุบัน
   * 2. ใช้ Prisma upsert เพื่อ atomic increment counter
   * 3. ประกอบเลขเอกสารจาก format string
   */
  async generate(
    ctx: RequestContext,
    docType: DocumentType,
    tx: Prisma.TransactionClient,
    overrides?: Partial<SequenceConfig>,
  ): Promise<string> {
    // 1. Resolve configuration
    const defaults = DEFAULT_CONFIGS[docType];
    if (!defaults) {
      throw new ServiceError(`ไม่พบ Sequence Config สำหรับเอกสารประเภท "${docType}"`);
    }

    const config = { ...defaults, ...overrides };
    const prefix = buildSequencePrefix(docType, overrides);
    const period = getPeriod(config.useBuddhistYear);

    // 2. Determine period key based on reset cycle
    const periodYear = config.resetCycle !== 'NEVER' ? period.year : 0;
    const periodMonth = config.resetCycle === 'MONTHLY' ? period.month : 0;

    // 3. Atomic upsert: increment counter or create new sequence
    const sequence = await tx.docSequence.upsert({
      where: {
        shopId_prefix_year_month: {
          shopId: ctx.shopId,
          prefix,
          year: periodYear,
          month: periodMonth,
        },
      },
      create: {
        shopId: ctx.shopId,
        prefix,
        year: periodYear,
        month: periodMonth,
        counter: 1,
      },
      update: {
        counter: { increment: 1 },
      },
    });

    // 4. Format the final document number
    return formatSequenceNumber(
      prefix,
      period.yearStr,
      period.monthStr,
      sequence.counter,
      config.padLength,
      config.resetCycle,
    );
  },

  /**
   * Preview — แสดงตัวอย่างเลขถัดไป (ไม่บันทึก)
   * ใช้แสดงใน UI ก่อนกด Confirm
   */
  async preview(
    ctx: RequestContext,
    docType: DocumentType,
    overrides?: Partial<SequenceConfig>,
  ): Promise<string> {
    const defaults = DEFAULT_CONFIGS[docType];
    if (!defaults) {
      throw new ServiceError(`ไม่พบ Sequence Config สำหรับเอกสารประเภท "${docType}"`);
    }

    const config = { ...defaults, ...overrides };
    const prefix = buildSequencePrefix(docType, overrides);
    const period = getPeriod(config.useBuddhistYear);

    const periodYear = config.resetCycle !== 'NEVER' ? period.year : 0;
    const periodMonth = config.resetCycle === 'MONTHLY' ? period.month : 0;

    // Read-only: ไม่ increment
    const existing = await db.docSequence.findUnique({
      where: {
        shopId_prefix_year_month: {
          shopId: ctx.shopId,
          prefix,
          year: periodYear,
          month: periodMonth,
        },
      },
    });

    const nextCounter = (existing?.counter ?? 0) + 1;

    return formatSequenceNumber(
      prefix,
      period.yearStr,
      period.monthStr,
      nextCounter,
      config.padLength,
      config.resetCycle,
    );
  },

  /**
   * GetCurrentCounter — ดึง Counter ปัจจุบัน (สำหรับ Dashboard)
   */
  async getCurrentCounter(
    ctx: RequestContext,
    docType: DocumentType,
  ): Promise<number> {
    const defaults = DEFAULT_CONFIGS[docType];
    if (!defaults) return 0;

    const prefix = docType;
    const period = getPeriod(defaults.useBuddhistYear);

    const periodYear = defaults.resetCycle !== 'NEVER' ? period.year : 0;
    const periodMonth = defaults.resetCycle === 'MONTHLY' ? period.month : 0;

    const existing = await db.docSequence.findUnique({
      where: {
        shopId_prefix_year_month: {
          shopId: ctx.shopId,
          prefix,
          year: periodYear,
          month: periodMonth,
        },
      },
    });

    return existing?.counter ?? 0;
  },
};
