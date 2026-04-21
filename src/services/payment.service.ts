import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { AuditService } from './audit.service';
import { toNumber } from '@/lib/money';
import { Security } from './security';
import { type Permission } from '@prisma/client';

// Use type assertions for Prisma enums due to potential environment generator lag
const PaymentStatus = { POSTED: 'POSTED', VOIDED: 'VOIDED' } as any;
const DocPaymentStatus = { UNPAID: 'UNPAID', PARTIAL: 'PARTIAL', PAID: 'PAID' } as any;

export interface PaymentInput {
    invoiceId?: string;
    saleId?: string;
    amount: number;
    paymentMethodCode: string;
    paymentDate?: Date;
    referenceId?: string;
    note?: string;
}

export const PaymentService = {
    /**
     * Record a new payment entry in the ledger.
     * Atomic operation that updates the parent document's financial snapshots.
     */
    async recordPayment(data: PaymentInput, ctx: RequestContext) {
        Security.require(ctx, 'INVOICE_CREATE' as any); // Logic: recording payment is usually part of billing
        // 1. Validation: Parent XOR Check
        if ((data.invoiceId && data.saleId) || (!data.invoiceId && !data.saleId)) {
            throw new ServiceError('รายการชำระต้องระบุเอกสารอ้างอิงเพียงอย่างเดียว (Invoice หรือ Sale)');
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
            }

            // 4. Overpayment Check (Anti-Overpay Rule)
            const currentResidual = toNumber(parent.residualAmount);
            if (data.amount > currentResidual) {
                throw new ServiceError(`ยอดชำระเกินจำนวนที่ค้างอยู่ (คงค้าง: ${currentResidual.toLocaleString()} THB)`);
            }

            // 5. Create Ledger Entry
            const payment = await (tx as any).payment.create({
                data: {
                    shopId: ctx.shopId,
                    memberId: ctx.memberId!,
                    invoiceId: data.invoiceId,
                    saleId: data.saleId,
                    type: 'IN', // Phase 4 focusing on Receipts
                    amount: data.amount,
                    paymentMethodCode: data.paymentMethodCode,
                    paymentDate: data.paymentDate || new Date(),
                    referenceId: data.referenceId,
                    note: data.note,
                    status: 'POSTED',
                },
            });

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
                note: `ชำระเงินจำนวน ${data.amount} THB สำหรับ ${data.invoiceId ? 'Invoice' : 'Sale'}`,
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
    async recalculateDocumentBalance(target: { invoiceId?: string; saleId?: string }, tx: any = db) {
        const where = target.invoiceId ? { invoiceId: target.invoiceId } : { saleId: target.saleId };

        // Sum all POSTED payments
        const payments = await (tx as any).payment.findMany({
            where: { ...where, status: 'POSTED' },
        });

        const totalPaid = payments.reduce((sum: number, p: any) => sum + toNumber(p.amount), 0);

        // Get parent total
        let parent: any = null;
        let updateModel: any = null;
        let parentId: string = '';

        if (target.invoiceId) {
            parent = await (tx as any).invoice.findUnique({ where: { id: target.invoiceId } });
            updateModel = (tx as any).invoice;
            parentId = target.invoiceId;
        } else {
            parent = await (tx as any).sale.findUnique({ where: { id: target.saleId } });
            updateModel = (tx as any).sale;
            parentId = target.saleId!;
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
