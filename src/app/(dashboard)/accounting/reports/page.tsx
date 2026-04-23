'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getProfitAndLossAction, getBalanceSheetAction } from '@/actions/accounting';
import { PnLReport } from '@/components/accounting/reports/pnl-report';
import { BalanceSheetReport } from '@/components/accounting/reports/balance-sheet-report';
import { Calendar, RefreshCw, FileText, BarChart3, PieChart, Package } from 'lucide-react';
import { AuditPackModal } from '@/components/accounting/reports/audit-pack-modal';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function ReportingDashboardPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('pnl');
    const [isLoading, setIsLoading] = useState(true);

    // Dates
    const now = new Date();
    const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);
    const [asOfDate, setAsOfDate] = useState(now.toISOString().split('T')[0]);

    // Data
    const [pnlData, setPnlData] = useState<any>(null);
    const [bsData, setBsData] = useState<any>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'pnl') {
                const res = await getProfitAndLossAction({ startDate, endDate });
                if (res.success) setPnlData(res.data);
                else toast.error(res.message);
            } else {
                const res = await getBalanceSheetAction({ asOfDate });
                if (res.success) setBsData(res.data);
                else toast.error(res.message);
            }
        } catch (error) {
            toast.error('Failed to load report data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleDrillDown = (accountId: string) => {
        // Navigate to the Account Ledger page with the current date range
        router.push(`/accounting/reports/ledger/${accountId}?startDate=${startDate}&endDate=${endDate}`);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">รายงานการเงิน (Financial Reports)</h1>
                    <p className="text-muted-foreground">สรุปผลการดำเนินงานและฐานะการเงินของธุรกิจ (Ledger-based)</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2" onClick={fetchData}>
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        รีเฟรช
                    </Button>
                    <AuditPackModal />
                </div>
            </div>

            <Tabs defaultValue="pnl" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border">
                    <TabsList className="bg-slate-100 p-1">
                        <TabsTrigger value="pnl" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                            <BarChart3 size={16} />
                            กำไรขาดทุน (P&L)
                        </TabsTrigger>
                        <TabsTrigger value="bs" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                            <PieChart size={16} />
                            งบแสดงฐานะการเงิน (B/S)
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex flex-wrap items-center gap-4">
                        {activeTab === 'pnl' ? (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Start Date</label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="h-9 w-40"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">End Date</label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="h-9 w-40"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">As of Date</label>
                                <Input
                                    type="date"
                                    value={asOfDate}
                                    onChange={(e) => setAsOfDate(e.target.value)}
                                    className="h-9 w-44"
                                />
                            </div>
                        )}
                        <Button className="h-9" onClick={fetchData}>
                            คำนวณข้อมูล
                        </Button>
                    </div>
                </div>

                <TabsContent value="pnl" className="mt-0">
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-40 w-full" />
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-[400px]" />
                                <Skeleton className="h-[400px]" />
                            </div>
                        </div>
                    ) : pnlData ? (
                        <PnLReport data={pnlData} onDrillDown={handleDrillDown} />
                    ) : (
                        <Card><CardContent className="p-20 text-center text-muted-foreground">ไม่มีข้อมูลในช่วงที่เลือก</CardContent></Card>
                    )}
                </TabsContent>

                <TabsContent value="bs" className="mt-0">
                    {isLoading ? (
                        <div className="space-y-6">
                            <Skeleton className="h-20 w-full" />
                            <div className="grid grid-cols-2 gap-8">
                                <Skeleton className="h-[500px]" />
                                <Skeleton className="h-[500px]" />
                            </div>
                        </div>
                    ) : bsData ? (
                        <BalanceSheetReport data={bsData} onDrillDown={handleDrillDown} />
                    ) : (
                        <Card><CardContent className="p-20 text-center text-muted-foreground">ไม่มีข้อมูล ณ วันที่เลือก</CardContent></Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
