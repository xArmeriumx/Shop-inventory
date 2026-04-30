import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaleCreateUseCase } from '@/services/sales/sale/create';
import { Security } from '@/services/core/iam/security.service';
import { ServiceError } from '@/types/domain';
import { StockService } from '@/services/inventory/stock.service';
import { AuditService } from '@/services/core/system/audit.service';
import { db } from '@/lib/db';

vi.mock('@/services/core/iam/security.service', () => ({
  Security: {
    requirePermission: vi.fn(),
    assertSameShop: vi.fn(),
  },
}));

vi.mock('@/services/core/system/sequence.service', () => ({
  SequenceService: {
    generate: vi.fn().mockResolvedValue('DOC-001'),
  },
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
    checkAvailability: vi.fn(),
  },
}));

vi.mock('@/services/inventory/stock-engine.service', () => ({
  StockEngine: {
    resolveWarehouse: vi.fn().mockResolvedValue('wh-1'),
  },
}));

const txMock = {
  shop: { findUnique: vi.fn() },
  customer: { upsert: vi.fn().mockResolvedValue({ id: 'cus-1' }), findFirst: vi.fn() },
  sale: { upsert: vi.fn(), create: vi.fn() },
  product: { findMany: vi.fn().mockResolvedValue([]) },
};

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(async (callback) => {
      return callback(txMock);
    }),
  },
  runInTransaction: vi.fn(async (tx, callback) => callback(txMock)),
}));

describe('SaleCreateUseCase', () => {
  const mockCtx: any = { shopId: 'shop-1', userId: 'user-1', memberId: 'mem-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw ServiceError if items are empty', async () => {
    const payload: any = { items: [] };

    await expect(SaleCreateUseCase.create(mockCtx, payload))
      .rejects.toThrow(ServiceError);
    await expect(SaleCreateUseCase.create(mockCtx, payload))
      .rejects.toThrow('ต้องมีสินค้าอย่างน้อย 1 รายการ');
  });

  it('should throw ServiceError if missing memberId for MEMBER type', async () => {
    const payload: any = { saleType: 'MEMBER', items: [{ productId: 'p1', quantity: 1, unitPrice: 100 }] };

    await expect(SaleCreateUseCase.create({ ...mockCtx, memberId: undefined }, payload))
      .rejects.toThrow('ไม่สามารถสร้างรายการขายได้เนื่องจากไม่พบรหัสสมาชิก (memberId)');
  });

  it('should throw ServiceError if stock validation fails', async () => {
    const payload: any = { saleType: 'GENERAL', items: [{ productId: 'p1', quantity: 10, unitPrice: 100 }] };
    
    txMock.product.findMany.mockResolvedValueOnce([{
      id: 'p1',
      name: 'Prod 1',
      stock: 5,
      reservedStock: 0,
      isSaleable: true,
      costPrice: 50,
      packagingQty: 1,
    }]);

    await expect(SaleCreateUseCase.create(mockCtx, payload))
      .rejects.toThrow('"Prod 1" มีสต็อกไม่พอ (ต้องการ 10, มีอยู่ 5)');
  });
});
