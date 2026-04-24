'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAccountLedgerAction } from '@/actions/accounting/accounting.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { money } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Receipt, CalendarRange } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AccountLedgerPage({ params }: { params: { accountId: string } }) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    useEffect(() => {
        const fetchLedger = async () => {
            setIsLoading(true);
            try {
                const res = await getAccountLedgerAction({
                    accountId: params.accountId,
                    startDate,
                    endDate
                });
                if (res.success) {
                    setData(res.data);
                } else {
                    toast.error(res.message);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchLedger();
    }, [params.accountId, startDate, endDate]);

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-[500px] w-full" />
            </div>
        );
    }

    if (!data) return <div className="p-20 text-center">Data not found</div>;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft size={24} />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold tracking-tight">{data.account.name}</h1>
                            <Badge variant="outline" className="font-mono">{data.account.code}</Badge>
                        </div>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <CalendarRange size={14} />
                            รายการสมุดบัญชีรายตัว: {formatDate(startDate)} - {formatDate(endDate)}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase">Balance / ยอดคงเหลือ</p>
                    <p className={`text-2xl font-bold ${data.closingBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {money.format(data.closingBalance)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-50">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-muted-foreground">Opening Balance / ยอดยกมา</p>
                        <p className="text-2xl font-bold mt-1">{money.format(data.openingBalance)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-50/30 border-emerald-100">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-emerald-700">Total Net Change / ผลรวมรายการ</p>
                        <p className="text-2xl font-bold mt-1 text-emerald-700">
                            {money.format(data.closingBalance - data.openingBalance)}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 text-white">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium opacity-70">Closing Balance / ยอดยกไป</p>
                        <p className="text-2xl font-bold mt-1">{money.format(data.closingBalance)}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>รายการความเคลื่อนไหว (Ledger Lines)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[120px]">วันที่</TableHead>
                                <TableHead>เลขที่รายการ</TableHead>
                                <TableHead className="min-w-[200px]">คำอธิบาย</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="text-right font-bold bg-slate-100/50">Balance</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-slate-50/50">
                                <TableCell className="text-muted-foreground">{formatDate(startDate)}</TableCell>
                                <TableCell className="italic text-muted-foreground text-xs font-mono">OPENING_BAL</TableCell>
                                <TableCell className="font-medium font-mono text-xs">ยอดยกมาสะสม (Accumulated Balance)</TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right font-bold bg-slate-100/50">{money.format(data.openingBalance)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>

                            {data.lines.map((line: any) => (
                                <TableRow key={line.id} className="hover:bg-slate-50 transition-colors">
                                    <TableCell className="text-sm">{formatDate(line.date)}</TableCell>
                                    <TableCell>
                                        <Link
                                            href={`/accounting/journals?search=${line.entryNo}`}
                                            className="text-blue-600 hover:underline flex items-center gap-1 font-mono text-xs"
                                        >
                                            {line.entryNo}
                                            <ExternalLink size={10} />
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm">{line.description}</p>
                                        {line.sourceNo && (
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <Receipt size={10} /> Source: {line.sourceNo}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {line.debit > 0 ? money.format(line.debit) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {line.credit > 0 ? money.format(line.credit) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold bg-slate-100/30">
                                        {money.format(line.balance)}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" asChild>
                                            <Link href={`/accounting/journals?search=${line.entryNo}`}>
                                                <Receipt size={16} />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}

                            {data.lines.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                                        ไม่มีรายการความเคลื่อนไหวในช่วงเวลานี้
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
