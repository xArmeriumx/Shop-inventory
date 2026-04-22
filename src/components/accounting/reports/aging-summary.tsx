'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { money } from '@/lib/money';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, TrendingDown, Users, AlertTriangle } from 'lucide-react';

interface AgingBucket {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    daysOver90: number;
    total: number;
}

interface PartnerAging {
    partnerId: string;
    partnerName: string;
    buckets: AgingBucket;
}

interface AgingSummaryProps {
    type: 'AR' | 'AP';
    data: {
        summary: AgingBucket;
        partners: PartnerAging[];
    };
    onPartnerClick?: (partnerId: string) => void;
}

export const AgingSummary: React.FC<AgingSummaryProps> = ({ type, data, onPartnerClick }) => {
    const isAR = type === 'AR';
    const chartData = [
        { name: 'Current', value: data.summary.current, color: '#10b981' },
        { name: '1-30 Days', value: data.summary.days30, color: '#f59e0b' },
        { name: '31-60 Days', value: data.summary.days60, color: '#fbbf24' },
        { name: '61-90 Days', value: data.summary.days90, color: '#f87171' },
        { name: '90+ Days', value: data.summary.daysOver90, color: '#ef4444' },
    ];

    const getOverdueTotal = () => {
        const s = data.summary;
        return s.days30 + s.days60 + s.days90 + s.daysOver90;
    };

    const overduePercentage = data.summary.total > 0
        ? (getOverdueTotal() / data.summary.total) * 100
        : 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card className="border-none shadow-md overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <CalendarClock className="text-blue-500" />
                                    Account {isAR ? 'Receivable' : 'Payable'} Aging
                                </CardTitle>
                                <CardDescription>การวิเคราะห์อายุหนี้{isAR ? 'ลูกหนี้' : 'เจ้าหนี้'}แยกตามช่วงเวลา</CardDescription>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase font-bold text-muted-foreground">Total {isAR ? 'AR' : 'AP'}</p>
                                <p className="text-2xl font-bold text-slate-900">{money.format(data.summary.total)}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <YAxis hide />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-white p-3 shadow-xl border rounded-lg">
                                                        <p className="text-sm font-bold">{payload[0].payload.name}</p>
                                                        <p className="text-lg font-mono text-blue-600">{money.format(payload[0].value as number)}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users size={20} className="text-blue-500" />
                            Top 10 Partners
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y border-t">
                            {data.partners.slice(0, 10).map((p) => (
                                <div
                                    key={p.partnerId}
                                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group"
                                    onClick={() => onPartnerClick?.(p.partnerId)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                            {p.partnerName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{p.partnerName}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {p.buckets.daysOver90 > 0 && <Badge variant="destructive" className="text-[10px] h-4">90+ Days</Badge>}
                                                <span className="text-[10px] text-muted-foreground">Highest: {money.format(Math.max(p.buckets.current, p.buckets.days30, p.buckets.days60, p.buckets.days90, p.buckets.daysOver90))}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold font-mono">{money.format(p.buckets.total)}</p>
                                        <Progress value={(p.buckets.total / data.summary.total) * 100} className="h-1 w-24 mt-1" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className={`border-none shadow-md ${overduePercentage > 50 ? 'bg-rose-50' : 'bg-amber-50'}`}>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className={overduePercentage > 50 ? 'text-rose-500' : 'text-amber-500'} />
                            Health Check
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="opacity-70">Overdue Ratio</span>
                                <span className="font-bold">{overduePercentage.toFixed(1)}%</span>
                            </div>
                            <Progress value={overduePercentage} className="h-2" />
                        </div>
                        <div className="p-4 bg-white/50 rounded-lg space-y-3">
                            <div className="flex justify-between text-xs">
                                <span>Total Overdue:</span>
                                <span className="font-bold text-rose-600">{money.format(getOverdueTotal())}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span>90+ Days Risk:</span>
                                <span className="font-bold text-rose-800">{money.format(data.summary.daysOver90)}</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                            {overduePercentage > 30
                                ? "คำเตือน: สัดส่วนหนี้ค้างชำระสูงเกินเกณฑ์มาตรฐาน ควรติดตามการชำระเงินอย่างใกล้ชิด"
                                : "สุขภาพหนี้อยู่ในเกณฑ์ปกติ"}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-blue-900 text-white">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingDown size={20} />
                            Action Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="p-3 bg-white/10 rounded border border-white/10">
                            พบ {data.partners.filter(p => p.buckets.daysOver90 > 0).length} รายที่ค้างชำระเกิน 90 วัน
                        </div>
                        <div className="p-3 bg-white/10 rounded border border-white/10">
                            ยอดรอชำระใน 30 วัน: {money.format(data.summary.days30)}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
