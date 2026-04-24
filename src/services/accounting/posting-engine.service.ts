import { RequestContext } from '@/types/domain';
import { db } from '@/lib/db';
import { AccountingService } from './accounting.service';
import { JournalService } from './journal.service';

import { ACCOUNTING_CONFIG } from '@/constants/erp/accounting-logic.constants';

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
     * บันทึกรายการต้นทุนขาย (COGS) เมื่อมีการตัดสต็อกจริง
     * Dr. ต้นทุนขาย (COGS) / Cr. สินค้าคงเหลือ (Asset)
     */
    static async postCOGS(ctx: RequestContext, sale: any, tx: any = db) {
        const existing = await this.checkExistingEntry(ctx, 'SALE_INVOICE', sale.id, 'COGS_POST', tx);
        if (existing) return; // Silent guard for COGS

        const [cogsAcc, invAcc] = await Promise.all([
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.COGS_EXPENSE),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.INVENTORY_ASSET),
        ]);

        if (!cogsAcc || !invAcc) {
            console.warn('Skipping COGS posting: Missing account mapping for COGS/Inventory');
            return;
        }

        const totalCost = Number(sale.totalCost || 0);
        if (totalCost <= 0) return;

        return await JournalService.createEntry(ctx, {
            journalDate: sale.date || new Date(),
            description: `บันทึกต้นทุนขายสำหรับใบแจ้งหนี้ ${sale.invoiceNumber}`,
            sourceType: 'SALE_INVOICE',
            sourceId: sale.id,
            sourceNo: sale.invoiceNumber,
            postingPurpose: 'COGS_POST',
            status: 'POSTED',
            lines: [
                { accountId: cogsAcc.id, description: 'ต้นทุนขาย (COGS)', debitAmount: totalCost, creditAmount: 0 },
                { accountId: invAcc.id, description: 'สินค้าคงเหลือ (ตัดสต็อก)', debitAmount: 0, creditAmount: totalCost }
            ]
        }, tx);
    }

    /**
     * บันทึกรายการรับสินค้าเข้าสต็อก (Purchase Inventory Receipt)
     * Dr. สินค้าคงเหลือ / Cr. พักรายการซื้อ (หรือ AP)
     */
    static async postPurchaseInventory(ctx: RequestContext, purchase: any, tx: any = db) {
        const existing = await this.checkExistingEntry(ctx, 'PURCHASE_ORDER', purchase.id, 'INVENTORY_RECEIVE_POST', tx);
        if (existing) return;

        const [invAcc, apAcc] = await Promise.all([
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.INVENTORY_ASSET),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.PURCHASE_AP),
        ]);

        if (!invAcc || !apAcc) return;

        const totalCost = Number(purchase.totalCost || 0);
        if (totalCost <= 0) return;

        return await JournalService.createEntry(ctx, {
            journalDate: new Date(),
            description: `รับสินค้าเข้าสต็อกตามใบสั่งซื้อ ${purchase.purchaseNo || purchase.id.slice(0, 8)}`,
            sourceType: 'PURCHASE_ORDER',
            sourceId: purchase.id,
            sourceNo: purchase.purchaseNo || purchase.id.slice(0, 8),
            postingPurpose: 'INVENTORY_RECEIVE_POST',
            status: 'POSTED',
            lines: [
                { accountId: invAcc.id, description: 'สินค้าคงเหลือ (รับของ)', debitAmount: totalCost, creditAmount: 0 },
                { accountId: apAcc.id, description: 'เจ้าหนี้การค้า (พักยอด)', debitAmount: 0, creditAmount: totalCost }
            ]
        }, tx);
    }

    /**
     * บันทึกรายการลดหนี้จากการรับคืนสินค้า (Sales Return / Credit Note)
     */
    static async postSalesReturn(ctx: RequestContext, returnRecord: any, totalCost: number, tx: any = db) {
        const existing = await this.checkExistingEntry(ctx, 'SALE_RETURN', returnRecord.id, 'RETURN_POST', tx);
        if (existing) return;

        const [retAcc, arAcc, invAcc, cogsAcc] = await Promise.all([
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.SALES_RETURN),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.INVOICE_AR),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.INVENTORY_ASSET),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.COGS_EXPENSE),
        ]);

        if (!retAcc || !arAcc || !invAcc || !cogsAcc) return;

        const refundAmount = Number(returnRecord.refundAmount || 0);

        return await JournalService.createEntry(ctx, {
            journalDate: returnRecord.createdAt || new Date(),
            description: `บันทึกรับคืนสินค้าตามใบรับคืน ${returnRecord.returnNumber}`,
            sourceType: 'SALE_RETURN',
            sourceId: returnRecord.id,
            sourceNo: returnRecord.returnNumber,
            postingPurpose: 'RETURN_POST',
            status: 'POSTED',
            lines: [
                // 1. Reversal of Revenue/AR
                { accountId: retAcc.id, description: 'รับคืนสินค้า (ลดรายได้)', debitAmount: refundAmount, creditAmount: 0 },
                { accountId: arAcc.id, description: 'ลูกหนี้การค้า (ลดหนี้)', debitAmount: 0, creditAmount: refundAmount },
                // 2. Reversal of COGS/Inventory
                { accountId: invAcc.id, description: 'สินค้าคงเหลือ (รับกลับ)', debitAmount: totalCost, creditAmount: 0 },
                { accountId: cogsAcc.id, description: 'ต้นทุนขาย (ลดต้นทุน)', debitAmount: 0, creditAmount: totalCost }
            ]
        }, tx);
    }

    /**
     * บันทึกรายการส่งคืนสินค้าให้ Supplier (Purchase Return / Debit Note)
     */
    static async postPurchaseReturn(ctx: RequestContext, pReturn: any, tx: any = db) {
        const existing = await this.checkExistingEntry(ctx, 'PURCHASE_RETURN', pReturn.id, 'DEBIT_NOTE_POST', tx);
        if (existing) return;

        const [apAcc, invAcc] = await Promise.all([
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.PURCHASE_AP),
            AccountingService.findAccountByCode(ctx, ACCOUNT_MAPPING.INVENTORY_ASSET),
        ]);

        if (!apAcc || !invAcc) return;

        const recoveryAmount = Number(pReturn.recoveryAmount || 0);

        return await JournalService.createEntry(ctx, {
            journalDate: pReturn.createdAt || new Date(),
            description: `ส่งคืนสินค้าตามใบส่งคืน ${pReturn.returnNumber}`,
            sourceType: 'PURCHASE_RETURN',
            sourceId: pReturn.id,
            sourceNo: pReturn.returnNumber,
            postingPurpose: 'DEBIT_NOTE_POST',
            status: 'POSTED',
            lines: [
                { accountId: apAcc.id, description: 'เจ้าหนี้การค้า (ลดหนี้)', debitAmount: recoveryAmount, creditAmount: 0 },
                { accountId: invAcc.id, description: 'สินค้าคงเหลือ (ส่งคืน)', debitAmount: 0, creditAmount: recoveryAmount }
            ]
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
