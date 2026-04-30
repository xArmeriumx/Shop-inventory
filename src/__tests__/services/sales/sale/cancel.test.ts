import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaleCancelUseCase } from '@/services/sales/sale/cancel';
import { Security } from '@/services/core/iam/security.service';
import { db } from '@/lib/db';
import { ServiceError } from '@/types/domain';
import { AuditService } from '@/services/core/system/audit.service';

vi.mock('@/services/core/iam/security.service', () => ({
  Security: {
    require: vi.fn(),
  },
}));

vi.mock('@/config/reason-codes', () => ({
  validateReason: vi.fn(),
  resolveReasonLabel: vi.fn().mockReturnValue('Mock Reason'),
  SALE_CANCEL_REASONS: [],
}));

const txMock = {
  user: { findUnique: vi.fn().mockResolvedValue({ name: 'Test User' }) },
  sale: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
  saleStatus: { updateMany: vi.fn() },
};

vi.mock('@/lib/db', () => ({
  db: {
    sale: {
      findFirst: vi.fn(),
    },
  },
  runInTransaction: vi.fn(async (tx, callback) => {
    return callback(txMock);
  }),
}));

vi.mock('@/services/core/system/audit.service', () => ({
  AuditService: {
    runWithAudit: vi.fn(async (ctx, policy, callback) => {
      return callback();
    }),
  },
}));

describe('SaleCancelUseCase', () => {
  const mockCtx: any = { shopId: 'shop-1', userId: 'user-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw ServiceError if reasonCode is missing', async () => {
    await expect(SaleCancelUseCase.cancel({ id: 'sale-1', reasonCode: '' }, mockCtx))
      .rejects.toThrow(ServiceError);
    await expect(SaleCancelUseCase.cancel({ id: 'sale-1', reasonCode: '' }, mockCtx))
      .rejects.toThrow('กรุณาเลือกเหตุผลในการยกเลิก');
  });

  it('should throw ServiceError if sale not found', async () => {
    vi.mocked(db.sale.findFirst).mockResolvedValueOnce(null);

    await expect(SaleCancelUseCase.cancel({ id: 'sale-1', reasonCode: 'CUS_CHANGE_MIND' }, mockCtx))
      .rejects.toThrow('ไม่พบข้อมูลการขาย');
  });

  it('should throw ServiceError on concurrent cancel conflict', async () => {
    vi.mocked(db.sale.findFirst).mockResolvedValueOnce({ id: 'sale-1', status: 'CONFIRMED' } as any);
    txMock.sale.updateMany.mockResolvedValueOnce({ count: 0 }); // simulate another request updated it first

    await expect(SaleCancelUseCase.cancel({ id: 'sale-1', reasonCode: 'CUS_CHANGE_MIND' }, mockCtx))
      .rejects.toThrow('รายการนี้ถูกยกเลิกไปแล้ว (Concurrent Cancel Conflict)');
  });
});
