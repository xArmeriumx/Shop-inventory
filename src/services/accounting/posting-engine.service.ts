import { RequestContext } from '@/types/domain';
import { db } from '@/lib/db';
import { AccountingService } from './accounting.service';
import { JournalService } from './journal.service';

import { ACCOUNTING_CONFIG } from '@/lib/accounting-constants';

const ACCOUNT_MAPPING = ACCOUNTING_CONFIG.ACCOUNT_MAPPING;

export class PostingService {
    /**
     * Generates a "Preview" of the accounting entries for a given business document.
     * This does NOT create anything in the DB.
     */
    static async previewInvoice(ctx: RequestContext, invoice: any) {
        // 1. Get required accounts using the mapping master
        const [arAcc, salesAcc, vatAcc] = await Promise.all([
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.INVOICE_AR),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.INVOICE_REVENUE),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.INVOICE_VAT),
        ]);

        if (!arAcc || !salesAcc) {
            throw new Error('ยังไม่ได้ตั้งค่าบัญชีสำหรับเหตุการณ์การขาย (Missing Invoice Account Mapping)');
        }

        const lines = [];

        // Debit: AR
        lines.push({
            accountId: arAcc?.id,
            accountName: arAcc?.name,
            accountCode: arAcc?.code,
            description: `ลูกหนี้การค้า - ${invoice.invoiceNo}`,
            debitAmount: Number(invoice.totalAmount),
            creditAmount: 0,
            type: 'DEBIT'
        });

        // Credit: Sales (Base amount)
        lines.push({
            accountId: salesAcc?.id,
            accountName: salesAcc?.name,
            accountCode: salesAcc?.code,
            description: `รายได้จากการขาย - ${invoice.invoiceNo}`,
            debitAmount: 0,
            creditAmount: Number(invoice.subtotalAmount), // Use subtotalAmount as base
            type: 'CREDIT'
        });

        // Credit: VAT (if any)
        const vatAmount = Number(invoice.taxAmount || 0);
        if (vatAmount > 0) {
            lines.push({
                accountId: vatAcc?.id,
                accountName: vatAcc?.name,
                accountCode: vatAcc?.code,
                description: `ภาษีขาย - ${invoice.invoiceNo}`,
                debitAmount: 0,
                creditAmount: vatAmount,
                type: 'CREDIT'
            });
        }

        return {
            journalDate: invoice.date || new Date(),
            description: `บันทึกรายการขายตามใบแจ้งหนี้เลขที่ ${invoice.invoiceNo}`,
            totalAmount: Number(invoice.totalAmount),
            lines
        };
    }

    static async previewPayment(ctx: RequestContext, payment: any) {
        const [cashAcc, arAcc] = await Promise.all([
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.PAYMENT_CASH_BANK),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.PAYMENT_AR_OFFSET),
        ]);

        if (!cashAcc || !arAcc) {
            throw new Error('ยังไม่ได้ตั้งค่าบัญชีสำหรับเหตุการณ์รับชำระ (Missing Payment Account Mapping)');
        }

        const lines = [];

        // Debit: Cash/Bank
        lines.push({
            accountId: cashAcc?.id,
            accountName: cashAcc?.name,
            accountCode: cashAcc?.code,
            description: `รับชำระเงิน - ${payment.paymentNo}`,
            debitAmount: Number(payment.amount),
            creditAmount: 0,
            type: 'DEBIT'
        });

        // Credit: AR
        lines.push({
            accountId: arAcc?.id,
            accountName: arAcc?.name,
            accountCode: arAcc?.code,
            description: `ตัดยอดลูกหนี้ - ${payment.paymentNo}`,
            debitAmount: 0,
            creditAmount: Number(payment.amount),
            type: 'CREDIT'
        });

        return {
            journalDate: payment.date || new Date(),
            description: `รับชำระเงินตามเอกสารเลขที่ ${payment.paymentNo}`,
            totalAmount: Number(payment.amount),
            lines
        };
    }

    /**
     * บันทึกรายการสมุดรายวันจริง (Commit to Ledger)
     */
    static async postInvoice(ctx: RequestContext, invoice: any, tx: any = db) {
        // 1. Guard: Check for duplicate posting
        const existing = await this.checkExistingEntry(ctx, 'SALE_INVOICE', invoice.id, 'INVOICE_POST', tx);
        if (existing) {
            throw new Error('เอกสารค้านี้ถูกลงบัญชีไปแล้ว (Duplicate Posting Guard)');
        }

        const preview = await this.previewInvoice(ctx, invoice);

        return await JournalService.createEntry(ctx, {
            journalDate: preview.journalDate,
            description: preview.description,
            sourceType: 'SALE_INVOICE',
            sourceId: invoice.id,
            sourceNo: invoice.invoiceNo,
            postingPurpose: 'INVOICE_POST',
            status: 'POSTED',
            lines: preview.lines.map(line => ({
                accountId: line.accountId!,
                description: line.description,
                debitAmount: line.debitAmount,
                creditAmount: line.creditAmount
            }))
        }, tx);
    }

    static async postPayment(ctx: RequestContext, payment: any, tx: any = db) {
        // 1. Guard: Check for duplicate posting
        const existing = await this.checkExistingEntry(ctx, 'PAYMENT_RECEIPT', payment.id, 'PAYMENT_POST', tx);
        if (existing) {
            throw new Error('รายการรับชำระนี้ถูกลงบัญชีไปแล้ว (Duplicate Posting Guard)');
        }

        const preview = await this.previewPayment(ctx, payment);

        return await JournalService.createEntry(ctx, {
            journalDate: preview.journalDate,
            description: preview.description,
            sourceType: 'PAYMENT_RECEIPT',
            sourceId: payment.id,
            sourceNo: payment.paymentNo,
            postingPurpose: 'PAYMENT_POST',
            status: 'POSTED',
            lines: preview.lines.map(line => ({
                accountId: line.accountId!,
                description: line.description,
                debitAmount: line.debitAmount,
                creditAmount: line.creditAmount
            }))
        }, tx);
    }

    /**
     * ตรวจสอบว่ามีการลงบัญชีสำหรับวัตถุประสงค์นี้ไปแล้วหรือยัง
     */
    private static async checkExistingEntry(
        ctx: RequestContext,
        sourceType: string,
        sourceId: string,
        postingPurpose: string,
        tx: any = db
    ) {
        return await (tx as any).journalEntry.findFirst({
            where: {
                shopId: ctx.shopId,
                sourceType,
                sourceId,
                postingPurpose,
                status: 'POSTED' // Only check for successfully posted ones
            }
        });
    }
}
