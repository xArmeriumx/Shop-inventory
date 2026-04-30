import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { Permission } from '@prisma/client';
import { JournalService } from '@/services/accounting/journal.service';
import { PaymentRecalculateEngine } from './recalculate.engine';

export const PaymentVoid = {
    async voidPayment(paymentId: string, ctx: RequestContext) {
        Security.require(ctx, Permission.FINANCE_PAYMENT_VOID);
        const existing = await (db as any).payment.findFirst({
            where: { id: paymentId, shopId: ctx.shopId },
        });

        if (!existing) throw new ServiceError('ไม่พบรายการชำระ');
        if (existing.status === 'VOIDED') throw new ServiceError('รายการนี้ถูกยกเลิกไปแล้ว');

        return await (db as any).$transaction(async (tx: any) => {
            const updated = await (tx as any).payment.update({
                where: { id: paymentId },
                data: { status: 'VOIDED' },
            });

            const journal = await (tx as any).journalEntry.findFirst({
                where: {
                    shopId: ctx.shopId,
                    sourceType: 'PAYMENT_RECEIPT',
                    sourceId: paymentId,
                    postingPurpose: 'PAYMENT_POST',
                    status: 'POSTED'
                }
            });

            if (journal) {
                await JournalService.reverseEntry(ctx, journal.id, tx);
            }

            const whtEntry = await (tx as any).whtEntry.findUnique({
                where: { paymentId }
            });

            if (whtEntry) {
                await (tx as any).whtEntry.update({
                    where: { id: whtEntry.id },
                    data: { status: 'VOIDED' }
                });

                const cert = await (tx as any).whtCertificate.findUnique({
                    where: { whtEntryId: whtEntry.id }
                });

                if (cert) {
                    await (tx as any).whtCertificate.update({
                        where: { id: cert.id },
                        data: { status: 'VOIDED' }
                    });
                }
            }

            const firstAlloc = await (tx as any).paymentAllocation.findFirst({
                where: { paymentId: existing.id },
            });
            if (firstAlloc?.documentType && firstAlloc?.documentId) {
                await PaymentRecalculateEngine.recalculateDocumentBalance(
                    { documentType: firstAlloc.documentType, documentId: firstAlloc.documentId },
                    tx
                );
            }

            await AuditService.runWithAudit(ctx, {
                action: AUDIT_ACTIONS.PAYMENT_VOID,
                targetType: 'Payment',
                targetId: paymentId,
                beforeSnapshot: () => existing,
                note: `ยกเลิกการชำระเงิน ${existing.paymentNo || paymentId}`,
            }, async () => updated, tx);

            return updated;
        }, { timeout: 20000 });
    }
};
