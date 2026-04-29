import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { toNumber, money } from '@/lib/money';
import { Security } from '@/services/core/iam/security.service';
import { Permission } from '@prisma/client';
import { WhtService } from '@/services/tax/wht.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { PostingService } from '@/services/accounting/posting-engine.service';
import { JournalService } from '@/services/accounting/journal.service';
import { DocumentType } from '@/types/domain';
import { Decimal } from '@prisma/client/runtime/library';

// Use type assertions for Prisma enums due to potential environment generator lag
const PaymentStatus = { POSTED: 'POSTED', VOIDED: 'VOIDED' } as any;
const DocPaymentStatus = { UNPAID: 'UNPAID', PARTIAL: 'PARTIAL', PAID: 'PAID' } as any;

export interface PaymentInput {
    invoiceId?: string;
    saleId?: string;
    purchaseId?: string;
    expenseId?: string;
    amount: number; // This will be the GROSS amount (debt reduction)
    paymentMethodCode: string;
    paymentDate?: Date;
    referenceId?: string;
    note?: string;
    // WHT Fields (Phase T5)
    whtCodeId?: string;
    isGrossUp?: boolean;
}

export const PaymentService = {
    /**
     * Record a new payment entry in the ledger.
     * Atomic operation that updates the parent document's financial snapshots.
     */
    async recordPayment(data: PaymentInput, ctx: RequestContext) {
        Security.require(ctx, Permission.INVOICE_CREATE); // Recording payment is part of billing flow

        // 1. Validation: Parent XOR Check (exactly one parent)
        const parents = [data.invoiceId, data.saleId, data.purchaseId, data.expenseId].filter(Boolean);
        if (parents.length !== 1) {
            throw new ServiceError('รายการชำระต้องระบุเอกสารอ้างอิงเพียงหนึ่งอย่าง (Invoice, Sale, Purchase หรือ Expense)');
        }

        // 2. Validation: Amount
        if (data.amount <= 0) {
            throw new ServiceError('ยอดชำระต้องมากกว่า 0');
        }

        return await (db as any).$transaction(async (tx: any) => {
            // 3. Load Parent & Validate Shop/Status
            let parent: any = null;
            if (data.invoiceId) {
                parent = await (tx as any).invoice.findFirst({
                    where: { id: data.invoiceId, shopId: ctx.shopId },
                });
                if (!parent) throw new ServiceError('ไม่พบ Invoice หรือไม่มีสิทธิ์เข้าถึง');
                if (parent.status === 'CANCELLED') throw new ServiceError('ไม่สามารถรับชำระสำหรับ Invoice ที่ถูกยกเลิกแล้ว');
            } else if (data.saleId) {
                parent = await (tx as any).sale.findFirst({
                    where: { id: data.saleId, shopId: ctx.shopId },
                });
                if (!parent) throw new ServiceError('ไม่พบรายการขาย หรือไม่มีสิทธิ์เข้าถึง');
                if (parent.status === 'CANCELLED') throw new ServiceError('ไม่สามารถรับชำระสำหรับรายการขายที่ถูกยกเลิกแล้ว');
            } else if (data.purchaseId) {
                parent = await (tx as any).purchase.findFirst({
                    where: { id: data.purchaseId, shopId: ctx.shopId },
                });
                if (!parent) throw new ServiceError('ไม่พบรายการสั่งซื้อ หรือไม่มีสิทธิ์เข้าถึง');
                if (parent.status === 'CANCELLED') throw new ServiceError('ไม่สามารถชำระเงินสำหรับรายการสั่งซื้อที่ถูกยกเลิกแล้ว');
            } else if (data.expenseId) {
                parent = await (tx as any).expense.findFirst({
                    where: { id: data.expenseId, shopId: ctx.shopId },
                });
                if (!parent) throw new ServiceError('ไม่พบรายการค่าใช้จ่าย หรือไม่มีสิทธิ์เข้าถึง');
            }

            // 4. Overpayment Check (Anti-Overpay Rule)
            const currentResidual = toNumber(parent.residualAmount);
            if (data.amount > currentResidual) {
                throw new ServiceError(`ยอดชำระเกินจำนวนที่ค้างอยู่ (คงค้าง: ${currentResidual.toLocaleString()} THB)`);
            }

            // 5. Generate Payment Number
            const paymentNo = await SequenceService.generate(ctx, DocumentType.PAYMENT, tx);

            // 6. Resolve Polymorphic documentType
            const documentType = data.invoiceId  ? 'INVOICE'
                               : data.saleId     ? 'SALE'
                               : data.purchaseId ? 'PURCHASE'
                               : 'EXPENSE';
            const documentId = (data.invoiceId ?? data.saleId ?? data.purchaseId ?? data.expenseId)!;

            // 7. Create Ledger Entry (legacy FKs kept for transition)
            const payment = await (tx as any).payment.create({
                data: {
                    shopId:           ctx.shopId,
                    memberId:         ctx.memberId!,
                    paymentNo,
                    type:             'IN',
                    amount:           data.amount,
                    paymentMethodCode: data.paymentMethodCode,
                    paymentDate:      data.paymentDate || new Date(),
                    referenceId:      data.referenceId,
                    note:             data.note,
                    status:           'POSTED',
                    // ⚠️ Legacy FKs — Transition Period Only (Phase 4 cleanup)
                    invoiceId:        data.invoiceId,
                    saleId:           data.saleId,
                    purchaseId:       data.purchaseId,
                    expenseId:        data.expenseId,
                },
            });

            // 8. Create Polymorphic Allocation (SSOT for balance calc)
            await (tx as any).paymentAllocation.create({
                data: {
                    shopId:       ctx.shopId,
                    paymentId:    payment.id,
                    documentType,
                    documentId,
                    amount:       data.amount,
                    // mirror legacy FKs during transition
                    invoiceId:    data.invoiceId,
                    saleId:       data.saleId,
                    purchaseId:   data.purchaseId,
                    expenseId:    data.expenseId,
                },
            });

            // 7. Post to Accounting Ledger (Phase A1.3)
            await PostingService.postPayment(ctx, payment, tx);

            // 5.1 Handle WHT (Phase T5) - Refactored for SSOT
            if (data.whtCodeId) {
                const whtCode = await (tx as any).whtCode.findUnique({
                    where: { id: data.whtCodeId }
                });

                if (!whtCode) throw new ServiceError('ไม่พบรหัสภาษีหัก ณ ที่จ่าย');

                // Get Partner Tax Profile
                const partnerId = parent.customerId || parent.supplierId;
                if (!partnerId) throw new ServiceError('ไม่พบข้อมูลคู่ค้าสำหรับหัก ณ ที่จ่าย');

                const partner = await (tx as any).partnerTaxProfile.findUnique({
                    where: { partnerId }
                });

                if (!partner) throw new ServiceError('กรุณาตั้งค่าข้อมูลภาษีของคู่ค้าก่อนทำรายการหัก ณ ที่จ่าย');

                const whtCalc = WhtService.calculate({
                    amount: data.amount,
                    rate: whtCode.rate,
                    isGrossUp: data.isGrossUp
                });

                await WhtService.createEntry(ctx, {
                    paymentId: payment.id,
                    partnerId: partnerId,
                    payeeNameSnapshot: partner.registeredName,
                    payeeTaxIdSnapshot: partner.taxId,
                    payeeBranchSnapshot: partner.branchCode,
                    payeeTypeSnapshot: partner.payeeType,
                    whtCodeId: whtCode.id,
                    formTypeSnapshot: whtCode.formType,
                    incomeCategorySnapshot: whtCode.incomeCategory,
                    rateSnapshot: whtCode.rate,
                    ...whtCalc,
                    paymentDate: payment.paymentDate
                }, tx);
            }

            // 9. Sync Snapshots via Polymorphic target
            await this.recalculateDocumentBalance({ documentType, documentId }, tx);

            // 10. Audit Log
            await AuditService.runWithAudit(ctx, {
                action: AUDIT_ACTIONS.PAYMENT_RECORD,
                targetType: 'Payment',
                targetId: payment.id,
                note: `ชำระเงินจำนวน ${data.amount} THB สำหรับ ${documentType}${data.whtCodeId ? ' (รวมหัก ณ ที่จ่าย)' : ''}`,
            }, async () => payment, tx);

            return payment;
        }, { timeout: 20000 });
    },

    /**
     * Void a payment entry. No hard delete.
     * Updates balance to reflect the removal of this payment.
     */
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

            // 0. Find and reverse Accounting Journal (Phase A1.5)
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

            // 1. Void Linked WHT Entry & Certificate (Phase T5)
            const whtEntry = await (tx as any).whtEntry.findUnique({
                where: { paymentId }
            });

            if (whtEntry) {
                await (tx as any).whtEntry.update({
                    where: { id: whtEntry.id },
                    data: { status: 'VOIDED' }
                });

                // Also void if a certificate was issued
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

            // Sync Snapshots via Polymorphic target (read from first allocation)
            const firstAlloc = await (tx as any).paymentAllocation.findFirst({
                where: { paymentId: existing.id },
            });
            if (firstAlloc?.documentType && firstAlloc?.documentId) {
                await this.recalculateDocumentBalance(
                    { documentType: firstAlloc.documentType, documentId: firstAlloc.documentId },
                    tx
                );
            }

            // Audit Log
            await AuditService.runWithAudit(ctx, {
                action: AUDIT_ACTIONS.PAYMENT_VOID,
                targetType: 'Payment',
                targetId: paymentId,
                beforeSnapshot: () => existing,
                note: `ยกเลิกการชำระเงิน ${existing.paymentNo || paymentId}`,
            }, async () => updated, tx);

            return updated;
        }, { timeout: 20000 });
    },

    /**
     * Re-synchronizes payment snapshots via Polymorphic Junction.
     * Single SSOT path — no more if/else COALESCE chains.
     */
    async recalculateDocumentBalance(
        target: { documentType: string; documentId: string },
        tx: any = db
    ) {
        const { documentType, documentId } = target;

        // 1. Sum all POSTED allocations for this document (Polymorphic SSOT)
        const allocations = await (tx as any).paymentAllocation.findMany({
            where: {
                documentType,
                documentId,
                payment: { status: 'POSTED' },
            },
        });

        const totalPaid = allocations.reduce(
            (sum: number, a: any) => money.add(sum, toNumber(a.amount)),
            0
        );

        // 2. Resolve parent model dynamically (no if/else needed for new types)
        const modelMap: Record<string, any> = {
            INVOICE:  (tx as any).invoice,
            SALE:     (tx as any).sale,
            PURCHASE: (tx as any).purchase,
            EXPENSE:  (tx as any).expense,
        };
        const updateModel = modelMap[documentType];
        if (!updateModel) throw new Error(`Unknown documentType: ${documentType}`);

        const parent = await updateModel.findUnique({ where: { id: documentId } });
        if (!parent) return; // Document deleted — skip silently

        // 3. Calculate residual
        const totalAmount = toNumber(parent.netAmount ?? parent.totalAmount);
        const residualAmount = Math.max(0, totalAmount - totalPaid);

        // 4. Determine Status
        let status: any = 'UNPAID';
        if (totalPaid >= totalAmount)  status = 'PAID';
        else if (totalPaid > 0)        status = 'PARTIAL';

        // 5. Update Snapshots
        await updateModel.update({
            where: { id: documentId },
            data: {
                paidAmount:     totalPaid,
                residualAmount,
                paymentStatus:  status,
                // Sale-specific: sync billingStatus
                ...(documentType === 'SALE' && {
                    billingStatus: status === 'PAID' ? 'PAID' : status === 'PARTIAL' ? 'BILLED' : 'UNBILLED',
                }),
            },
        });
    },

    /**
     * Get payment history for a specific document.
     */
    async getPaymentHistory(target: { invoiceId?: string; saleId?: string }, ctx: RequestContext) {
        Security.requireAny(ctx, [Permission.INVOICE_VIEW, Permission.FINANCE_VIEW_LEDGER]);
        const where = {
            shopId: ctx.shopId,
            ...(target.invoiceId ? { invoiceId: target.invoiceId } : { saleId: target.saleId }),
        };

        return await (db as any).payment.findMany({
            where,
            orderBy: { paymentDate: 'desc' },
            include: {
                member: true,
            },
        });
    },
};
