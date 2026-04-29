import { db, runInTransaction } from '@/lib/db';
import { RequestContext, ServiceError, DocumentType } from '@/types/domain';
import { SequenceService } from '@/services/core/system/sequence.service';
import { JournalService } from './journal.service';
import { PostingService } from './posting-engine.service';
import { PaymentService } from './payment.service';
import { money, toNumber } from '@/lib/money';
import { ACCOUNTING_CONFIG } from '@/constants/erp/accounting-logic.constants';
import { AuditService } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';

const ACCOUNT_MAPPING = ACCOUNTING_CONFIG.ACCOUNT_MAPPING;

export interface ReceiptVoucherInput {
    paymentDate: Date;
    paymentMethodCode: string;
    referenceId?: string;
    note?: string;
    totalAmount: number;
    allocations: Array<{
        invoiceId: string;
        amount: number;
    }>;
}

export const VoucherService = {
    /**
     * สร้างใบสำคัญรับเงิน (Receipt Voucher)
     * รองรับการรับเงิน 1 ก้อน ตัดจ่ายหลาย Invoice (1:M)
     */
    async createReceiptVoucher(ctx: RequestContext, input: ReceiptVoucherInput) {
        Security.requirePermission(ctx, 'INVOICE_UPDATE' as any); // Logical permission for recording receipts

        const { allocations, totalAmount } = input;

        // 1. Validation: Sum check
        const sumAllocated = allocations.reduce((sum, a) => money.add(sum, a.amount), 0);
        if (!money.isEqual(sumAllocated, totalAmount)) {
            throw new ServiceError(`ยอดระบุชำระ (${sumAllocated}) ไม่ตรงกับยอดจ่ายหน้าใบสำคัญ (${totalAmount})`);
        }

        return await runInTransaction(undefined, async (tx) => {
            // 2. Generate RCP Sequence
            const paymentNo = await SequenceService.generate(ctx, DocumentType.PAYMENT, tx);

            // 3. Create Voucher Header (Payment Model)
            const payment = await (tx as any).payment.create({
                data: {
                    shopId: ctx.shopId,
                    memberId: ctx.memberId!,
                    paymentNo,
                    type: 'IN',
                    amount: totalAmount,
                    paymentMethodCode: input.paymentMethodCode,
                    paymentDate: input.paymentDate || new Date(),
                    referenceId: input.referenceId,
                    note: input.note,
                    status: 'POSTED',
                },
            });

            // 4. Create Allocations & Update Invoices
            for (const alloc of allocations) {
                // 4.1 Create Allocation Record (Polymorphic)
                await (tx as any).paymentAllocation.create({
                    data: {
                        shopId:       ctx.shopId,
                        paymentId:    payment.id,
                        documentType: 'INVOICE',
                        documentId:   alloc.invoiceId,
                        invoiceId:    alloc.invoiceId,  // legacy mirror
                        amount:       alloc.amount,
                    },
                });

                // 4.2 Validate Residual & Overpayment Guard
                const invoice = await (tx as any).invoice.findFirst({
                    where: { id: alloc.invoiceId, shopId: ctx.shopId },
                });

                if (!invoice) throw new ServiceError(`ไม่พบใบแจ้งหนี้ ID: ${alloc.invoiceId}`);

                const currentResidual = toNumber(invoice.residualAmount);
                if (alloc.amount > currentResidual) {
                    throw new ServiceError(`ยอดตัดชำระเกินยอดค้าง (เลขที่: ${invoice.invoiceNo}, ค้างอยู่: ${currentResidual})`);
                }

                // 4.3 Update Document Balance (SSOT — Polymorphic)
                await PaymentService.recalculateDocumentBalance(
                    { documentType: 'INVOICE', documentId: alloc.invoiceId },
                    tx
                );
            }

            // 5. Automated Journal Posting (SSOT)
            await this.postReceiptVoucher(ctx, payment, tx);

            // 6. Audit Logging
            await AuditService.runWithAudit(ctx, {
                action: 'RECEIPT_VOUCHER_CREATE',
                targetType: 'Payment',
                targetId: payment.id,
                note: `สร้างใบสำคัญรับเงินเลขที่ ${paymentNo} จำนวน ${totalAmount} THB สำหรับ ${allocations.length} รายการ`,
            }, async () => payment, tx);

            return payment;
        });
    },

    /**
     * สร้างใบสำคัญจ่ายเงิน (Payment Voucher)
     * รองรับการจ่ายเงิน 1 ก้อน ตัดจ่ายหลาย Purchase Bill (1:M)
     */
    async createPaymentVoucher(ctx: RequestContext, input: {
        paymentDate: Date;
        paymentMethodCode: string;
        referenceId?: string;
        note?: string;
        totalAmount: number;
        allocations: Array<{
            purchaseId: string;
            amount: number;
        }>;
    }) {
        Security.requirePermission(ctx, 'PURCHASE_UPDATE' as any);

        const { allocations, totalAmount } = input;
        const sumAllocated = allocations.reduce((sum, a) => money.add(sum, a.amount), 0);

        if (!money.isEqual(sumAllocated, totalAmount)) {
            throw new ServiceError(`ยอดระบุชำระ (${sumAllocated}) ไม่ตรงกับยอดจ่ายหน้าใบสำคัญ (${totalAmount})`);
        }

        return await runInTransaction(undefined, async (tx) => {
            const paymentNo = await SequenceService.generate(ctx, DocumentType.PAYMENT, tx);

            const payment = await (tx as any).payment.create({
                data: {
                    shopId: ctx.shopId,
                    memberId: ctx.memberId!,
                    paymentNo,
                    type: 'OUT',
                    amount: totalAmount,
                    paymentMethodCode: input.paymentMethodCode,
                    paymentDate: input.paymentDate || new Date(),
                    referenceId: input.referenceId,
                    note: input.note,
                    status: 'POSTED',
                },
            });

            for (const alloc of allocations) {
                await (tx as any).paymentAllocation.create({
                    data: {
                        shopId:       ctx.shopId,
                        paymentId:    payment.id,
                        documentType: 'PURCHASE',
                        documentId:   alloc.purchaseId,
                        purchaseId:   alloc.purchaseId,  // legacy mirror
                        amount:       alloc.amount,
                    },
                });

                const purchase = await (tx as any).purchase.findFirst({
                    where: { id: alloc.purchaseId, shopId: ctx.shopId },
                });

                if (!purchase) throw new ServiceError(`ไม่พบใบสั่งซื้อ ID: ${alloc.purchaseId}`);

                const currentResidual = toNumber(purchase.residualAmount);
                if (alloc.amount > currentResidual) {
                    throw new ServiceError(`ยอดตัดจ่ายเกินยอดค้าง (เลขที่: ${purchase.purchaseNumber}, ค้างอยู่: ${currentResidual})`);
                }

                await PaymentService.recalculateDocumentBalance(
                    { documentType: 'PURCHASE', documentId: alloc.purchaseId },
                    tx
                );
            }

            await this.postPaymentVoucher(ctx, payment, tx);

            await AuditService.runWithAudit(ctx, {
                action: 'PAYMENT_VOUCHER_CREATE',
                targetType: 'Payment',
                targetId: payment.id,
                note: `สร้างใบสำคัญจ่ายเงินเลขที่ ${paymentNo} จำนวน ${totalAmount} THB สำหรับ ${allocations.length} รายการ`,
            }, async () => payment, tx);

            return payment;
        });
    },

    /**
     * ลงบัญชีสำหรับใบสำคัญรับเงิน
     */
    async postReceiptVoucher(ctx: RequestContext, payment: any, tx: any) {
        // Look up standard AR and Cash/Bank accounts
        const [cashAcc, arAcc] = await Promise.all([
            // In a full ERP, the cash/bank account would be linked to PaymentMethod
            // For now, we use the SSOT mapping defined in accounting-constants
            (tx as any).account.findFirst({ where: { shopId: ctx.shopId, code: ACCOUNT_MAPPING.PAYMENT_CASH_BANK } }),
            (tx as any).account.findFirst({ where: { shopId: ctx.shopId, code: ACCOUNT_MAPPING.PAYMENT_AR_OFFSET } }),
        ]);

        if (!cashAcc || !arAcc) {
            throw new ServiceError('ระบบยังคงขาดการตั้งค่าผังบัญชีสำหรับการรับชำระเงิน (AR/Bank mapping missing)');
        }

        const lines = [
            // Debit: Bank/Cash
            {
                accountId: cashAcc.id,
                description: `รับชำระเงิน - ${payment.paymentNo}`,
                debitAmount: toNumber(payment.amount),
                creditAmount: 0,
            },
            // Credit: AR
            {
                accountId: arAcc.id,
                description: `ตัดยอดลูกหนี้ - ${payment.paymentNo}`,
                debitAmount: 0,
                creditAmount: toNumber(payment.amount),
            }
        ];

        return await JournalService.createEntry(ctx, {
            journalDate: payment.paymentDate,
            description: `รับชำระเงินตามใบสำคัญเลขที่ ${payment.paymentNo}`,
            sourceType: 'PAYMENT_RECEIPT',
            sourceId: payment.id,
            sourceNo: payment.paymentNo,
            postingPurpose: 'PAYMENT_POST',
            status: 'POSTED',
            lines,
        }, tx);
    },

    /**
     * ลงบัญชีสำหรับใบสำคัญจ่ายเงิน
     */
    async postPaymentVoucher(ctx: RequestContext, payment: any, tx: any) {
        const [apAcc, cashAcc] = await Promise.all([
            (tx as any).account.findFirst({ where: { shopId: ctx.shopId, code: ACCOUNT_MAPPING.PURCHASE_AP } }),
            (tx as any).account.findFirst({ where: { shopId: ctx.shopId, code: ACCOUNT_MAPPING.PAYMENT_CASH_BANK } }),
        ]);

        if (!apAcc || !cashAcc) {
            throw new ServiceError('ระบบยังคงขาดการตั้งค่าผังบัญชีสำหรับการจ่ายเงิน (AP/Bank mapping missing)');
        }

        const lines = [
            {
                accountId: apAcc.id,
                description: `จ่ายเงินเจ้าหนี้ - ${payment.paymentNo}`,
                debitAmount: toNumber(payment.amount),
                creditAmount: 0,
            },
            {
                accountId: cashAcc.id,
                description: `จ่ายเงินธนาคาร - ${payment.paymentNo}`,
                debitAmount: 0,
                creditAmount: toNumber(payment.amount),
            }
        ];

        return await JournalService.createEntry(ctx, {
            journalDate: payment.paymentDate,
            description: `ชำระเงินตามใบสำคัญเลขที่ ${payment.paymentNo}`,
            sourceType: 'PAYMENT_RECEIPT',
            sourceId: payment.id,
            sourceNo: payment.paymentNo,
            postingPurpose: 'PAYMENT_POST',
            status: 'POSTED',
            lines,
        }, tx);
    },

    /**
     * ดึงรายการเอกสารที่ยังค้างชำระ (Unpaid/Partial) สำหรับการทำ Voucher
     * ใช้ใน Voucher Form เพื่อเลือกรายการที่ต้องการตัดชำระ
     */
    async getUnpaidDocuments(ctx: RequestContext, params: { type: 'RECEIPT' | 'PAYMENT'; partnerId: string }) {
        const { type, partnerId } = params;
        if (!partnerId) return [];

        const where: any = {
            shopId: ctx.shopId,
            status: type === 'RECEIPT' ? 'POSTED' : 'RECEIVED',
            paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
            ...(type === 'RECEIPT' ? { customerId: partnerId } : { supplierId: partnerId }),
        };

        const docs = type === 'RECEIPT'
            ? await db.invoice.findMany({ where, orderBy: { date: 'asc' } })
            : await db.purchase.findMany({ where, orderBy: { date: 'asc' } });

        return docs.map((d: any) => ({
            id: d.id,
            docNo: d.invoiceNo || d.purchaseNumber,
            date: d.date,
            totalAmount: Number(d.totalAmount),
            residualAmount: Number(d.residualAmount),
            paidAmount: Number(d.paidAmount),
        }));
    },
};
