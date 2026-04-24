'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { money } from '@/lib/money';
import { formatDate } from '@/lib/formatters';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ReceiptText, FileDown } from 'lucide-react';
import { ExportButton } from '../shared/export-button';
import { exportProfitAndLossAction } from '@/actions/accounting/accounting.actions';
import { format } from 'date-fns';

interface PnLReportProps {
    data: {
        startDate: string | Date;
        endDate: string | Date;
        revenue: {
            accounts: Array<{ id: string, code: string, name: string, balance: number }>;
            total: number;
        };
        expense: {
            accounts: Array<{ id: string, code: string, name: string, balance: number }>;
            total: number;
        };
        netProfit: number;
    };
    onDrillDown?: (accountId: string) => void;
}

export const PnLReport: React.FC<PnLReportProps> = ({ data, onDrillDown }) => {
    const isProfit = data.netProfit >= 0;

    return (
        <div className="space-y-6">
            <Card className={`overflow-hidden border-2 ${isProfit ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-50/50'}`}>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">กำไร (ขาดทุน) สุทธิ / Net Profit</p>
                            <h2 className={`text-4xl font-bold mt-1 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {money.format(data.netProfit)}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-2">
                                งวดวันที่ {formatDate(data.startDate)} ถึง {formatDate(data.endDate)}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-4">
                            <div className={`p-4 rounded-full ${isProfit ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {isProfit ? <TrendingUp size={40} /> : <ArrowDownRight size={40} />}
                            </div>
                            <ExportButton
                                filename={`PnL_${format(new Date(data.startDate), 'yyyy-MM-dd')}_to_${format(new Date(data.endDate), 'yyyy-MM-dd')}`}
                                action={() => exportProfitAndLossAction({
                                    startDate: new Date(data.startDate).toISOString(),
                                    endDate: new Date(data.endDate).toISOString()
                                })}
                                label="Export P&L"
                                variant="outline"
                                className="bg-white/50"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-md">
                    <CardHeader className="bg-emerald-50/50 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2 text-emerald-700">
                                <ArrowUpRight size={20} />
                                รายได้ (Revenue)
                            </CardTitle>
                            <span className="text-xl font-bold text-emerald-700">{money.format(data.revenue.total)}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {data.revenue.accounts.map((acc) => (
                                <div
                                    key={acc.id}
                                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                                    onClick={() => onDrillDown?.(acc.id)}
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{acc.code}</span>
                                            <span className="text-sm font-medium">{acc.name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-semibold">{money.format(acc.balance)}</span>
                                        <ReceiptText size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md">
                    <CardHeader className="bg-rose-50/50 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2 text-rose-700">
                                <ArrowDownRight size={20} />
                                ค่าใช้จ่าย (Expense)
                            </CardTitle>
                            <span className="text-xl font-bold text-rose-700">{money.format(data.expense.total)}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {data.expense.accounts.map((acc) => (
                                <div
                                    key={acc.id}
                                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                                    onClick={() => onDrillDown?.(acc.id)}
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">{acc.code}</span>
                                            <span className="text-sm font-medium">{acc.name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-semibold">{money.format(acc.balance)}</span>
                                        <ReceiptText size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-900 text-white border-none shadow-xl mt-8">
                <CardContent className="p-8">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-xl">
                            <span className="opacity-70">Total Revenue / รายได้รวม</span>
                            <span className="font-mono">{money.format(data.revenue.total)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xl border-b border-white/10 pb-4">
                            <span className="opacity-70">Total Expense / ค่าใช้จ่ายรวม</span>
                            <span className="font-mono">({money.format(data.expense.total)})</span>
                        </div>
                        <div className="flex justify-between items-center text-3xl font-bold pt-4 text-emerald-400">
                            <span>NET PROFIT / กำไรสุทธิ</span>
                            <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                                {money.format(data.netProfit)}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
