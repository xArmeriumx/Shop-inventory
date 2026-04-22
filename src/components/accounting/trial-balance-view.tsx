'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { getTrialBalanceAction } from '@/actions/accounting';
import { Loader2, TrendingUp, TrendingDown, Wallet, PieChart, Activity } from 'lucide-react';

interface TrialBalanceViewProps {
    mode: 'simple' | 'advanced';
    onDrillDown?: (accountId: string) => void;
}

export function TrialBalanceView({ mode, onDrillDown }: TrialBalanceViewProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const res = await getTrialBalanceAction();
            if (res.success) setData(res.data);
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
                <p className="text-muted-foreground animate-pulse">กำลังประมวลผลสุขภาพการเงิน...</p>
            </div>
        );
    }

    // Aggregate by categories for health summary
    const summary = {
        assets: data.filter(a => a.category === 'ASSET').reduce((sum, a) => sum + a.balance, 0),
        liabilities: data.filter(a => a.category === 'LIABILITY').reduce((sum, a) => sum + a.balance, 0),
        equity: data.filter(a => a.category === 'EQUITY').reduce((sum, a) => sum + a.balance, 0),
        income: data.filter(a => a.category === 'INCOME').reduce((sum, a) => sum + a.balance, 0),
        expenses: data.filter(a => a.category === 'EXPENSE').reduce((sum, a) => sum + a.balance, 0),
    };

    const profit = summary.income - summary.expenses;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Health Dashboard Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-primary/5 border-primary/10 shadow-sm overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Wallet className="w-3.5 h-3.5" /> สินทรัพย์รวม
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(summary.assets)}</p>
                    </CardContent>
                    <div className="absolute -right-2 -bottom-2 opacity-10 rotate-12">
                        <Wallet className="w-20 h-20" />
                    </div>
                </Card>

                <Card className="bg-orange-50 border-orange-100 shadow-sm overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-orange-500" /> หนี้สินรวม
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.liabilities)}</p>
                    </CardContent>
                    <div className="absolute -right-2 -bottom-2 opacity-10 rotate-12">
                        <Activity className="w-20 h-20 text-orange-500" />
                    </div>
                </Card>

                <Card className={profit >= 0 ? "bg-green-50 border-green-100 shadow-sm" : "bg-red-50 border-red-100 shadow-sm"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <PieChart className="w-3.5 h-3.5" /> กำไร/ขาดทุน สุทธิ
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(Math.abs(profit))}
                            </p>
                            {profit > 0 ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-muted/10 border-muted-foreground/10 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            สถานะสมดุล
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant={Math.abs(summary.assets - (summary.liabilities + summary.equity + profit)) < 0.01 ? "outline" : "destructive"} className="text-xs">
                            {Math.abs(summary.assets - (summary.liabilities + summary.equity + profit)) < 0.01 ? "สมบูรณ์ (Balanced)" : "ไม่สมดุล (Unbalanced)"}
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            {/* Trial Balance Detail Table */}
            <Card className="border-none shadow-none bg-transparent">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">รายละเอียดรายการบัญชี (Account Summary)</h3>
                </div>
                <div className="bg-background border rounded-xl overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="w-[120px]">รหัสบัญชี</TableHead>
                                <TableHead>ชื่อบัญชี</TableHead>
                                <TableHead>หมวดหมู่</TableHead>
                                {mode === 'advanced' && (
                                    <>
                                        <TableHead className="text-right">เดบิตรวม (Total Debit)</TableHead>
                                        <TableHead className="text-right">เครดิตรวม (Total Credit)</TableHead>
                                    </>
                                )}
                                <TableHead className="text-right">ยอดคงเหลือสุทธิ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((acc) => (
                                <TableRow
                                    key={acc.id}
                                    className="hover:bg-primary/5 transition-colors cursor-pointer"
                                    onClick={() => onDrillDown?.(acc.id)}
                                >
                                    <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                                    <TableCell className="font-medium">{acc.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] font-normal">
                                            {acc.category}
                                        </Badge>
                                    </TableCell>
                                    {mode === 'advanced' && (
                                        <>
                                            <TableCell className="text-right font-mono text-xs">{formatCurrency(acc.totalDebit)}</TableCell>
                                            <TableCell className="text-right font-mono text-xs">{formatCurrency(acc.totalCredit)}</TableCell>
                                        </>
                                    )}
                                    <TableCell className={`text-right font-bold ${acc.balance < 0 ? 'text-red-500' : ''}`}>
                                        {formatCurrency(acc.balance)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
