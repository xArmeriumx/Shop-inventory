'use server';

import { revalidateTag } from 'next/cache';
import { BankService } from '@/services/accounting/bank.service';
import { requirePermission } from '@/lib/auth-guard';
import { ActionResponse } from '@/types/common';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';
import { ACCOUNTING_TAGS } from '@/config/cache-tags';

export async function createBankAccountAction(data: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG');
            const result = await BankService.createBankAccount({
                ...data,
                shopId: ctx.shopId,
                userId: ctx.userId,
            });
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        }, 'accounting:createBankAccount');
    }, { context: { action: 'createBankAccountAction' } });
}

export async function importStatementAction(data: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG');
            const result = await BankService.importStatement({
                ...data,
                shopId: ctx.shopId,
                memberId: ctx.memberId,
            });
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        }, 'accounting:importStatement');
    }, { context: { action: 'importStatementAction' } });
}

export async function matchLineAction(bankLineId: string, journalLineIds: string[]): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG');
            const result = await BankService.matchLine(bankLineId, journalLineIds, ctx.memberId!);
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        }, 'accounting:matchLine');
    }, { context: { action: 'matchLineAction' } });
}

export async function getMatchCandidatesAction(bankLineId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            await requirePermission('FINANCE_VIEW_LEDGER');
            return await BankService.getMatchCandidates(bankLineId);
        }, 'accounting:getMatchCandidates');
    }, { context: { action: 'getMatchCandidatesAction' } });
}

/** ดึง BankLine ที่ยังไม่ได้ Match — delegates to BankService (SSOT) */
export async function getUnmatchedBankLinesAction(bankAccountId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            return await BankService.getUnmatchedLines(bankAccountId, ctx.shopId);
        }, 'accounting:getUnmatchedBankLines');
    }, { context: { action: 'getUnmatchedBankLinesAction' } });
}

/** ดึง JournalLine ที่ยัง Unreconciled — delegates to BankService (SSOT) */
export async function getUnreconciledLedgerAction(bankAccountId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            return await BankService.getUnreconciledLedger(bankAccountId, ctx.shopId);
        }, 'accounting:getUnreconciledLedger');
    }, { context: { action: 'getUnreconciledLedgerAction' } });
}
