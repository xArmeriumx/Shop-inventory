import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { money } from '@/lib/money';
import { AccountingService } from './accounting.service';

/**
 * Report Data Transfer Objects (DTOs)
 * Normalized structures for both UI and Exports
 */
export interface ProfitAndLossDTO {
    startDate: Date;
    endDate: Date;
    revenue: {
        accounts: Array<{ id: string, code: string, name: string, balance: number }>;
        total: number;
    };
    expense: {
        accounts: Array<{ id: string, code: string, name: string, balance: number }>;
        total: number;
    };
    netProfit: number;
}

export interface BalanceSheetDTO {
    asOfDate: Date;
    assets: { accounts: any[]; total: number };
    liabilities: { accounts: any[]; total: number };
    equity: { accounts: any[]; total: number };
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
}

export interface AgingBucket {
    current: number;
    days30: number;  // 1-30
    days60: number;  // 31-60
    days90: number;  // 61-90
    daysOver90: number;
    total: number;
}

export interface PartnerAgingDTO {
    partnerId: string;
    partnerName: string;
    buckets: AgingBucket;
}

export interface AgingReportDTO {
    type: 'AR' | 'AP';
    asOfDate: Date;
    summary: AgingBucket;
    partners: PartnerAgingDTO[];
}

export interface PartnerStatementDTO {
    partnerId: string;
    partnerName: string;
    startDate: Date;
    endDate: Date;
    openingBalance: number;
    closingBalance: number;
    entries: Array<{
        id: string;
        date: Date;
        docType: string;
        docNo: string;
        description: string;
        debit: number;
        credit: number;
        balance: number;
    }>;
}

/**
 * AccountingReportService — ระบบรายงานการเงินตามมาตรฐานบัญชี (Accounting-Standard Reports)
 * 
 * หน้าที่ (Phase A1.6):
 * 1. ผลิตงบกำไรขาดทุน (P&L) และ งบแสดงฐานะการเงิน (Balance Sheet)
 * 2. จัดการสมุดรายวันแยกประเภท (General Ledger / Account Ledger)
 * 3. รับประกันความถูกต้องตามหลัก Single Source of Truth (SSOT)
 * 
 * SSOT Rule: ข้อมูลต้องมาจาก JournalLine ที่มีสถานะ POSTED เท่านั้น
 */
export const AccountingReportService = {
    /**
     * คำนวณงบกำไรขาดทุน (Profit & Loss) — แสดงผลการดำเนินงานในช่วงเวลา
     */
    async getProfitAndLoss(ctx: RequestContext, startDate: Date, endDate: Date): Promise<ProfitAndLossDTO> {
        // 1. ดึงบัญชีหมวดรายได้ (REVENUE) และค่าใช้จ่าย (EXPENSE)
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
    },

    /**
     * คำนวณงบแสดงฐานะการเงิน (Balance Sheet) — แสดงความมั่งคั่ง ณ จุดเวลา
     */
    async getBalanceSheet(ctx: RequestContext, asOfDate: Date): Promise<BalanceSheetDTO> {
        // 1. ดึงบัญชีหมวด สินทรัพย์, หนี้สิน และทุน
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

        // 2. คำนวณกำไรสะสม (Retained Earnings) โดยการหา Net Profit สะสมจนถึงวันที่ระบุ
        const pnlAccumulated = await this.getProfitAndLoss(ctx, new Date(0), asOfDate);

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

        // แทรกกำไรสะสมลงในหมวดทุน
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
    },

    /**
     * ดึงรายการสมุดรายวันแยกประเภท (Account Ledger) — รายละเอียดการเคลื่อนไหวของแต่ละบัญชี
     */
    async getAccountLedger(ctx: RequestContext, accountId: string, startDate: Date, endDate: Date) {
        const account = await (db as any).account.findUnique({
            where: { id: accountId, shopId: ctx.shopId }
        });

        if (!account) throw new ServiceError('ไม่พบข้อมูลบัญชี');

        // 1. คำนวณยอดยกมา (Opening Balance)
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

        // 2. ดึงรายการระหว่างงวด (Current Period Transactions)
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

            // Calculate movement and add to running balance
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

    /**
     * คำนวณพอร์ตอายุหนี้ (AR/AP Aging Report)
     */
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

    /**
     * Helper for processing aging items
     */
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
    },

    /**
     * ดึงผลสรุปการเคลื่อนไหวของคู่ค้า (Partner Statement) 
     */
    async getPartnerStatement(ctx: RequestContext, partnerId: string, type: 'CUSTOMER' | 'SUPPLIER', startDate: Date, endDate: Date): Promise<PartnerStatementDTO> {
        // 1. Identify Accounts (AR or AP)
        const accountCategory = type === 'CUSTOMER' ? 'ASSET' : 'LIABILITY';
        // Note: Real ERP would use specific CoA accounts mapped to partners. 
        // Here we simplify by aggregating all entries where partnerId matches.

        const journalLines = await (db as any).journalLine.findMany({
            where: {
                journalEntry: {
                    shopId: ctx.shopId,
                    status: 'POSTED',
                    OR: [
                        { sourceId: partnerId }, // Some entries directly link to partner
                        // We also check source docs
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

        // Calculate Opening
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

        // Get Partner Name
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
    },

    /**
     * ดึงข้อมูลสมุดรายวันทั่วไป (General Ledger) ทั้งหมดในช่วงเวลา
     */
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
    },

    /**
     * ดึงข้อมูลรายงานภาษีมูลค่าเพิ่ม (VAT Report ภ.พ.30)
     */
    async getVatReport(ctx: RequestContext, year: number, month: number) {
        // 1. Output VAT (ภาษีขาย) - From Invoices
        const invoices = await (db as any).invoice.findMany({
            where: {
                shopId: ctx.shopId,
                status: 'POSTED',
                date: {
                    gte: new Date(year, month - 1, 1),
                    lt: new Date(year, month, 1)
                }
            }
        });

        // 2. Input VAT (ภาษีซื้อ) - From Purchase Tax Documents
        const purchaseTaxDocs = await (db as any).purchaseTaxDocument.findMany({
            where: {
                shopId: ctx.shopId,
                status: 'POSTED',
                taxReportDate: {
                    gte: new Date(year, month - 1, 1),
                    lt: new Date(year, month, 1)
                }
            }
        });

        const outputVatTotal = invoices.reduce((sum: number, inv: any) => sum + Number(inv.vatAmount || 0), 0);
        const inputVatTotal = purchaseTaxDocs.reduce((sum: number, doc: any) => sum + Number(doc.totalVat || 0), 0);

        return {
            year,
            month,
            outputVat: {
                entries: invoices.map((inv: any) => ({
                    date: inv.date,
                    docNo: inv.invoiceNumber,
                    partnerName: inv.customerName,
                    baseAmount: inv.totalAmount,
                    vatAmount: inv.vatAmount
                })),
                total: outputVatTotal
            },
            inputVat: {
                entries: purchaseTaxDocs.map((doc: any) => ({
                    date: doc.taxInvoiceDate,
                    docNo: doc.taxInvoiceNumber,
                    partnerName: doc.supplierName,
                    baseAmount: doc.totalBase,
                    vatAmount: doc.totalVat
                })),
                total: inputVatTotal
            },
            netVat: money.subtract(outputVatTotal, inputVatTotal)
        };
    }
};
