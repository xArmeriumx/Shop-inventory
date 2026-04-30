import { db } from '@/lib/db';
import { money } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { AgingReportDTO, PartnerAgingDTO, AgingBucket } from './types';

export const StatementAging = {
    async getAgingReport(ctx: RequestContext, type: 'AR' | 'AP', asOfDate: Date): Promise<AgingReportDTO> {
        const partnersMap = new Map<string, PartnerAgingDTO>();
        const summary: AgingBucket = { current: 0, days30: 0, days60: 0, days90: 0, daysOver90: 0, total: 0 };

        if (type === 'AR') {
            const invoices = await (db as any).invoice.findMany({
                where: {
                    shopId: ctx.shopId,
                    status: 'POSTED',
                    paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
                    residualAmount: { gt: 0 }
                },
                include: { customer: true }
            });

            for (const inv of invoices) {
                const partnerId = inv.customerId || 'UNKNOWN';
                const partnerName = inv.customer?.name || 'Unknown Customer';
                const residual = Number(inv.residualAmount);
                const refDate = inv.dueDate || inv.date;

                this._processAgingItem(partnersMap, summary, partnerId, partnerName, residual, refDate, asOfDate);
            }
        } else {
            const purchases = await (db as any).purchase.findMany({
                where: {
                    shopId: ctx.shopId,
                    status: 'RECEIVED',
                    paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
                    residualAmount: { gt: 0 }
                },
                include: { supplier: true }
            });

            for (const pur of purchases) {
                const partnerId = pur.supplierId || 'UNKNOWN';
                const partnerName = pur.supplier?.name || 'Unknown Supplier';
                const residual = Number(pur.residualAmount);

                // Fallback: date + creditTerm
                let refDate = pur.date;
                if (pur.supplier?.creditTerm) {
                    refDate = new Date(pur.date.getTime() + pur.supplier.creditTerm * 24 * 60 * 60 * 1000);
                }

                this._processAgingItem(partnersMap, summary, partnerId, partnerName, residual, refDate, asOfDate);
            }
        }

        return {
            type,
            asOfDate,
            summary,
            partners: Array.from(partnersMap.values()).sort((a, b) => b.buckets.total - a.buckets.total)
        };
    },

    _processAgingItem(
        map: Map<string, PartnerAgingDTO>,
        summary: AgingBucket,
        partnerId: string,
        partnerName: string,
        amount: number,
        refDate: Date,
        asOfDate: Date
    ) {
        const diffDays = Math.floor((asOfDate.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000));

        let partner = map.get(partnerId);
        if (!partner) {
            partner = {
                partnerId,
                partnerName,
                buckets: { current: 0, days30: 0, days60: 0, days90: 0, daysOver90: 0, total: 0 }
            };
            map.set(partnerId, partner);
        }

        const apply = (target: AgingBucket) => {
            target.total = money.add(target.total, amount);
            if (diffDays <= 0) target.current = money.add(target.current, amount);
            else if (diffDays <= 30) target.days30 = money.add(target.days30, amount);
            else if (diffDays <= 60) target.days60 = money.add(target.days60, amount);
            else if (diffDays <= 90) target.days90 = money.add(target.days90, amount);
            else target.daysOver90 = money.add(target.daysOver90, amount);
        };

        apply(partner.buckets);
        apply(summary);
    }
};
