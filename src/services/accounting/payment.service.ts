import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { AuditService } from '@/services/core/system/audit.service';
import { toNumber, money } from '@/lib/money';
import { Security } from '@/services/core/iam/security.service';
import { type Permission } from '@prisma/client';
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
        Security.require(ctx, 'INVOICE_CREATE' as any); // Logic: recording payment is usually part of billing

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

            // 5. Generate Payment Number (Professional RCP-XXXX)
            const paymentNo = await SequenceService.generate(ctx, DocumentType.PAYMENT, tx);

            // 6. Create Ledger Entry
            const payment = await (tx as any).payment.create({
                data: {
                    shopId: ctx.shopId,
                    memberId: ctx.memberId!,
                    invoiceId: data.invoiceId,
                    saleId: data.saleId,
                    paymentNo, // Added professional sequence
                    type: 'IN', // Phase 4 focusing on Receipts
                    amount: data.amount,
                    paymentMethodCode: data.paymentMethodCode,
                    paymentDate: data.paymentDate || new Date(),
                    referenceId: data.referenceId,
                    note: data.note,
                    status: 'POSTED',
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

            // 6. Sync Snapshots (Recalculate from Ledger)
            await this.recalculateDocumentBalance(
                data.invoiceId ? { invoiceId: data.invoiceId } : { saleId: data.saleId! },
                tx
            );

            // 7. Audit Log
            await AuditService.runWithAudit(ctx, {
                action: 'PAYMENT_RECORD',
                targetType: 'Payment',
                targetId: payment.id,
                note: `ชำระเงินจำนวน ${data.amount} THB สำหรับ ${data.invoiceId ? 'Invoice' : 'Sale'}${data.whtCodeId ? ' (รวมหัก ณ ที่จ่าย)' : ''}`,
            }, async () => payment, tx);

            return payment;
        }, { timeout: 20000 });
    },

    /**
     * Void a payment entry. No hard delete.
     * Updates balance to reflect the removal of this payment.
     */
    async voidPayment(paymentId: string, ctx: RequestContext) {
        Security.require(ctx, 'FINANCE_PAYMENT_VOID' as any);
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

            // Sync Snapshots
            await this.recalculateDocumentBalance(
                existing.invoiceId ? { invoiceId: existing.invoiceId } : { saleId: existing.saleId! },
                tx
            );

            // Audit Log
            await AuditService.runWithAudit(ctx, {
                action: 'PAYMENT_VOID',
                targetType: 'Payment',
                targetId: paymentId,
                beforeSnapshot: () => existing,
                note: 'User voided payment',
            }, async () => updated, tx);

            return updated;
        }, { timeout: 20000 });
    },

    /**
     * Re-synchronizes snapshots from the payment ledger.
     * This is the SSOT for residual totals.
     */
    async recalculateDocumentBalance(target: { invoiceId?: string; saleId?: string; purchaseId?: string }, tx: any = db) {
        const where = target.invoiceId ? { invoiceId: target.invoiceId } :
            target.purchaseId ? { purchaseId: target.purchaseId } :
                { saleId: target.saleId };

        // ERP Rule: Sum all allocations linked to this document via POSTED payments
        const allocations = await (tx as any).paymentAllocation.findMany({
            where: {
                ...where,
                payment: { status: 'POSTED' }
            },
        });

        // 1.1 Support legacy Payment records for backward compatibility (if any)
        // In the future, we should migrate all to allocations.
        const legacyPayments = await (tx as any).payment.findMany({
            where: {
                ...where,
                status: 'POSTED',
                allocations: { none: {} } // Only sum if no allocations exist for this payment
            },
        });

        const totalPaid = money.add(
            allocations.reduce((sum: number, a: any) => money.add(sum, toNumber(a.amount)), 0),
            legacyPayments.reduce((sum: number, p: any) => money.add(sum, toNumber(p.amount)), 0)
        );

        // Get parent total
        let parent: any = null;
        let updateModel: any = null;
        let parentId: string = '';

        if (target.invoiceId) {
            parent = await (tx as any).invoice.findUnique({ where: { id: target.invoiceId } });
            updateModel = (tx as any).invoice;
            parentId = target.invoiceId;
        } else if (target.saleId) {
            parent = await (tx as any).sale.findUnique({ where: { id: target.saleId } });
            updateModel = (tx as any).sale;
            parentId = target.saleId;
        } else if ((target as any).purchaseId) {
            parent = await (tx as any).purchase.findUnique({ where: { id: (target as any).purchaseId } });
            updateModel = (tx as any).purchase;
            parentId = (target as any).purchaseId;
        } else if ((target as any).expenseId) {
            parent = await (tx as any).expense.findUnique({ where: { id: (target as any).expenseId } });
            updateModel = (tx as any).expense;
            parentId = (target as any).expenseId;
        }

        const totalAmount = toNumber(parent.totalAmount);
        const residualAmount = Math.max(0, totalAmount - totalPaid);

        // Determine Status
        let status: any = 'UNPAID';
        if (totalPaid >= totalAmount) {
            status = 'PAID';
        } else if (totalPaid > 0) {
            status = 'PARTIAL';
        }

        // Update Snapshots
        await (updateModel as any).update({
            where: { id: parentId },
            data: {
                paidAmount: totalPaid,
                residualAmount: residualAmount,
                paymentStatus: status,
                // Sync legacy billingStatus if Sale
                ...(target.saleId && {
                    billingStatus: status === 'PAID' ? 'PAID' : status === 'PARTIAL' ? 'BILLED' : 'UNBILLED'
                })
            },
        });
    },

    /**
     * Get payment history for a specific document.
     */
    async getPaymentHistory(target: { invoiceId?: string; saleId?: string }, ctx: RequestContext) {
        Security.requireAny(ctx, ['INVOICE_VIEW', 'FINANCE_VIEW_LEDGER'] as any[]);
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
