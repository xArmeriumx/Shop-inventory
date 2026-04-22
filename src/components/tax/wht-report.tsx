'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Download, FileBarChart, PieChart, Users, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { getWhtEntriesAction } from '@/actions/wht';
import { toast } from 'sonner';

export function WhtReport() {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [formType, setFormType] = useState('PND3');
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const result = await getWhtEntriesAction({ year, month, formType });
            if (result.success && result.data) {
                // Group by Payee
                const grouped = (result.data as any).data.reduce((acc: any, curr: any) => {
                    const key = curr.payeeTaxIdSnapshot;
                    if (!acc[key]) {
                        acc[key] = {
                            name: curr.payeeNameSnapshot,
                            taxId: curr.payeeTaxIdSnapshot,
                            count: 0,
                            gross: 0,
                            wht: 0
                        };
                    }
                    acc[key].count += 1;
                    acc[key].gross += Number(curr.grossPayableAmount);
                    acc[key].wht += Number(curr.whtAmount);
                    return acc;
                }, {});

                setReportData({
                    summary: result.data.totals,
                    payeeGroups: Object.values(grouped),
                    detailCount: (result.data as any).data.length
                });
            }
        } catch (error) {
            toast.error('ไม่สามารถดึงข้อมูลรายงานได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [month, year, formType]);

    const handleExport = () => {
        toast.info('ระบบกำลังเตรียมไฟล์ CSV สำหรับนำส่งกรมสรรพากร (RD Smart Tax)');
        // Placeholder for real export logic
    };

    return (
        <div className="space-y-6">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">ประเภทแบบ</span>
                        <Select value={formType} onValueChange={setFormType}>
                            <SelectTrigger className="w-[180px] h-10 font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PND3">ภ.ง.ด. 3 (บุคคล)</SelectItem>
                                <SelectItem value="PND53">ภ.ง.ด. 53 (นิติบุคคล)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">งวดเดือน</span>
                        <div className="flex gap-2">
                            <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                                <SelectTrigger className="w-[120px] h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                                            {new Date(0, i).toLocaleString('th-TH', { month: 'long' })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                                <SelectTrigger className="w-[90px] h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[year - 1, year, year + 1].map((y) => (
                                        <SelectItem key={y} value={y.toString()}>{y + 543}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <Button variant="outline" className="h-10" onClick={handleExport} disabled={!reportData || loading}>
                    <Download className="w-4 h-4 mr-2" />
                    ส่งออกใบแนบ (CSV)
                </Button>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <PieChart className="w-4 h-4" /> ยอดเงินที่จ่ายทั้งหมด
                        </CardDescription>
                        <CardTitle className="text-2xl">{loading ? '...' : formatCurrency(reportData?.summary?.base || 0)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-l-4 border-l-destructive shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <FileBarChart className="w-4 h-4" /> ภาษีหัก ณ ที่จ่ายรวม
                        </CardDescription>
                        <CardTitle className="text-2xl text-destructive">{loading ? '...' : formatCurrency(reportData?.summary?.tax || 0)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <Users className="w-4 h-4" /> จำนวนผู้ถูกหักภาษี
                        </CardDescription>
                        <CardTitle className="text-2xl">{loading ? '...' : `${reportData?.payeeGroups?.length || 0} ราย`}</CardTitle>
                        <CardDescription>{reportData?.detailCount || 0} รายการย่อย</CardDescription>
                    </CardHeader>
                </Card>
            </div>

            {/* Payee Aggregation Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">สรุปยอดตามรายชื่อผู้รับเงิน</CardTitle>
                    <CardDescription>สำหรับประกอบการกรอกใบแนบแบบ {formType}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">ลำดับ</TableHead>
                                <TableHead>เลขประจำตัวผู้เสียภาษี</TableHead>
                                <TableHead>ชื่อผู้ได้รับเงิน</TableHead>
                                <TableHead className="text-right">จำนวนครั้ง</TableHead>
                                <TableHead className="text-right">เงินได้รวม</TableHead>
                                <TableHead className="text-right">ภาษีรวม</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-20">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                                        <p className="mt-2 text-muted-foreground">กำลังคำนวณรายงาน...</p>
                                    </TableCell>
                                </TableRow>
                            ) : !reportData || reportData.payeeGroups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                                        ไม่พบข้อมูลการหักภาษีในงวดนี้
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportData.payeeGroups.map((payee: any, index: number) => (
                                    <TableRow key={payee.taxId}>
                                        <TableCell className="pl-6 font-medium text-muted-foreground">{index + 1}</TableCell>
                                        <TableCell className="font-mono text-sm">{payee.taxId}</TableCell>
                                        <TableCell className="font-medium">{payee.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary">{payee.count}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(payee.gross)}</TableCell>
                                        <TableCell className="text-right font-bold text-destructive">{formatCurrency(payee.wht)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
