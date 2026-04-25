import { db, runInTransaction } from '@/lib/db';
import { Prisma, Permission } from '@prisma/client';
import { SaleInput } from '@/schemas/sales/sale.schema';
import { StockService } from '@/services/inventory/stock.service';
import { NotificationService } from '@/services/core/intelligence/notification.service';
import { JournalService } from '@/services/accounting/journal.service';
import { money, calcSubtotal, calcProfit, toNumber } from '@/lib/money';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { DB_TIMEOUTS } from '@/lib/constants';

import {
  RequestContext,
  ServiceError,
  GetSalesParams,
  DocumentType,
  BookingStatus,
  SaleStatus,
  DocPaymentStatus,
  EditLockStatus,
  PaginatedResult,
  SaleListDTO,
  SaleDetailDTO,
  SerializedSale
} from '@/types/domain';
import { ISaleService } from '@/types/service-contracts';
import { SequenceService } from '@/services/core/system/sequence.service';
import { CustomerService } from './customer.service';
import { AuditService } from '@/services/core/system/audit.service';
import { SALE_AUDIT_POLICIES } from '@/policies/sales/sale.policy';
import { Security } from '@/services/core/iam/security.service';
import { WorkflowService } from '@/services/core/workflow/workflow.service';
import { SaleMapper } from '@/lib/mappers/sales.mapper';
import { SALE_CANCEL_REASONS, resolveReasonLabel, validateReason } from '@/config/reason-codes';

import { ComputationEngine, CalculationItemInput } from '@/services/core/finance/computation.service';
import { InvoiceService } from './invoice.service';

export interface CancelSaleInput {
  id: string;
  reasonCode: string;
  reasonDetail?: string;
}

export const SaleService: ISaleService = {
  /**
   * บันทึกการขายใหม่ พร้อมจองสต็อกอัตโนมัติ
   */
  async create(ctx: RequestContext, payload: SaleInput, tx?: Prisma.TransactionClient): Promise<SaleDetailDTO> {
    Security.requirePermission(ctx, 'SALE_CREATE');
    Security.assertSameShop(ctx, ctx.shopId);

    if (!ctx.memberId) {
      throw new ServiceError('ไม่สามารถสร้างรายการขายได้เนื่องจากไม่พบรหัสสมาชิก (memberId)');
    }
    const { items, customerAddress, ...saleData } = payload;

    if (items.length === 0) {
      throw new ServiceError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    return AuditService.runWithAudit(
      ctx,
      {
        ...SALE_AUDIT_POLICIES.CREATE(saleData.customerName || 'New Sale'),
        // Dynamic note with audit metadata
        note: `ลงบัญชีการขายใหม่: #${ctx.memberId || 'SYSTEM'}`,
      },
      async () => {
        return runInTransaction(tx, async (prisma) => {
          // 1. Generate Invoice Number
          const departmentCode = ctx.employeeDepartment || null;
          const invoiceNumber = await SequenceService.generate(ctx, DocumentType.SALE_INVOICE, prisma, {
            departmentCode: departmentCode || undefined,
          });

          // 2. Validate Products & Pre-check stock
          const productIds = items.map(item => item.productId);
          const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            // 🛡️ Bug #10 Fix: include isSaleable in select
            select: { id: true, name: true, stock: true, reservedStock: true, costPrice: true, packagingQty: true, isSaleable: true },
          });
          const productDataMap = new Map<string, any>(products.map(p => [p.id, p]));

          const stockErrors: string[] = [];
          for (const item of items) {
            const product = productDataMap.get(item.productId);
            if (!product) {
              stockErrors.push(`ไม่พบสินค้า ID: ${item.productId}`);
              continue;
            }
            // 🛡️ Bug #10 Fix: check isSaleable flag
            if (product.isSaleable === false) {
              stockErrors.push(`"${product.name}" ไม่ได้เปิดให้ขาย กรุณาติดต่อผู้ดูแลระบบ`);
              continue;
            }
            const available = Number(money.subtract(product.stock, product.reservedStock || 0));
            if (available < item.quantity) {
              stockErrors.push(`"${product.name}" มีสต็อกไม่พอ (ต้องการ ${item.quantity}, มีอยู่ ${available})`);
            }
          }

          if (stockErrors.length > 0) {
            throw new ServiceError(stockErrors.join('\n'));
          }

          // ⚡ High-Speed Snapshot BEFORE (Zero extra Queries)
          const beforeSnapshot = products.map(p => ({
            id: p.id,
            name: p.name,
            stock: Number(p.stock),
            reservedStock: Number(p.reservedStock || 0)
          }));

          // 3. Calculate Totals via Central Engine
          const computationItems: CalculationItemInput[] = items.map(item => {
            const product = productDataMap.get(item.productId)!;
            return {
              qty: item.quantity,
              unitPrice: item.salePrice,
              costPrice: toNumber(product.costPrice),
              lineDiscount: item.discountAmount || 0,
            };
          });

          const calculation = ComputationEngine.calculateTotals(
            computationItems,
            { type: saleData.discountType as any, value: saleData.discountValue || 0 },
            { 
              rate: Number(saleData.taxRate) || 0,
              mode: saleData.taxMode === 'NO_VAT' ? 'EXCLUSIVE' : (saleData.taxMode as any),
              kind: saleData.taxMode === 'NO_VAT' ? 'NO_VAT' : 'VAT' as any
            }
          );

          const saleItemsToCreate = calculation.lines.map((res, idx) => ({
            productId: items[idx].productId,
            quantity: res.qty,
            packagingQty: productDataMap.get(items[idx].productId)!.packagingQty || 1,
            salePrice: res.unitPrice,
            costPrice: res.costPrice,
            subtotal: res.lineNet,
            profit: res.lineProfit,
            discountAmount: res.lineDiscount,
            taxAmount: res.taxAmount,
            taxableAmount: res.taxableBase,
          }));

          // SSOT: Use SALE_ORDER (SO) as the primary identifier for Sales (Orders)
          const orderNumber = await SequenceService.generate(ctx, DocumentType.SALE_ORDER, prisma);

          const { totals } = calculation;
          // SSOT: Use netAmount as the final bill total for UI list consistency
          const netAmount = totals.netAmount;
          const totalAmount = totals.subtotalAmount;
          const totalCost = totals.totalCost;
          const billDiscountAmount = totals.billDiscountAmount;
          const taxAmount = totals.taxAmount;
          const taxableAmount = totals.taxableBaseAmount;

          // 4. Handle Customer & Credit
          let finalCustomerId = saleData.customerId;
          if (finalCustomerId) {
            await CustomerService.checkCreditLimit(finalCustomerId, netAmount, ctx, prisma);
          }

          // 5. Create Sale
          const sale = await prisma.sale.create({
            data: {
              customerId: finalCustomerId || null,
              userId: ctx.userId,
              memberId: ctx.memberId || null,
              shopId: ctx.shopId,
              invoiceNumber: orderNumber,
              date: saleData.date ? new Date(saleData.date) : new Date(),
              paymentMethod: saleData.paymentMethod,
              notes: saleData.notes || null,
              departmentCode: departmentCode || undefined,
              totalAmount,
              totalCost,
              profit: totals.totalProfit,
              taxMode: saleData.taxMode,
              taxRate: saleData.taxRate,
              taxAmount: totals.taxAmount,
              taxableAmount: totals.taxableBaseAmount,
              discountType: saleData.discountType,
              discountValue: saleData.discountValue,
              discountAmount: billDiscountAmount,
              netAmount,
              paymentStatus: (saleData.paymentMethod === 'CREDIT' ? 'UNPAID' : 'PAID') as DocPaymentStatus,
              items: { create: saleItemsToCreate },
              status: SaleStatus.CONFIRMED,
              bookingStatus: BookingStatus.RESERVED,
              salesFlowMode: 'ERP',
            } as Prisma.SaleUncheckedCreateInput,
            include: { items: true, customer: true },
          });

          // ⚡ Optimized Bulk Stock Reservation (Single process, single audit)
          await StockService.bulkReserveStock(sale.items, ctx, prisma);

          // ⚡ Optimized Snapshot AFTER (Calculated in-memory to save DB round-trips)
          const afterSnapshot = products.map(p => {
            const item = items.find(i => i.productId === p.id);
            const qty = item ? Number(item.quantity) : 0;
            return {
              id: p.id,
              name: p.name,
              stock: Number(p.stock) - qty, // Physical stock is now deducted
              reservedStock: Number(p.reservedStock || 0) // Reservation released
            };
          });

          // Attach evidence to the current audit context
          (ctx as any).auditMetadata = {
            before: { inventoryBefore: beforeSnapshot },
            after: { inventoryAfter: afterSnapshot }
          };

          return SaleMapper.toDetailDTO(sale, ctx);
        }, { timeout: DB_TIMEOUTS.EXTENDED }).then(async (result) => {
          // 7. Notification (Outside transaction = SAFE)
          NotificationService.create({
            shopId: ctx.shopId,
            type: 'NEW_SALE',
            severity: 'INFO',
            title: `ยอดขายใหม่ ${result.invoiceNumber}`,
            message: `ยอดรวม ${result.netAmount} บาท`,
            link: `/sales/${result.id}`,
          }).catch(() => { });

          return result;
        });
      }
    );
  },

  async update(id: string, ctx: RequestContext, payload: any): Promise<SaleDetailDTO> {
    Security.require(ctx, 'SALE_UPDATE' as Permission);
    const sale = await db.sale.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    WorkflowService.canSaleAction(sale as any, 'UPDATE');

    return AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.UPDATE(sale.invoiceNumber, payload),
      async () => {
        const isLocked = ((sale as any).editLockStatus === EditLockStatus.LOCKED) || sale.isLocked;

        if (isLocked) {
          try {
            Security.require(ctx, Permission.SALE_EDIT_LOCKED);
          } catch (e) {
            const { notes, paymentMethod, channel } = payload;
            const updated = await db.sale.update({
              where: { id, shopId: ctx.shopId },
              data: {
                notes: notes ?? sale.notes,
                paymentMethod: paymentMethod ?? sale.paymentMethod,
                channel: channel ?? sale.channel,
              },
              include: { items: true, customer: true },
            });
            return SaleMapper.toDetailDTO(updated, ctx);
          }
        }

        const updated = await db.sale.update({
          where: { id, shopId: ctx.shopId },
          data: payload,
          include: { items: true, customer: true },
        });

        return SaleMapper.toDetailDTO(updated, ctx);
      }
    );
  },

  async delete(id: string, ctx: RequestContext): Promise<void> {
    return this.cancel({ id, reasonCode: 'SYSTEM_DELETE', reasonDetail: 'Deleted by user' }, ctx);
  },

  async getList(params: GetSalesParams = {}, ctx: RequestContext): Promise<PaginatedResult<SaleListDTO>> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod, channel, status } = params;

    const searchFilter = buildSearchFilter(search, ['invoiceNumber', 'customerName', 'notes']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where = {
      shopId: ctx.shopId,
      ...(searchFilter && searchFilter),
      ...(dateFilter && { date: dateFilter }),
      ...(paymentMethod && { paymentMethod }),
      ...(channel && { channel }),
      ...(status && { status }),
      ...(params.salesFlowMode && { salesFlowMode: params.salesFlowMode as any }),
    };

    const result = await paginatedQuery(db.sale, {
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        customer: true,
      },
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    return {
      ...result,
      data: result.data.map((sale: any) => SaleMapper.toListDTO(sale)),
    };
  },

  async getById(id: string, ctx: RequestContext): Promise<SaleDetailDTO> {
    Security.require(ctx, Permission.SALE_VIEW);

    const sale = await db.sale.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true, stock: true, reservedStock: true, packagingQty: true } } } },
        customer: true,
        shipments: {
          select: {
            id: true, shipmentNumber: true, status: true, trackingNumber: true, shippingProvider: true, shippingCost: true,
          },
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!sale) throw new ServiceError('ไม่พบข้อมูลการขาย');

    return SaleMapper.toDetailDTO(sale, ctx);
  },

  async getTodayAggregate(ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<{ totalSales: number; saleCount: number; profit?: number }> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { canViewProfit = false } = options;
    if (canViewProfit) Security.require(ctx, Permission.SALE_VIEW_PROFIT);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      _sum: { netAmount: true, profit: true },
      _count: true,
    });

    return {
      totalSales: Number(result._sum.netAmount) || 0,
      profit: canViewProfit ? (Number(result._sum.profit) || 0) : undefined,
      saleCount: result._count,
    };
  },

  async getRecentList(limit: number, ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<SerializedSale[]> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { canViewProfit = false } = options;
    if (canViewProfit) Security.require(ctx, Permission.SALE_VIEW_PROFIT);

    const sales = await db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        // 🛡️ Bug #8 Fix: exclude cancelled sales from dashboard recent list
        status: { not: 'CANCELLED' },
      },
      include: {
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sales.map(sale => SaleMapper.toListDTO(sale)) as any;
  },

  async cancel(input: CancelSaleInput, ctx: RequestContext): Promise<void> {
    Security.require(ctx, Permission.SALE_CANCEL);
    const { id, reasonCode, reasonDetail } = input;

    if (!reasonCode) throw new ServiceError('กรุณาเลือกเหตุผลในการยกเลิก');
    validateReason(SALE_CANCEL_REASONS, reasonCode, reasonDetail);
    const cancelReason = resolveReasonLabel(SALE_CANCEL_REASONS, reasonCode, reasonDetail);

    // Outer read: for audit label only (does not participate in cancel logic)
    const sale = await db.sale.findFirst({
      where: { id, shopId: ctx.shopId },
      select: { invoiceNumber: true, status: true },
    });
    if (!sale) throw new ServiceError('ไม่พบข้อมูลการขาย');
    if (sale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

    await AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.CANCEL(sale.invoiceNumber, cancelReason),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          // 🛡️ Bug #4 Fix: Atomic status flip as FIRST operation in transaction
          // Only proceeds if status is NOT already CANCELLED — DB-level race condition guard
          const userNameResult = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
          const claimResult = await prisma.sale.updateMany({
            where: { id, shopId: ctx.shopId, status: { not: 'CANCELLED' } },
            data: {
              status: 'CANCELLED' as SaleStatus,
              cancelledAt: new Date(),
              cancelledBy: userNameResult?.name || 'System',
              cancelReason,
            },
          });

          // If count === 0, another concurrent request already cancelled this sale
          if (claimResult.count === 0) {
            throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว (Concurrent Cancel Conflict)');
          }

          // --- All operations below are safe: we own the cancel ---
          // Fetch full sale data for stock release
          const fullSale = await prisma.sale.findFirst({
            where: { id, shopId: ctx.shopId },
            include: { items: { include: { returnItems: { select: { quantity: true } } } } },
          });
          if (!fullSale) throw new ServiceError('ไม่พบข้อมูลการขาย');

          if ((fullSale as any).editLockStatus === EditLockStatus.LOCKED) {
            // Undo the atomic flip — revert because cancel is not allowed
            await prisma.sale.update({
              where: { id, shopId: ctx.shopId },
              data: { status: 'CONFIRMED' as SaleStatus, cancelledAt: null, cancelledBy: null, cancelReason: null },
            });
            throw new ServiceError((fullSale as any).lockReason || 'เอกสารนี้ถูกล็อก ไม่สามารถยกเลิกได้');
          }

          // Reverse related journal entries
          const relatedJournals = await prisma.journalEntry.findMany({
            where: { shopId: ctx.shopId, sourceId: id, status: 'POSTED' },
          });
          for (const journal of relatedJournals) {
            await JournalService.reverseEntry(ctx, journal.id, prisma);
          }

          // Cancel linked shipments
          const linkedShipments = await prisma.shipment.findMany({
            where: { saleId: id, status: { not: 'CANCELLED' } },
            select: { id: true, shipmentNumber: true },
          });
          for (const linkedShipment of linkedShipments) {
            await prisma.shipment.update({
              where: { id: linkedShipment.id, shopId: ctx.shopId },
              data: { status: 'CANCELLED', notes: `ยกเลิกอัตโนมัติ: Sale ${fullSale.invoiceNumber} ถูกยกเลิก` },
            });
            await prisma.expense.deleteMany({
              where: { shopId: ctx.shopId, category: 'ค่าจัดส่ง', description: { contains: linkedShipment.shipmentNumber } },
            });
          }

          await prisma.return.updateMany({
            where: { saleId: id, shopId: ctx.shopId, status: { not: 'CANCELLED' } },
            data: { status: 'CANCELLED' },
          });

          // Stock release based on booking state
          if (fullSale.bookingStatus === BookingStatus.RESERVED) {
            await Promise.all(fullSale.items.map(item => {
              const alreadyReturned = item.returnItems.reduce((sum: number, ri: any) => sum + ri.quantity, 0);
              const releaseQty = item.quantity - alreadyReturned;
              if (releaseQty > 0) return StockService.releaseStock(item.productId, releaseQty, ctx, prisma);
              return Promise.resolve();
            }));
          } else if (fullSale.bookingStatus === BookingStatus.DEDUCTED) {
            const movements = fullSale.items
              .map(item => {
                const restoreQty = item.quantity - item.returnItems.reduce((sum: number, ri: any) => sum + ri.quantity, 0);
                return restoreQty > 0 ? {
                  productId: item.productId,
                  type: 'SALE_CANCEL' as const,
                  quantity: restoreQty,
                  saleId: fullSale.id,
                  userId: ctx.userId,
                  shopId: fullSale.shopId || ctx.shopId,
                  note: `ยกเลิกการขาย ${fullSale.invoiceNumber} - ${cancelReason}`,
                } : null;
              })
              .filter(Boolean) as any[];

            if (movements.length > 0) await StockService.recordMovements(ctx, movements, prisma);
          }
        });
      }
    );
  },

  async verifyPayment(saleId: string, legacyStatus: 'VERIFIED' | 'REJECTED', note: string | undefined, ctx: RequestContext): Promise<void> {
    const status = legacyStatus === 'VERIFIED' ? 'PAID' : 'UNPAID';
    Security.requirePermission(ctx, Permission.FINANCE_VIEW_LEDGER);
    const existingSale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });

    if (!existingSale) throw new ServiceError('ไม่พบรายการขาย');
    if (existingSale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกแล้ว');

    await AuditService.runWithAudit(
      ctx,
      {
        ...SALE_AUDIT_POLICIES.PAYMENT(existingSale.invoiceNumber, status, note || ''),
        getBefore: async () => existingSale,
      },
      async () => {
        await db.sale.update({
          where: { id: saleId, shopId: ctx.shopId },
          data: {
            paymentStatus: status as DocPaymentStatus,
            paymentVerifiedAt: status === 'PAID' ? new Date() : null,
            paymentVerifiedBy: ctx.userId,
            paymentNote: note || null,
          },
        });
      }
    );
  },

  async uploadPaymentProof(saleId: string, proofUrl: string, ctx: RequestContext): Promise<void> {
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');
    if (sale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกแล้ว');

    await db.sale.update({
      where: { id: saleId, shopId: ctx.shopId },
      // 🛡️ Bug #3 Fix: was incorrectly setting VOIDED — should be PENDING (awaiting verification)
      data: { paymentProof: proofUrl, paymentStatusProof: 'PENDING' },
    });
  },

  async confirmOrder(saleId: string, ctx: RequestContext): Promise<void> {
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    return AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.CONFIRM(sale.invoiceNumber),
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          const fullSale = await prisma.sale.findFirst({
            where: { id: saleId, shopId: ctx.shopId },
            include: { items: true, customer: true },
          });

          if (!fullSale) throw new ServiceError('ไม่พบรายการขาย');
          if (fullSale.status !== SaleStatus.DRAFT) throw new ServiceError('รายการนี้ไม่ได้อยู่ในสถานะร่าง');

          await StockService.bulkReserveStock(fullSale.items, ctx, prisma);

          await prisma.sale.update({
            where: { id: saleId, shopId: ctx.shopId },
            data: { status: SaleStatus.CONFIRMED, bookingStatus: BookingStatus.RESERVED },
          });
        });
      }
    );
  },

  async generateInvoice(saleId: string, ctx: RequestContext, overrides?: any): Promise<{ invoiceNumber: string }> {
    return runInTransaction(undefined, async (prisma) => {
      const sale = await prisma.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
      if (!sale) throw new ServiceError('ไม่พบรายการขาย');

      await prisma.sale.update({
        where: { id: saleId, shopId: ctx.shopId },
        data: { status: SaleStatus.INVOICED, isLocked: true },
      });

      return { invoiceNumber: sale.invoiceNumber };
    });
  },

  async completeSale(saleId: string, ctx: RequestContext, tx?: Prisma.TransactionClient): Promise<void> {
    // 🛡️ Fix: Use tx if available — avoids requesting a new connection while one is already held
    const client = tx || db;
    const sale = await client.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    return AuditService.runWithAudit(
      ctx,
      SALE_AUDIT_POLICIES.COMPLETE(sale.invoiceNumber),
      async () => {
        return runInTransaction(tx, async (prisma) => {
          const fullSale = await prisma.sale.findFirst({
            where: { id: saleId, shopId: ctx.shopId },
            include: { items: true, customer: true },
          });

          if (!fullSale) throw new ServiceError('ไม่พบรายการขาย');
          if (fullSale.status === SaleStatus.COMPLETED) return;

          if (fullSale.paymentStatus === DocPaymentStatus.UNPAID) {
            throw new ServiceError(
              'กรุณายืนยันการชำระเงินก่อนปิดการขาย',
              undefined,
              { label: 'ไปที่หน้าตรวจสอบการชำระเงิน', href: `/sales/${saleId}` }
            );
          }

          await StockService.bulkDeductStock(fullSale.items, ctx, prisma, { saleId });

          await prisma.sale.update({
            where: { id: saleId, shopId: ctx.shopId },
            data: {
              status: SaleStatus.COMPLETED,
              bookingStatus: BookingStatus.DEDUCTED,
              isLocked: true,
            },
          });

          // ERP: Automated COGS Posting (Industrial Phase 5)
          try {
            const fullSaleWithItems = await prisma.sale.findFirst({
              where: { id: saleId },
              include: { items: true }
            });
            if (fullSaleWithItems) {
              const PostingModule = await import('../accounting/posting-engine.service');
              await PostingModule.PostingService.postCOGS(ctx, fullSaleWithItems, prisma);
            }
          } catch (e) {
            console.error('COGS Posting failed:', e);
          }
        });
      },
      tx // 🛡️ Fix: Pass tx so AuditLog.create uses the same connection
    );
  },

  async getLockedFields(saleId: string, ctx: RequestContext): Promise<string[]> {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
      select: { status: true, isLocked: true },
    });

    if (!sale) return [];

    const locked = [];
    if (sale.isLocked || sale.status === SaleStatus.INVOICED || sale.status === SaleStatus.COMPLETED) {
      locked.push('items', 'customerId', 'discountType', 'discountValue');
    }
    if (sale.status === SaleStatus.COMPLETED) {
      locked.push('paymentMethod', 'notes');
    }

    return locked;
  },

  async releaseStock(saleId: string, ctx: RequestContext, tx: Prisma.TransactionClient): Promise<void> {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
      include: { items: true },
    });

    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    if (sale.bookingStatus === BookingStatus.RESERVED) {
      await StockService.bulkReleaseStock(sale.items, ctx, tx);

      await tx.sale.update({
        where: { id: saleId, shopId: ctx.shopId },
        data: { bookingStatus: BookingStatus.NONE },
      });
    }
  }
};
