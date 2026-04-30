import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { AccountingService } from '../accounting.service';
import { PartnerStatementDTO } from './types';

export const StatementPartner = {
    async getPartnerStatement(ctx: RequestContext, partnerId: string, type: 'CUSTOMER' | 'SUPPLIER', startDate: Date, endDate: Date): Promise<PartnerStatementDTO> {
        const accountCategory = type === 'CUSTOMER' ? 'ASSET' : 'LIABILITY';

        const journalLines = await (db as any).journalLine.findMany({
            where: {
                journalEntry: {
                    shopId: ctx.shopId,
                    status: 'POSTED',
                    OR: [
                        { sourceId: partnerId },
                        { invoice: { customerId: partnerId } },
                        { purchase: { supplierId: partnerId } },
                        {
                            payment: {
                                OR: [
                                    { invoice: { customerId: partnerId } },
                                    { purchase: { supplierId: partnerId } }
                                ]
                            }
                        }
                    ]
                }
            },
            include: { journalEntry: true },
            orderBy: { journalEntry: { journalDate: 'asc' } }
        });

        const openingLines = journalLines.filter((l: any) => new Date(l.journalEntry.journalDate) < startDate);
        const periodLines = journalLines.filter((l: any) => {
            const d = new Date(l.journalEntry.journalDate);
            return d >= startDate && d <= endDate;
        });

        let openingBalance = 0;
        openingLines.forEach((l: any) => {
            const dr = Number(l.debitAmount);
            const cr = Number(l.creditAmount);
            openingBalance += AccountingService.calculateBalance(dr, cr, type === 'CUSTOMER' ? 'DEBIT' : 'CREDIT');
        });

        let currentBalance = openingBalance;
        const entries = periodLines.map((l: any) => {
            const dr = Number(l.debitAmount);
            const cr = Number(l.creditAmount);
            currentBalance += AccountingService.calculateBalance(dr, cr, type === 'CUSTOMER' ? 'DEBIT' : 'CREDIT');

            return {
                id: l.id,
                date: l.journalEntry.journalDate,
                docType: l.journalEntry.sourceType || 'GENERAL',
                docNo: l.journalEntry.entryNo,
                description: l.description || l.journalEntry.description,
                debit: dr,
                credit: cr,
                balance: currentBalance
            };
        });

        let partnerName = 'Unknown Partner';
        if (type === 'CUSTOMER') {
            const c = await (db as any).customer.findUnique({ where: { id: partnerId } });
            if (c) partnerName = c.name;
        } else {
            const s = await (db as any).supplier.findUnique({ where: { id: partnerId } });
            if (s) partnerName = s.name;
        }

        return {
            partnerId,
            partnerName,
            startDate,
            endDate,
            openingBalance,
            closingBalance: currentBalance,
            entries
        };
    }
};
