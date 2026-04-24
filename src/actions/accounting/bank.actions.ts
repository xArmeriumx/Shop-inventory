import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { BankService } from '@/services/accounting/bank.service';
import { ActionResponse } from '@/types/common';
import { db } from '@/lib/db';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

export async function createBankAccountAction(data: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG' as any);
            const bankAccount = await BankService.createBankAccount({
                ...data,
                shopId: ctx.shopId,
                userId: ctx.userId
            });

            revalidatePath('/accounting/banks');
            return bankAccount;
        });
    }, { context: { action: 'createBankAccountAction' } });
}

export async function importStatementAction(data: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG' as any);
            const result = await BankService.importStatement({
                ...data,
                shopId: ctx.shopId,
                memberId: ctx.memberId
            });

            revalidatePath('/accounting/reconcile');
            return result;
        });
    }, { context: { action: 'importStatementAction' } });
}

export async function matchLineAction(bankLineId: string, journalLineIds: string[]): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG' as any);
            const result = await BankService.matchLine(bankLineId, journalLineIds, ctx.memberId!);
            revalidatePath('/accounting/reconcile');
            return result;
        });
    }, { context: { action: 'matchLineAction' } });
}

export async function getMatchCandidatesAction(bankLineId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            await requirePermission('FINANCE_VIEW_LEDGER');
            return await BankService.getMatchCandidates(bankLineId);
        });
    }, { context: { action: 'getMatchCandidatesAction' } });
}

export async function getUnmatchedBankLinesAction(bankAccountId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            return await (db as any).bankLine.findMany({
                where: {
                    statement: { bankAccountId },
                    matchStatus: 'UNMATCHED',
                    shopId: ctx.shopId
                },
                orderBy: { bookingDate: 'desc' }
            });
        });
    }, { context: { action: 'getUnmatchedBankLinesAction' } });
}

export async function getUnreconciledLedgerAction(bankAccountId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            const bankAccount = await (db as any).bankAccount.findUnique({
                where: { id: bankAccountId }
            });

            if (!bankAccount) throw new Error('Account not found');

            return await (db as any).journalLine.findMany({
                where: {
                    accountId: bankAccount.glAccountId,
                    reconcileStatus: 'UNRECONCILED',
                    journalEntry: {
                        shopId: ctx.shopId,
                        status: 'POSTED'
                    }
                },
                include: { journalEntry: true },
                orderBy: { journalEntry: { journalDate: 'desc' } }
            });
        });
    }, { context: { action: 'getUnreconciledLedgerAction' } });
}
