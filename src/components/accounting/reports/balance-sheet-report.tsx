'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { money } from '@/lib/money';
import { formatDate } from '@/lib/formatters';
import { Wallet, Landmark, Users, CheckCircle2, AlertCircle, ReceiptText } from 'lucide-react';

interface BalanceSheetReportProps {
    data: {
        asOfDate: string | Date;
        assets: { accounts: any[]; total: number };
        liabilities: { accounts: any[]; total: number };
        equity: { accounts: any[]; total: number };
        totalLiabilitiesAndEquity: number;
        isBalanced: boolean;
    };
    onDrillDown?: (accountId: string) => void;
}

export const BalanceSheetReport: React.FC<BalanceSheetReportProps> = ({ data, onDrillDown }) => {
    return (
        <div className="space-y-6">
            <div className={`p-4 rounded-lg flex items-center justify-between ${data.isBalanced ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'}`}>
                <div className="flex items-center gap-3">
                    {data.isBalanced ? <CheckCircle2 className="text-emerald-500" /> : <AlertCircle className="text-amber-500" />}
                    <div>
                        <p className="font-bold">{data.isBalanced ? 'ยอดงบดุลสมดุล (Balanced)' : 'งบดุลไม่สมดุล (Out of Balance)'}</p>
                        <p className="text-sm opacity-80">ณ วันที่ {formatDate(data.asOfDate)}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase opacity-70">Total Assets / รวมสินทรัพย์</p>
                    <p className="text-xl font-mono font-bold">{money.format(data.assets.total)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card className="border-l-4 border-l-blue-500 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex items-center gap-2 text-blue-700">
                                <Wallet size={24} />
                                สินทรัพย์ (Assets)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y border-t">
                                {data.assets.accounts.map((acc) => (
                                    <div
                                        key={acc.id}
                                        className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                                        onClick={() => onDrillDown?.(acc.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">{acc.code}</span>
                                            <span className="text-sm font-medium">{acc.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-bold">{money.format(acc.balance)}</span>
                                            <ReceiptText size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-blue-50 flex justify-between items-center font-bold text-blue-800 rounded-b-lg">
                                <span>Total Assets / รวมสินทรัพย์</span>
                                <span className="text-lg">{money.format(data.assets.total)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-l-4 border-l-amber-500 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex items-center gap-2 text-amber-700">
                                <Landmark size={24} />
                                หนี้สิน (Liabilities)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y border-t">
                                {data.liabilities.accounts.map((acc) => (
                                    <div
                                        key={acc.id}
                                        className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                                        onClick={() => onDrillDown?.(acc.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono bg-amber-100 text-amber-700 px-2 py-1 rounded">{acc.code}</span>
                                            <span className="text-sm font-medium">{acc.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-bold">{money.format(acc.balance)}</span>
                                            <ReceiptText size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-amber-50 flex justify-between items-center font-bold text-amber-800">
                                <span>Total Liabilities / รวมหนี้สิน</span>
                                <span className="text-lg">{money.format(data.liabilities.total)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-indigo-500 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex items-center gap-2 text-indigo-700">
                                <Users size={24} />
                                ส่วนของเจ้าของ (Equity)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y border-t">
                                {data.equity.accounts.map((acc) => (
                                    <div
                                        key={acc.id}
                                        className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                                        onClick={() => onDrillDown?.(acc.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-mono px-2 py-1 rounded ${acc.id === 'retained-earnings' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {acc.code}
                                            </span>
                                            <span className="text-sm font-medium">{acc.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-sm font-bold ${acc.id === 'retained-earnings' && acc.balance < 0 ? 'text-rose-600' : ''}`}>
                                                {money.format(acc.balance)}
                                            </span>
                                            {acc.id !== 'retained-earnings' && <ReceiptText size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-indigo-50 flex justify-between items-center font-bold text-indigo-800 rounded-b-lg">
                                <span>Total Equity / รวมส่วนของเจ้าของ</span>
                                <span className="text-lg">{money.format(data.equity.total)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-6 bg-slate-900 text-white rounded-xl shadow-xl">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs uppercase opacity-60">Total Liabilities & Equity</p>
                                <p className="text-sm">รวมหนี้สินและส่วนของเจ้าของ</p>
                            </div>
                            <p className="text-3xl font-mono font-bold text-indigo-300">
                                {money.format(data.totalLiabilitiesAndEquity)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
