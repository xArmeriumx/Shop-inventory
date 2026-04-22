'use client';

import React, { useState, useEffect } from 'react';
import { getAgingReportAction } from '@/actions/accounting';
import { AgingSummary } from '@/components/accounting/reports/aging-summary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { RefreshCw, Download, FileText, Filter, CalendarCheck } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';

export default function AgingReportPage() {
    const [type, setType] = useState<'AR' | 'AP'>('AR');
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const router = useRouter();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await getAgingReportAction({ type, asOfDate });
            if (res.success) {
                setData(res.data);
            } else {
                toast.error(res.error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [type, asOfDate]);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">รายงานอายุหนี้ (Aging Report)</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        <CalendarCheck size={14} />
                        ข้อมูลสรุปยอดลูกหนี้และเจ้าหนี้ค้างชำระ ณ วันที่ {formatDate(asOfDate)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        className="p-2 border rounded-md text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </Button>
                    <Button className="gap-2 bg-slate-900">
                        <Download size={16} />
                        Export
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="AR" onValueChange={(val) => setType(val as 'AR' | 'AP')}>
                <div className="flex items-center justify-between bg-white p-1 rounded-lg border shadow-sm mb-6">
                    <TabsList className="bg-transparent border-none">
                        <TabsTrigger value="AR" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 px-8 py-2">
                            ลูกหนี้ (Account Receivable)
                        </TabsTrigger>
                        <TabsTrigger value="AP" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 px-8 py-2">
                            เจ้าหนี้ (Account Payable)
                        </TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2 px-4 border-l text-sm text-muted-foreground">
                        <Filter size={14} />
                        Filter: All Partners
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-6">
                        <Skeleton className="h-[400px] w-full rounded-xl" />
                        <div className="grid grid-cols-2 gap-6">
                            <Skeleton className="h-[200px] rounded-xl" />
                            <Skeleton className="h-[200px] rounded-xl" />
                        </div>
                    </div>
                ) : data ? (
                    <TabsContent value={type} className="mt-0">
                        <AgingSummary
                            type={type}
                            data={data}
                            onPartnerClick={(id) => router.push(`/accounting/reports/partner-statement?partnerId=${id}&type=${type === 'AR' ? 'CUSTOMER' : 'SUPPLIER'}`)}
                        />
                    </TabsContent>
                ) : (
                    <div className="p-20 text-center border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">
                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                        ไม่พบข้อมูลในช่วงเวลาที่กำหนด
                    </div>
                )}
            </Tabs>
        </div>
    );
}
