/**
 * statement.service.ts — Public Facade for Financial Statements
 * ============================================================================
 * Refactored into Domain-Driven structure.
 * Replaces the old accounting-report.service.ts
 */

import { StatementProfitLoss } from './statement/profit-loss';
import { StatementBalanceSheet } from './statement/balance-sheet';
import { StatementLedger } from './statement/ledger';
import { StatementAging } from './statement/aging';
import { StatementPartner } from './statement/partner';
import { StatementVat } from './statement/vat';
import { Security } from '@/services/core/iam/security.service';

export * from './statement/types';

function withPermission<T extends (...args: any[]) => any>(fn: T): T {
    return (async (ctx: any, ...args: any[]) => {
        Security.requirePermission(ctx, 'FINANCE_VIEW_LEDGER');
        return fn(ctx, ...args);
    }) as any as T;
}

export const StatementService = {
    // Financial Statements
    getProfitAndLoss: withPermission(StatementProfitLoss.getProfitAndLoss),
    getBalanceSheet: withPermission(StatementBalanceSheet.getBalanceSheet),

    // Ledgers
    getAccountLedger: withPermission(StatementLedger.getAccountLedger),
    getGeneralLedger: withPermission(StatementLedger.getGeneralLedger),

    // Aging
    getAgingReport: withPermission(StatementAging.getAgingReport),

    // Partner
    getPartnerStatement: withPermission(StatementPartner.getPartnerStatement),

    // Tax
    getVatReport: withPermission(StatementVat.getVatReport)
};
