import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { toNumber } from '@/lib/money';
import { Security } from '@/services/core/iam/security.service';
import { Permission } from '@prisma/client';
import { WhtService } from '@/services/tax/wht.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { PostingService } from '@/services/accounting/posting-engine.service';
import { DocumentType } from '@/types/domain';
import { PaymentRecalculateEngine } from './recalculate.engine';

export interface PaymentInput {
    invoiceId?: string;
    saleId?: string;
    purchaseId?: string;
    expenseId?: string;
    amount: number;
    paymentMethodCode: string;
    paymentDate?: Date;
    referenceId?: string;
    note?: string;
    whtCodeId?: string;
    isGrossUp?: boolean;
}

export const PaymentRecord = {
    async recordPayment(data: PaymentInput, ctx: RequestContext) {
        Security.require(ctx, Permission.INVOICE_CREATE);

        const parents = [data.invoiceId, data.saleId, data.purchaseId, data.expenseId].filter(Boolean);
        if (parents.length !== 1) {
            throw new ServiceError('รายการชำระต้องระบุเอกสารอ้างอิงเพียงหนึ่งอย่าง (Invoice, Sale, Purchase หรือ Expense)');
        }

        if (data.amount <= 0) {
            throw new ServiceError('ยอดชำระต้องมากกว่า 0');
        }

        return await (db as any).$transaction(async (tx: any) => {
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

            const currentResidual = toNumber(parent.residualAmount);
            if (data.amount > currentResidual) {
                throw new ServiceError(`ยอดชำระเกินจำนวนที่ค้างอยู่ (คงค้าง: ${currentResidual.toLocaleString()} THB)`);
            }

            const paymentNo = await SequenceService.generate(ctx, DocumentType.PAYMENT, tx);

            const documentType = data.invoiceId  ? 'INVOICE'
                               : data.saleId     ? 'SALE'
                               : data.purchaseId ? 'PURCHASE'
                               : 'EXPENSE';
            const documentId = (data.invoiceId ?? data.saleId ?? data.purchaseId ?? data.expenseId)!;

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
                    invoiceId:        data.invoiceId,
                    saleId:           data.saleId,
                    purchaseId:       data.purchaseId,
                    expenseId:        data.expenseId,
                },
            });

            await (tx as any).paymentAllocation.create({
                data: {
                    shopId:       ctx.shopId,
                    paymentId:    payment.id,
                    documentType,
                    documentId,
                    amount:       data.amount,
                    invoiceId:    data.invoiceId,
                    saleId:       data.saleId,
                    purchaseId:   data.purchaseId,
                    expenseId:    data.expenseId,
                },
            });

            await PostingService.postPayment(ctx, payment, tx);

            if (data.whtCodeId) {
                const whtCode = await (tx as any).whtCode.findUnique({
                    where: { id: data.whtCodeId }
                });

                if (!whtCode) throw new ServiceError('ไม่พบรหัสภาษีหัก ณ ที่จ่าย');

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

            await PaymentRecalculateEngine.recalculateDocumentBalance({ documentType, documentId }, tx);

            await AuditService.runWithAudit(ctx, {
                action: AUDIT_ACTIONS.PAYMENT_RECORD,
                targetType: 'Payment',
                targetId: payment.id,
                note: `ชำระเงินจำนวน ${data.amount} THB สำหรับ ${documentType}${data.whtCodeId ? ' (รวมหัก ณ ที่จ่าย)' : ''}`,
            }, async () => payment, tx);

            return payment;
        }, { timeout: 20000 });
    }
};
