import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurchaseReceiveUseCase } from '@/services/purchases/purchase/receive';
import { Security } from '@/services/core/iam/security.service';
import { db } from '@/lib/db';
import { ServiceError, PurchaseStatus } from '@/types/domain';
import { StockService } from '@/services/inventory/stock.service';
import { StockEngine } from '@/services/inventory/stock-engine.service';
import { AuditService } from '@/services/core/system/audit.service';

// Mock dependencies
vi.mock('@/services/core/iam/security.service', () => ({
  Security: {
    requirePermission: vi.fn(),
  },
}));

const txMock = {
  purchase: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  journalEntry: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  account: {
    findFirst: vi.fn().mockResolvedValue({ id: 'acc-1' }),
  },
  taxEntry: {
    create: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  db: {
    purchase: {
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

vi.mock('@/services/inventory/stock.service', () => ({
  StockService: {
    recordMovements: vi.fn(),
  },
}));

vi.mock('@/services/inventory/stock-engine.service', () => ({
  StockEngine: {
    resolveWarehouse: vi.fn().mockResolvedValue('wh-1'),
  },
}));

// Mock dynamic import
vi.mock('@/services/accounting/posting-engine.service', () => ({
  PostingService: {
    postPurchaseInventory: vi.fn(),
  },
}));

describe('PurchaseReceiveUseCase', () => {
  const mockCtx: any = { shopId: 'shop-1', userId: 'user-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw ServiceError if purchase not found', async () => {
    vi.mocked(db.purchase.findFirst).mockResolvedValueOnce(null);

    await expect(PurchaseReceiveUseCase.receivePurchase('po-1', mockCtx))
      .rejects.toThrow(ServiceError);
    await expect(PurchaseReceiveUseCase.receivePurchase('po-1', mockCtx))
      .rejects.toThrow('ไม่พบข้อมูลการสั่งซื้อ');
  });

  it('should throw ServiceError if already received', async () => {
    vi.mocked(db.purchase.findFirst).mockResolvedValue({ id: 'po-1', purchaseNumber: 'PO-001' } as any);
    txMock.purchase.findFirst.mockResolvedValue({ id: 'po-1', status: PurchaseStatus.RECEIVED, items: [] } as any);

    await expect(PurchaseReceiveUseCase.receivePurchase('po-1', mockCtx))
      .rejects.toThrow(ServiceError);
    await expect(PurchaseReceiveUseCase.receivePurchase('po-1', mockCtx))
      .rejects.toThrow('รายการนี้ได้รับสินค้าไปแล้ว');
  });

  it('should complete happy path and update stock', async () => {
    const mockPurchase = { id: 'po-1', purchaseNumber: 'PO-001', status: PurchaseStatus.ORDERED, items: [{ productId: 'prod-1', quantity: 10, costPrice: 100 }] };
    vi.mocked(db.purchase.findFirst).mockResolvedValueOnce(mockPurchase as any);
    txMock.purchase.findFirst.mockResolvedValue(mockPurchase as any);
    txMock.product.findMany.mockResolvedValueOnce([{ id: 'prod-1', stock: 5, costPrice: 100 }]);
    txMock.purchase.update.mockResolvedValueOnce({ ...mockPurchase, status: PurchaseStatus.RECEIVED });

    const result = await PurchaseReceiveUseCase.receivePurchase('po-1', mockCtx);

    expect(StockService.recordMovements).toHaveBeenCalled();
    expect(result.data.status).toBe(PurchaseStatus.RECEIVED);
  });
});
