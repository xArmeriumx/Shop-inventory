import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { AccountingService } from '../accounting.service';

export const StatementLedger = {
    async getAccountLedger(ctx: RequestContext, accountId: string, startDate: Date, endDate: Date) {
        const account = await (db as any).account.findUnique({
            where: { id: accountId, shopId: ctx.shopId }
        });

        if (!account) throw new ServiceError('ไม่พบข้อมูลบัญชี');

        const openingLines = await (db as any).journalLine.findMany({
            where: {
                accountId,
                journalEntry: {
                    status: 'POSTED',
                    shopId: ctx.shopId,
                    journalDate: { lt: startDate }
                }
            }
        });

        const openDebit = openingLines.reduce((sum: number, l: any) => sum + Number(l.debitAmount), 0);
        const openCredit = openingLines.reduce((sum: number, l: any) => sum + Number(l.creditAmount), 0);

        const openingBalance = AccountingService.calculateBalance(openDebit, openCredit, account.normalBalance);

        const lines = await (db as any).journalLine.findMany({
            where: {
                accountId,
                journalEntry: {
                    status: 'POSTED',
                    shopId: ctx.shopId,
                    journalDate: { gte: startDate, lte: endDate }
                }
            },
            include: { journalEntry: true },
            orderBy: { journalEntry: { journalDate: 'asc' } }
        });

        let currentBalance = openingBalance;
        const mappedLines = lines.map((l: any) => {
            const dr = Number(l.debitAmount);
            const cr = Number(l.creditAmount);

            const move = AccountingService.calculateBalance(dr, cr, account.normalBalance);
            currentBalance += move;

            return {
                id: l.id,
                date: l.journalEntry.journalDate,
                entryNo: l.journalEntry.entryNo,
                journalId: l.journalEntryId,
                description: l.description || l.journalEntry.description,
                debit: dr,
                credit: cr,
                balance: currentBalance,
                sourceId: l.journalEntry.sourceId,
                sourceType: l.journalEntry.sourceType
            };
        });

        return {
            account,
            startDate,
            endDate,
            openingBalance,
            closingBalance: currentBalance,
            lines: mappedLines
        };
    },

    async getGeneralLedger(ctx: RequestContext, startDate: Date, endDate: Date) {
        const entries = await (db as any).journalEntry.findMany({
            where: {
                shopId: ctx.shopId,
                status: 'POSTED',
                journalDate: { gte: startDate, lte: endDate }
            },
            include: {
                lines: {
                    include: { account: { select: { code: true, name: true } } }
                }
            },
            orderBy: { journalDate: 'asc' }
        });

        return entries;
    }
};
