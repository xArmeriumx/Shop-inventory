import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoicePostUseCase } from '@/services/sales/invoice/post';
import { Security } from '@/services/core/iam/security.service';
import { db } from '@/lib/db';
import { ServiceError } from '@/types/domain';
import { WorkflowService } from '@/services/core/workflow/workflow.service';
import { InvoiceAccountingCoordinator } from '@/services/sales/invoice/coordinator';

// Mock dependencies
vi.mock('@/services/core/iam/security.service', () => ({
  Security: {
    require: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => {
  const txMock = {
    invoice: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    db: {
      $transaction: vi.fn(async (callback) => {
        return callback(txMock);
      }),
      invoice: txMock.invoice,
    },
  };
});

vi.mock('@/services/core/workflow/workflow.service', () => ({
  WorkflowService: {
    canInvoiceAction: vi.fn(),
  },
}));

vi.mock('@/services/sales/invoice/coordinator', () => ({
  InvoiceAccountingCoordinator: {
    postInvoiceAndTax: vi.fn(),
  },
}));

describe('InvoicePostUseCase', () => {
  const mockCtx: any = { shopId: 'shop-1', userId: 'user-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw if user does not have permission', async () => {
    vi.mocked(Security.require).mockImplementationOnce(() => {
      throw new Error('Permission denied');
    });

    await expect(InvoicePostUseCase.post(mockCtx, 'inv-1')).rejects.toThrow('Permission denied');
    expect(Security.require).toHaveBeenCalledWith(mockCtx, 'INVOICE_POST');
  });

  it('should throw ServiceError if invoice not found', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
      return cb({
        invoice: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      });
    });

    await expect(InvoicePostUseCase.post(mockCtx, 'inv-1')).rejects.toThrow(ServiceError);
    await expect(InvoicePostUseCase.post(mockCtx, 'inv-1')).rejects.toThrow('ไม่พบใบแจ้งหนี้');
  });

  it('should complete happy path and call coordinator', async () => {
    const mockInvoice = { id: 'inv-1', shopId: 'shop-1', date: new Date() };
    const mockUpdatedInvoice = { ...mockInvoice, status: 'POSTED' };

    vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
      return cb({
        invoice: {
          findUnique: vi.fn().mockResolvedValue(mockInvoice),
          update: vi.fn().mockResolvedValue(mockUpdatedInvoice),
        },
      });
    });

    const result = await InvoicePostUseCase.post(mockCtx, 'inv-1');

    expect(WorkflowService.canInvoiceAction).toHaveBeenCalledWith(mockInvoice, 'POST');
    expect(InvoiceAccountingCoordinator.postInvoiceAndTax).toHaveBeenCalled();
    expect(result.data).toEqual(mockUpdatedInvoice);
    expect(result.affectedTags?.length).toBeGreaterThan(0);
  });
});
