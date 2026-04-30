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
