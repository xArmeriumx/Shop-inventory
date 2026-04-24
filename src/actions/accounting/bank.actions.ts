'use server';

import { getSessionContext } from '@/lib/auth-guard';
import { BankService } from '@/services/accounting/bank.service';
import { revalidatePath } from 'next/cache';
import { ActionResponse } from '@/types/domain';
import { db } from '@/lib/db';

export async function createBankAccountAction(data: any): Promise<ActionResponse> {
    try {
        const ctx = await getSessionContext();
        if (!ctx) return { success: false, message: 'Unauthorized' };

        const bankAccount = await BankService.createBankAccount({
            ...data,
            shopId: ctx.shopId!,
            userId: ctx.userId!
        });

        revalidatePath('/accounting/banks');
        return { success: true, data: bankAccount };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function importStatementAction(data: any): Promise<ActionResponse> {
    try {
        const ctx = await getSessionContext();
        if (!ctx) return { success: false, message: 'Unauthorized' };

        const result = await BankService.importStatement({
            ...data,
            shopId: ctx.shopId!,
            memberId: ctx.memberId!
        });

        revalidatePath('/accounting/reconcile');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function matchLineAction(bankLineId: string, journalLineIds: string[]): Promise<ActionResponse> {
    try {
        const ctx = await getSessionContext();
        if (!ctx) return { success: false, message: 'Unauthorized' };

        const result = await BankService.matchLine(bankLineId, journalLineIds, ctx.memberId!);
        revalidatePath('/accounting/reconcile');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getMatchCandidatesAction(bankLineId: string): Promise<ActionResponse> {
    try {
        const result = await BankService.getMatchCandidates(bankLineId);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getUnmatchedBankLinesAction(bankAccountId: string): Promise<ActionResponse> {
    try {
        const ctx = await getSessionContext();
        if (!ctx) return { success: false, message: 'Unauthorized' };

        const lines = await (db as any).bankLine.findMany({
            where: {
                statement: { bankAccountId },
                matchStatus: 'UNMATCHED',
                shopId: ctx.shopId
            },
            orderBy: { bookingDate: 'desc' }
        });
        return { success: true, data: lines };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getUnreconciledLedgerAction(bankAccountId: string): Promise<ActionResponse> {
    try {
        const ctx = await getSessionContext();
        if (!ctx) return { success: false, message: 'Unauthorized' };

        const bankAccount = await (db as any).bankAccount.findUnique({
            where: { id: bankAccountId }
        });

        if (!bankAccount) return { success: false, message: 'Account not found' };

        const lines = await (db as any).journalLine.findMany({
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
        return { success: true, data: lines };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
