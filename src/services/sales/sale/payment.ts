/**
 * sale-payment.use-case.ts — Payment verification and invoicing
 */
import { db, runInTransaction } from '@/lib/db';
import { Permission } from '@prisma/client';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { SALE_AUDIT_POLICIES } from '@/policies/sales/sale.policy';
import { SALES_TAGS } from '@/config/cache-tags';
import { buildLockData } from '@/lib/lock-helpers';
import {
  RequestContext,
  ServiceError,
  MutationResult,
  DocPaymentStatus,
  SaleStatus,
} from '@/types/domain';

export const SalePaymentUseCase = {
  async verifyPayment(saleId: string, legacyStatus: 'VERIFIED' | 'REJECTED', note: string | undefined, ctx: RequestContext): Promise<MutationResult<void>> {
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

        await (db as any).saleStatus.updateMany({
          where: { saleId },
          data: { paymentStatus: status as DocPaymentStatus },
        });
        await (db as any).salePaymentDetail.updateMany({
          where: { saleId },
          data: {
            paymentVerifiedAt: status === 'PAID' ? new Date() : null,
            paymentVerifiedBy: ctx.userId,
            paymentNote: note || null,
          },
        });
      }
    );

    return {
      data: undefined,
      affectedTags: [SALES_TAGS.LIST, SALES_TAGS.DETAIL(saleId)]
    };
  },

  async uploadPaymentProof(saleId: string, proofUrl: string, ctx: RequestContext): Promise<MutationResult<void>> {
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');
    if (sale.status === 'CANCELLED') throw new ServiceError('รายการนี้ถูกยกเลิกแล้ว');

    await db.sale.update({
      where: { id: saleId, shopId: ctx.shopId },
      data: { paymentProof: proofUrl, paymentStatusProof: 'PENDING' },
    });

    return {
      data: undefined,
      affectedTags: [SALES_TAGS.LIST, SALES_TAGS.DETAIL(saleId)]
    };
  },

  async generateInvoice(saleId: string, ctx: RequestContext, overrides?: any): Promise<MutationResult<{ invoiceNumber: string }>> {
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shopId } });
    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    const result = await AuditService.runWithAudit(
      ctx,
      {
        action: 'SALE_INVOICE_GENERATE',
        targetType: 'Sale',
        note: `ออกใบกำกับภาษีสำหรับรายการ ${sale.invoiceNumber}`,
      },
      async () => {
        return runInTransaction(undefined, async (prisma) => {
          await prisma.sale.update({
            where: { id: saleId, shopId: ctx.shopId },
            data: { status: SaleStatus.INVOICED, ...buildLockData('LOCKED', 'ออกใบกำกับภาษีแล้ว') },
          });

          await (prisma as any).saleStatus.updateMany({
            where: { saleId },
            data: {
              status:        SaleStatus.INVOICED,
              billingStatus: 'BILLED',
              editLockStatus:'LOCKED',
              lockReason:    'ออกใบกำกับภาษีแล้ว',
            },
          });

          return { invoiceNumber: sale.invoiceNumber };
        });
      }
    );

    return {
      data: result,
      affectedTags: [SALES_TAGS.LIST, SALES_TAGS.DETAIL(saleId)]
    };
  }
};
