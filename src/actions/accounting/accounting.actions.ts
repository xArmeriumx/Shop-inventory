import { AccountingService } from '@/services/accounting/accounting.service';
import { AccountingReportService } from '@/services/accounting/accounting-report.service';
import { ExportService } from '@/services/core/intelligence/export.service';
import { requireShop } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';
import { ActionResponse } from '@/types/common';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

import { accountSchema } from '@/schemas/accounting/account.schema';
import { AuditService } from '@/services/core/system/audit.service';
import { logger } from '@/lib/logger';
import { Permission } from '@prisma/client';

/**
 * ดึงรายการผังบัญชี (Chart of Accounts)
 */
export async function getAccountsAction(): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingService.getAccounts(ctx);
        }, 'accounting:getAccounts');
    });
}

/**
 * สร้างรายการผังบัญชีหลัก/ย่อย
 */
export async function createAccountAction(data: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requireShop();
        const validated = accountSchema.parse(data);
        
        const result = await AccountingService.createAccount(ctx, validated);

        // Audit (Non-blocking)
        AuditService.record({
            action: 'CREATE_ACCOUNT',
            targetType: 'Account',
            targetId: result.id,
            note: `Created account: ${result.code} - ${result.name}`,
            after: result,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] CREATE_ACCOUNT log failed', err));

        revalidatePath('/settings/accounting');
        return result;
    }, { context: { action: 'createAccount' } });
}

/**
 * แก้ไขรายการผังบัญชี
 */
export async function updateAccountAction(id: string, data: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requireShop();
        
        const before = await AccountingService.getAccountById(id, ctx);
        const validated = accountSchema.partial().parse(data);
        
        const result = await AccountingService.updateAccount(ctx, id, validated);

        // Audit (Non-blocking)
        AuditService.record({
            action: 'UPDATE_ACCOUNT',
            targetType: 'Account',
            targetId: id,
            note: `Updated account: ${result.code}`,
            before,
            after: result,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] UPDATE_ACCOUNT log failed', err));

        revalidatePath('/settings/accounting');
        return result;
    }, { context: { action: 'updateAccount', id } });
}

export async function getTrialBalanceAction(params: { date?: string } = {}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingService.getTrialBalance(ctx, {
                date: params.date ? new Date(params.date) : undefined
            });
        }, 'accounting:getTrialBalance');
    });
}

/**
 * ดึงข้อมูลบัญชีรายตัว
 */
export async function getAccountDetailAction(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingService.getAccountById(id, ctx);
        }, 'accounting:getAccountDetail');
    });
}

/**
 * =============================================================================
 * PHASE A1.6: FINANCIAL REPORTING & CLOSE CONTROLS
 * =============================================================================
 */

/**
 * ดึงรายการงวดบัญชีทั้งหมด
 */
export async function getAccountingPeriodsAction(): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingService.getAccountingPeriods(ctx);
        }, 'accounting:getAccountingPeriods');
    });
}

export async function initializePeriodsAction(): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            const data = await AccountingService.initializePeriods(ctx);
            revalidatePath('/accounting/periods');
            return data;
        }, 'accounting:initializePeriods');
    });
}

export async function closePeriodAction(periodId: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        const ctx = await requireShop();
        const result = await AccountingService.closePeriod(ctx, periodId);

        // Audit
        AuditService.record({
            action: 'CLOSE_ACCOUNTING_PERIOD',
            targetType: 'AccountingPeriod',
            targetId: periodId,
            note: `Closed accounting period: ${periodId}`,
            after: result,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] CLOSE_ACCOUNTING_PERIOD log failed', err));

        revalidatePath('/accounting/periods');
        return null;
    }, { context: { action: 'closePeriod', periodId } });
}

export async function reopenPeriodAction(params: { periodId: string, reason: string }): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        const ctx = await requireShop();
        const result = await AccountingService.reopenPeriod(ctx, params.periodId, params.reason);

        // Audit
        AuditService.record({
            action: 'REOPEN_ACCOUNTING_PERIOD',
            targetType: 'AccountingPeriod',
            targetId: params.periodId,
            note: `Reopened accounting period: ${params.periodId}. Reason: ${params.reason}`,
            after: result,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] REOPEN_ACCOUNTING_PERIOD log failed', err));

        revalidatePath('/accounting/periods');
        return null;
    }, { context: { action: 'reopenPeriod', ...params } });
}

/**
 * ดึงงบกำไรขาดทุน (P&L)
 */
export async function getProfitAndLossAction(params: { startDate: string, endDate: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingReportService.getProfitAndLoss(
                ctx,
                new Date(params.startDate),
                new Date(params.endDate)
            );
        }, 'accounting:getProfitAndLoss');
    });
}

export async function getBalanceSheetAction(params: { asOfDate: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingReportService.getBalanceSheet(
                ctx,
                new Date(params.asOfDate)
            );
        }, 'accounting:getBalanceSheet');
    });
}

/**
 * ดึงสมุดบัญชีรายตัว (Account Ledger)
 */
export async function getAccountLedgerAction(params: { accountId: string, startDate: string, endDate: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingReportService.getAccountLedger(
                ctx,
                params.accountId,
                new Date(params.startDate),
                new Date(params.endDate)
            );
        }, 'accounting:getAccountLedger');
    });
}

/**
 * =============================================================================
 * PHASE A1.7: AR/AP REPORTING & STATEMENTS
 * =============================================================================
 */

/**
 * ดึงสถานะอายุหนี้ (Aging Report)
 */
export async function getAgingReportAction(params: { type: 'AR' | 'AP', asOfDate?: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingReportService.getAgingReport(
                ctx,
                params.type,
                params.asOfDate ? new Date(params.asOfDate) : new Date()
            );
        }, 'accounting:getAgingReport');
    });
}

/**
 * ดึงใบแจ้งยอดความเคลื่อนไหวคู่ค้า (Partner Statement)
 */
export async function getPartnerStatementAction(params: {
    partnerId: string,
    type: 'CUSTOMER' | 'SUPPLIER',
    startDate: string,
    endDate: string
}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return AccountingReportService.getPartnerStatement(
                ctx,
                params.partnerId,
                params.type,
                new Date(params.startDate),
                new Date(params.endDate)
            );
        }, 'accounting:getPartnerStatement');
    });
}

/**
 * Export Profit and Loss to CSV
 */
export async function exportProfitAndLossAction(params: { startDate: string, endDate: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            const dto = await AccountingReportService.getProfitAndLoss(ctx, new Date(params.startDate), new Date(params.endDate));
            const rows = ExportService.adaptProfitAndLossToRows(dto);
            return ExportService.toCSV(rows);
        }, 'accounting:exportProfitAndLoss');
    }, { skipSerialize: true });
}

/**
 * Export Balance Sheet to CSV
 */
export async function exportBalanceSheetAction(params: { asOfDate: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            const dto = await AccountingReportService.getBalanceSheet(ctx, new Date(params.asOfDate));
            const rows = ExportService.adaptBalanceSheetToRows(dto);
            return ExportService.toCSV(rows);
        }, 'accounting:exportBalanceSheet');
    }, { skipSerialize: true });
}

/**
 * Export Trial Balance to CSV
 */
export async function exportTrialBalanceAction(params: { date: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            const data = await AccountingService.getTrialBalance(ctx, { date: new Date(params.date) });
            const rows = ExportService.adaptTrialBalanceToRows(data);
            return ExportService.toCSV(rows);
        }, 'accounting:exportTrialBalance');
    }, { skipSerialize: true });
}

/**
 * Export Account Ledger to CSV
 */
export async function exportAccountLedgerAction(params: { accountId: string, startDate: string, endDate: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            const dto = await AccountingReportService.getAccountLedger(ctx, params.accountId, new Date(params.startDate), new Date(params.endDate));
            const rows = ExportService.adaptAccountLedgerToRows(dto);
            return ExportService.toCSV(rows);
        }, 'accounting:exportAccountLedger');
    }, { skipSerialize: true });
}

/**
 * Export Aging Report to CSV
 */
export async function exportAgingReportAction(params: { type: 'AR' | 'AP', asOfDate: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            const dto = await AccountingReportService.getAgingReport(ctx, params.type, new Date(params.asOfDate));
            const rows = ExportService.adaptAgingReportToRows(dto);
            return ExportService.toCSV(rows);
        }, 'accounting:exportAgingReport');
    }, { skipSerialize: true });
}

/**
 * Export General Ledger (All Journal Entries) to CSV
 */
export async function exportGeneralLedgerAction(params: { startDate: string, endDate: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            const data = await AccountingReportService.getGeneralLedger(ctx, new Date(params.startDate), new Date(params.endDate));
            const rows = ExportService.adaptGeneralLedgerToRows(data);
            return ExportService.toCSV(rows);
        }, 'accounting:exportGeneralLedger');
    }, { skipSerialize: true });
}
