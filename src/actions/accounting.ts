import { AccountingService } from '@/services/accounting.service';
import { AccountingReportService } from '@/services/accounting-report.service';
import { requireShop } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';

/**
 * ดึงรายการผังบัญชี (Chart of Accounts)
 */
export async function getAccountsAction() {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.getAccounts(ctx);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * สร้างรายการผังบัญชีหลัก/ย่อย
 */
export async function createAccountAction(data: any) {
    try {
        const ctx = await requireShop();
        const result = await AccountingService.createAccount(ctx, data);
        revalidatePath('/settings/accounting');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getTrialBalanceAction(params: { date?: string } = {}) {
    const ctx = await requireShop();
    try {
        const data = await AccountingService.getTrialBalance(ctx, {
            date: params.date ? new Date(params.date) : undefined
        });
        return { success: true, data };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * ดึงข้อมูลบัญชีรายตัว
 */
export async function getAccountDetailAction(id: string) {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.getAccountById(id, ctx);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * =============================================================================
 * PHASE A1.6: FINANCIAL REPORTING & CLOSE CONTROLS
 * =============================================================================
 */

/**
 * ดึงรายการงวดบัญชีทั้งหมด
 */
export async function getAccountingPeriodsAction() {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.getAccountingPeriods(ctx);
        return { success: true, data: data as any };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * สร้างงวดบัญชีเริ่มต้น (สำหรับปีปัจจุบัน)
 */
export async function initializePeriodsAction() {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.initializePeriods(ctx);
        revalidatePath('/accounting/periods');
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ปิดงวดบัญชี (Close Month)
 */
export async function closePeriodAction(periodId: string) {
    try {
        const ctx = await requireShop();
        await AccountingService.closePeriod(ctx, periodId);
        revalidatePath('/accounting/periods');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * เปิดงวดบัญชีใหม่ (Re-open)
 */
export async function reopenPeriodAction(params: { periodId: string, reason: string }) {
    try {
        const ctx = await requireShop();
        await AccountingService.reopenPeriod(ctx, params.periodId, params.reason);
        revalidatePath('/accounting/periods');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ดึงงบกำไรขาดทุน (P&L)
 */
export async function getProfitAndLossAction(params: { startDate: string, endDate: string }) {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getProfitAndLoss(
            ctx,
            new Date(params.startDate),
            new Date(params.endDate)
        );
        return { success: true, data: data as any };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ดึงงบแสดงฐานะการเงิน (Balance Sheet)
 */
export async function getBalanceSheetAction(params: { asOfDate: string }) {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getBalanceSheet(
            ctx,
            new Date(params.asOfDate)
        );
        return { success: true, data: data as any };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ดึงสมุดบัญชีรายตัว (Account Ledger)
 */
export async function getAccountLedgerAction(params: { accountId: string, startDate: string, endDate: string }) {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getAccountLedger(
            ctx,
            params.accountId,
            new Date(params.startDate),
            new Date(params.endDate)
        );
        return { success: true, data: data as any };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * =============================================================================
 * PHASE A1.7: AR/AP REPORTING & STATEMENTS
 * =============================================================================
 */

/**
 * ดึงสถานะอายุหนี้ (Aging Report)
 */
export async function getAgingReportAction(params: { type: 'AR' | 'AP', asOfDate?: string }) {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getAgingReport(
            ctx,
            params.type,
            params.asOfDate ? new Date(params.asOfDate) : new Date()
        );
        return { success: true, data: data as any };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ดึงใบแจ้งยอดความเคลื่อนไหวคู่ค้า (Partner Statement)
 */
export async function getPartnerStatementAction(params: {
    partnerId: string,
    type: 'CUSTOMER' | 'SUPPLIER',
    startDate: string,
    endDate: string
}) {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getPartnerStatement(
            ctx,
            params.partnerId,
            params.type,
            new Date(params.startDate),
            new Date(params.endDate)
        );
        return { success: true, data: data as any };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
