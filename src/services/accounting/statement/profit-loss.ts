import { db } from '@/lib/db';
import { money } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { AccountingService } from '../accounting.service';
import { ProfitAndLossDTO } from './types';

export const StatementProfitLoss = {
    async getProfitAndLoss(ctx: RequestContext, startDate: Date, endDate: Date): Promise<ProfitAndLossDTO> {
        const accounts = await (db as any).account.findMany({
            where: {
                shopId: ctx.shopId,
                isActive: true,
                category: { in: ['REVENUE', 'EXPENSE'] }
            },
            include: {
                journalLines: {
                    where: {
                        journalEntry: {
                            status: 'POSTED',
                            journalDate: { gte: startDate, lte: endDate }
                        }
                    }
                }
            }
        });

        const revenueAccounts: any[] = [];
        const expenseAccounts: any[] = [];
        let totalRevenue = 0;
        let totalExpense = 0;

        for (const acc of accounts) {
            const totalDebit = acc.journalLines.reduce((sum: number, l: any) => sum + Number(l.debitAmount), 0);
            const totalCredit = acc.journalLines.reduce((sum: number, l: any) => sum + Number(l.creditAmount), 0);

            const balance = AccountingService.calculateBalance(totalDebit, totalCredit, acc.normalBalance);

            if (balance === 0 && acc.journalLines.length === 0) continue;

            const entry = { id: acc.id, code: acc.code, name: acc.name, balance };

            if (acc.category === 'REVENUE') {
                revenueAccounts.push(entry);
                totalRevenue = money.add(totalRevenue, balance);
            } else {
                expenseAccounts.push(entry);
                totalExpense = money.add(totalExpense, balance);
            }
        }

        return {
            startDate,
            endDate,
            revenue: { accounts: revenueAccounts, total: totalRevenue },
            expense: { accounts: expenseAccounts, total: totalExpense },
            netProfit: money.subtract(totalRevenue, totalExpense)
        };
    }
};
