import { toNumber } from '@/lib/money';
import { calculateCtn, getPurchaseStatusLabel, getSaleStatusLabel } from '@/lib/erp-utils';

/**
 * CSV Adapters: Transformation logic to convert DTOs into flat CSV rows.
 * Pure functions only. No database access.
 */

export const CSVAdapters = {
    profitAndLoss(dto: any) {
        const rows: any[] = [];
        dto.revenue.accounts.forEach((acc: any) => {
            rows.push({ Type: 'REVENUE', Code: acc.code, Name: acc.name, Amount: acc.balance });
        });
        rows.push({ Type: 'TOTAL REVENUE', Code: '', Name: '', Amount: dto.revenue.total });
        rows.push({});
        dto.expense.accounts.forEach((acc: any) => {
            rows.push({ Type: 'EXPENSE', Code: acc.code, Name: acc.name, Amount: acc.balance });
        });
        rows.push({ Type: 'TOTAL EXPENSE', Code: '', Name: '', Amount: dto.expense.total });
        rows.push({});
        rows.push({ Type: 'NET PROFIT', Code: '', Name: '', Amount: dto.netProfit });
        return rows;
    },

    balanceSheet(dto: any) {
        const rows: any[] = [];
        const processGroup = (name: string, group: { accounts: any[], total: number }) => {
            rows.push({ Section: name, Code: '', Name: '', Amount: '' });
            group.accounts.forEach(acc => {
                rows.push({ Section: '', Code: acc.code, Name: acc.name, Amount: acc.balance });
            });
            rows.push({ Section: `Total ${name}`, Code: '', Name: '', Amount: group.total });
            rows.push({});
        };

        processGroup('ASSETS', dto.assets);
        processGroup('LIABILITIES', dto.liabilities);
        processGroup('EQUITY', dto.equity);

        rows.push({ Section: 'TOTAL LIABILITIES & EQUITY', Code: '', Name: '', Amount: dto.totalLiabilitiesAndEquity });
        rows.push({ Section: 'Status', Code: '', Name: dto.isBalanced ? 'BALANCED' : 'OUT OF BALANCE', Amount: '' });

        return rows;
    },

    trialBalance(data: any[]) {
        return data.map(acc => ({
            Code: acc.code,
            Name: acc.name,
            Category: acc.category,
            Debit: acc.totalDebit,
            Credit: acc.totalCredit,
            NetBalance: acc.balance
        }));
    },

    accountLedger(dto: any) {
        return dto.lines.map((l: any) => ({
            Date: new Date(l.date).toLocaleDateString('en-GB'),
            RefNo: l.entryNo,
            Description: l.description,
            Debit: l.debit,
            Credit: l.credit,
            RunningBalance: l.balance,
            DocType: l.docType || '',
            SourceID: l.sourceId || ''
        }));
    },

    agingReport(dto: any) {
        return dto.partners.map((p: any) => ({
            Partner: p.partnerName,
            Current: p.buckets.current,
            '1-30 Days': p.buckets.days30,
            '31-60 Days': p.buckets.days60,
            '61-90 Days': p.buckets.days90,
            'Over 90 Days': p.buckets.daysOver90,
            Total: p.buckets.total
        }));
    },

    vatReport(data: any[]) {
        return data.map(entry => ({
            Date: new Date(entry.vendorDocDate).toLocaleDateString('en-GB'),
            InvoiceNo: entry.vendorDocNo,
            Partner: entry.partnerName,
            TaxID: entry.partnerTaxId || '',
            Amount: entry.taxableBaseAmount,
            VAT: entry.taxAmount,
            Total: entry.taxableBaseAmount + entry.taxAmount,
            Status: entry.postingStatus === 'POSTED' ? 'สำเร็จ' : 'ยกเลิก'
        }));
    },

    whtReport(data: any[]) {
        return data.map(entry => ({
            Date: new Date(entry.paymentDate).toLocaleDateString('en-GB'),
            Payee: entry.payeeNameSnapshot,
            TaxID: entry.payeeTaxIdSnapshot,
            Category: entry.incomeCategorySnapshot,
            Rate: `${entry.rateSnapshot}%`,
            BaseAmount: entry.whtBaseAmount,
            TaxAmount: entry.whtAmount,
            Form: entry.formTypeSnapshot
        }));
    },

    generalLedger(data: any[]) {
        const rows: any[] = [];
        data.forEach(entry => {
            entry.lines.forEach((line: any) => {
                rows.push({
                    Date: new Date(entry.date).toLocaleDateString('en-GB'),
                    EntryNo: entry.entryNo,
                    Description: entry.description,
                    AccountCode: line.account.code,
                    AccountName: line.account.name,
                    Debit: line.debit,
                    Credit: line.credit,
                    Reference: entry.referenceNo || ''
                });
            });
        });
        return rows;
    }
};
