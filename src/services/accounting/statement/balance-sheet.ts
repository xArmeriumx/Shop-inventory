import { db } from '@/lib/db';
import { money } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { AccountingService } from '../accounting.service';
import { BalanceSheetDTO } from './types';
import { StatementProfitLoss } from './profit-loss';

export const StatementBalanceSheet = {
    async getBalanceSheet(ctx: RequestContext, asOfDate: Date): Promise<BalanceSheetDTO> {
        const accounts = await (db as any).account.findMany({
            where: {
                shopId: ctx.shopId,
                isActive: true,
                category: { in: ['ASSET', 'LIABILITY', 'EQUITY'] }
            },
            include: {
                journalLines: {
                    where: {
                        journalEntry: {
                            status: 'POSTED',
                            journalDate: { lte: asOfDate }
                        }
                    }
                }
            }
        });

        // Calculate Retained Earnings
        const pnlAccumulated = await StatementProfitLoss.getProfitAndLoss(ctx, new Date(0), asOfDate);

        const assets: any[] = [];
        const liabilities: any[] = [];
        const equity: any[] = [];
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        for (const acc of accounts) {
            const totalDebit = acc.journalLines.reduce((sum: number, l: any) => sum + Number(l.debitAmount), 0);
            const totalCredit = acc.journalLines.reduce((sum: number, l: any) => sum + Number(l.creditAmount), 0);

            const balance = AccountingService.calculateBalance(totalDebit, totalCredit, acc.normalBalance);

            if (balance === 0 && acc.journalLines.length === 0) continue;

            const entry = { id: acc.id, code: acc.code, name: acc.name, balance };

            if (acc.category === 'ASSET') {
                assets.push(entry);
                totalAssets = money.add(totalAssets, balance);
            } else if (acc.category === 'LIABILITY') {
                liabilities.push(entry);
                totalLiabilities = money.add(totalLiabilities, balance);
            } else if (acc.category === 'EQUITY') {
                equity.push(entry);
                totalEquity = money.add(totalEquity, balance);
            }
        }

        if (pnlAccumulated.netProfit !== 0) {
            equity.push({
                id: 'retained-earnings',
                code: 'RE',
                name: 'กำไร (ขาดทุน) สุทธิสะสม',
                balance: pnlAccumulated.netProfit
            });
            totalEquity = money.add(totalEquity, pnlAccumulated.netProfit);
        }

        const totalLiabilitiesAndEquity = money.add(totalLiabilities, totalEquity);

        return {
            asOfDate,
            assets: { accounts: assets, total: totalAssets },
            liabilities: { accounts: liabilities, total: totalLiabilities },
            equity: { accounts: equity, total: totalEquity },
            totalLiabilitiesAndEquity,
            isBalanced: money.isEqual(totalAssets, totalLiabilitiesAndEquity)
        };
    }
};
