'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getPartnerStatementAction } from '@/actions/accounting/accounting.actions';
import { PartnerStatementView } from '@/components/accounting/reports/partner-statement-view';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, CalendarRange, Filter, Search } from 'lucide-react';
import { getCustomers } from '@/actions/sales/customers.actions';
import { getSuppliers } from '@/actions/purchases/suppliers.actions';

export default function PartnerStatementPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const partnerId = searchParams.get('partnerId');
    const type = (searchParams.get('type') as 'CUSTOMER' | 'SUPPLIER') || 'CUSTOMER';

    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Partner List for Selector
    const [partners, setPartners] = useState<any[]>([]);
    const [isPartnersLoading, setIsPartnersLoading] = useState(false);

    useEffect(() => {
        const fetchPartners = async () => {
            setIsPartnersLoading(true);
            try {
                const res = type === 'CUSTOMER' ? await getCustomers() : await getSuppliers();
                if (res && res.data) {
                    setPartners(res.data);
                }
            } finally {
                setIsPartnersLoading(false);
            }
        };
        fetchPartners();
    }, [type]);

    useEffect(() => {
        if (!partnerId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await getPartnerStatementAction({
                    partnerId,
                    type,
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
        fetchData();
    }, [partnerId, type, startDate, endDate]);

    const handlePartnerChange = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('partnerId', id);
        router.push(`/accounting/reports/partner-statement?${params.toString()}`);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/accounting/reports/aging')}>
                        <ArrowLeft size={24} />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">ใบแจ้งยอดคู่ค้า (Partner Statement)</h1>
                        <p className="text-muted-foreground">ตรวจสอบความเคลื่อนไหวและยอดยกมาแยกตามคู่ค้า</p>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-slate-50/50">
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-muted-foreground">ประเภทคู่ค้า</label>
                        <select
                            value={type}
                            onChange={(e) => {
                                const newType = e.target.value;
                                const params = new URLSearchParams(searchParams.toString());
                                params.set('type', newType);
                                params.delete('partnerId'); // Reset partner when type changes
                                router.push(`/accounting/reports/partner-statement?${params.toString()}`);
                            }}
                            className="w-full p-2 border rounded-md bg-white text-sm"
                        >
                            <option value="CUSTOMER">ลูกหนี้ (Customer)</option>
                            <option value="SUPPLIER">เจ้าหนี้ (Supplier)</option>
                        </select>
                    </div>

                    <div className="md:col-span-1 space-y-1.5">
                        <label className="text-xs font-bold uppercase text-muted-foreground">เลือกคู่ค้า</label>
                        <select
                            value={partnerId || ''}
                            onChange={(e) => handlePartnerChange(e.target.value)}
                            className="w-full p-2 border rounded-md bg-white text-sm"
                        >
                            <option value="">-- เลือกคู่ค้า --</option>
                            {partners.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-muted-foreground">ตั้งแต่วันที่</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full p-2 border rounded-md bg-white text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-muted-foreground">ถึงวันที่</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full p-2 border rounded-md bg-white text-sm"
                        />
                    </div>
                </CardContent>
            </Card>

            {!partnerId ? (
                <div className="p-32 text-center border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">
                    <Search size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">กรุณาเลือกคู่ค้าเพื่อเรียกดู Statement</p>
                    <p className="text-sm opacity-70">เลือกประเภทและรายชื่อจากแถบด้านบนเพื่อเริ่มตรวจสอบข้อมูล</p>
                </div>
            ) : isLoading ? (
                <div className="space-y-6">
                    <Skeleton className="h-20 w-full" />
                    <div className="grid grid-cols-3 gap-4">
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                    </div>
                    <Skeleton className="h-80 w-full" />
                </div>
            ) : data ? (
                <PartnerStatementView data={data} type={type} />
            ) : (
                <div className="p-20 text-center text-muted-foreground">
                    พบข้อผิดพลาดในการโหลดข้อมูล
                </div>
            )}
        </div>
    );
}
