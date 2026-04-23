import { AccountingService } from '@/services/accounting/accounting.service';
import { AccountingReportService } from '@/services/accounting/accounting-report.service';
import { ExportService } from '@/services/export.service';
import { requireShop } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';
import { ActionResponse } from '@/types/domain';

/**
 * ดึงรายการผังบัญชี (Chart of Accounts)
 */
export async function getAccountsAction(): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.getAccounts(ctx);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * สร้างรายการผังบัญชีหลัก/ย่อย
 */
export async function createAccountAction(data: any): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const result = await AccountingService.createAccount(ctx, data);
        revalidatePath('/settings/accounting');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getTrialBalanceAction(params: { date?: string } = {}): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.getTrialBalance(ctx, {
            date: params.date ? new Date(params.date) : undefined
        });
        return { success: true, data };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}

/**
 * ดึงข้อมูลบัญชีรายตัว
 */
export async function getAccountDetailAction(id: string): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.getAccountById(id, ctx);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
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
export async function getAccountingPeriodsAction(): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.getAccountingPeriods(ctx);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function initializePeriodsAction(): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.initializePeriods(ctx);
        revalidatePath('/accounting/periods');
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function closePeriodAction(periodId: string): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        await AccountingService.closePeriod(ctx, periodId);
        revalidatePath('/accounting/periods');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function reopenPeriodAction(params: { periodId: string, reason: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        await AccountingService.reopenPeriod(ctx, params.periodId, params.reason);
        revalidatePath('/accounting/periods');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * ดึงงบกำไรขาดทุน (P&L)
 */
export async function getProfitAndLossAction(params: { startDate: string, endDate: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getProfitAndLoss(
            ctx,
            new Date(params.startDate),
            new Date(params.endDate)
        );
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getBalanceSheetAction(params: { asOfDate: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getBalanceSheet(
            ctx,
            new Date(params.asOfDate)
        );
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * ดึงสมุดบัญชีรายตัว (Account Ledger)
 */
export async function getAccountLedgerAction(params: { accountId: string, startDate: string, endDate: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getAccountLedger(
            ctx,
            params.accountId,
            new Date(params.startDate),
            new Date(params.endDate)
        );
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
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
export async function getAgingReportAction(params: { type: 'AR' | 'AP', asOfDate?: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getAgingReport(
            ctx,
            params.type,
            params.asOfDate ? new Date(params.asOfDate) : new Date()
        );
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
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
}): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getPartnerStatement(
            ctx,
            params.partnerId,
            params.type,
            new Date(params.startDate),
            new Date(params.endDate)
        );
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Export Profit and Loss to CSV
 */
export async function exportProfitAndLossAction(params: { startDate: string, endDate: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const dto = await AccountingReportService.getProfitAndLoss(ctx, new Date(params.startDate), new Date(params.endDate));
        const rows = ExportService.adaptProfitAndLossToRows(dto);
        const csv = ExportService.toCSV(rows);
        return { success: true, data: csv };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Export Balance Sheet to CSV
 */
export async function exportBalanceSheetAction(params: { asOfDate: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const dto = await AccountingReportService.getBalanceSheet(ctx, new Date(params.asOfDate));
        const rows = ExportService.adaptBalanceSheetToRows(dto);
        const csv = ExportService.toCSV(rows);
        return { success: true, data: csv };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Export Trial Balance to CSV
 */
export async function exportTrialBalanceAction(params: { date: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingService.getTrialBalance(ctx, { date: new Date(params.date) });
        const rows = ExportService.adaptTrialBalanceToRows(data);
        const csv = ExportService.toCSV(rows);
        return { success: true, data: csv };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Export Account Ledger to CSV
 */
export async function exportAccountLedgerAction(params: { accountId: string, startDate: string, endDate: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const dto = await AccountingReportService.getAccountLedger(ctx, params.accountId, new Date(params.startDate), new Date(params.endDate));
        const rows = ExportService.adaptAccountLedgerToRows(dto);
        const csv = ExportService.toCSV(rows);
        return { success: true, data: csv };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Export Aging Report to CSV
 */
export async function exportAgingReportAction(params: { type: 'AR' | 'AP', asOfDate: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const dto = await AccountingReportService.getAgingReport(ctx, params.type, new Date(params.asOfDate));
        const rows = ExportService.adaptAgingReportToRows(dto);
        const csv = ExportService.toCSV(rows);
        return { success: true, data: csv };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Export General Ledger (All Journal Entries) to CSV
 */
export async function exportGeneralLedgerAction(params: { startDate: string, endDate: string }): Promise<ActionResponse> {
    try {
        const ctx = await requireShop();
        const data = await AccountingReportService.getGeneralLedger(ctx, new Date(params.startDate), new Date(params.endDate));
        const rows = ExportService.adaptGeneralLedgerToRows(data);
        const csv = ExportService.toCSV(rows);
        return { success: true, data: csv };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
