'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Calculator,
    FileText,
    Download,
    ChevronRight,
    PieChart,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';
import { getVatReport } from '@/actions/tax';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function VatReportDashboard() {
    const [isPending, startTransition] = useTransition();
    const [report, setReport] = useState<any>(null);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    const fetchReport = () => {
        startTransition(async () => {
            const res = await getVatReport(month, year);
            if (res.success) {
                setReport(res.data);
            } else {
                toast.error(res.message);
            }
        });
    };

    useEffect(() => {
        fetchReport();
    }, [month, year]);

    const summary = report?.summary;

    return (
        <div className="space-y-6">
            {/* Search & Filter Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 border rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-lg">งวดภาษี (Tax Period)</h2>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="เลือกเดือน" />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 12 }).map((_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                    เดือน {i + 1}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="เลือกปี" />
                        </SelectTrigger>
                        <SelectContent>
                            {[2024, 2025, 2026].map((y) => (
                                <SelectItem key={y} value={y.toString()}>
                                    ค.ศ. {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={fetchReport} disabled={isPending}>
                        <Download className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {isPending && !report ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-l-4 border-l-blue-500 shadow-md">
                            <CardContent className="pt-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">ภาษีขาย (Sales Tax)</p>
                                        <h3 className="text-2xl font-bold mt-1">{formatCurrency(summary?.sales?.taxAmount || 0)}</h3>
                                    </div>
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <ArrowUpRight className="w-5 h-5 text-blue-600" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-4">
                                    จากฐานภาษี: {formatCurrency(summary?.sales?.taxableBase || 0)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-orange-500 shadow-md">
                            <CardContent className="pt-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">ภาษีซื้อ (Purchase Tax)</p>
                                        <h3 className="text-2xl font-bold mt-1">{formatCurrency(summary?.purchases?.claimableAmount || 0)}</h3>
                                    </div>
                                    <div className="p-2 bg-orange-50 rounded-lg">
                                        <ArrowDownRight className="w-5 h-5 text-orange-600" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-4">
                                    ใช้ได้จริงจากภาษีซื้อทั้งหมด: {formatCurrency(summary?.purchases?.taxAmount || 0)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className={`border-l-4 shadow-md ${summary?.netVat >= 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
                            <CardContent className="pt-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">ภาษีที่ต้องชำระ (Net Payable)</p>
                                        <h3 className={`text-2xl font-bold mt-1 ${summary?.netVat >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency(Math.abs(summary?.netVat || 0))}
                                        </h3>
                                    </div>
                                    <div className={`p-2 rounded-lg ${summary?.netVat >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                                        <PieChart className={`w-5 h-5 ${summary?.netVat >= 0 ? 'text-red-600' : 'text-green-600'}`} />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-4">
                                    {summary?.netVat >= 0 ? 'ชำระภาษีเพิ่ม (Payable)' : 'ภาษีชำระเกิน (Tax Credit)'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>รายการสรุป ภ.พ. 30 (PP30 Summary)</CardTitle>
                                    <CardDescription>การคำนวณตามแบบแสดงรายการภาษีมูลค่าเพิ่ม</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" className="text-primary">
                                    <FileText className="w-4 h-4 mr-2" />
                                    ดูรายละเอียดรายวัน
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ลำดับ (Line)</TableHead>
                                            <TableHead>รายการ (Description)</TableHead>
                                            <TableHead className="text-right">จำนวนเงิน (Amount)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">1</TableCell>
                                            <TableCell>ยอดขายสินค้าและบริการทังหมด (Total Sales)</TableCell>
                                            <TableCell className="text-right">{formatCurrency(summary?.sales?.taxableBase || 0)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">2</TableCell>
                                            <TableCell className="pl-8 text-muted-foreground italic">หัก: ยอดขายเสียภาษีร้อยละ 0 (Zero-Rated Sales)</TableCell>
                                            <TableCell className="text-right">0.00</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">3</TableCell>
                                            <TableCell className="pl-8 text-muted-foreground italic">หัก: ยอดขายที่ได้รับยกเว้นภาษี (Exempt Sales)</TableCell>
                                            <TableCell className="text-right">0.00</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-muted/10">
                                            <TableCell className="font-medium">4</TableCell>
                                            <TableCell className="font-semibold">ยอดขายที่ต้องเสียภาษี (Taxable Sales)</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(summary?.sales?.taxableBase || 0)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">5</TableCell>
                                            <TableCell className="font-semibold text-primary">ภาษีขาย (Output VAT)</TableCell>
                                            <TableCell className="text-right font-bold text-primary">{formatCurrency(summary?.sales?.taxAmount || 0)}</TableCell>
                                        </TableRow>
                                        <TableRow className="border-t-2">
                                            <TableCell className="font-medium">6</TableCell>
                                            <TableCell>ยอดซื้อที่นำมาหักภาษีได้ (Taxable Purchases)</TableCell>
                                            <TableCell className="text-right">{formatCurrency(summary?.purchases?.taxableBase || 0)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">7</TableCell>
                                            <TableCell className="font-semibold text-orange-600">ภาษีซื้อ (Input VAT)</TableCell>
                                            <TableCell className="text-right font-bold text-orange-600">{formatCurrency(summary?.purchases?.claimableAmount || 0)}</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-primary/5">
                                            <TableCell className="font-medium"></TableCell>
                                            <TableCell className="font-bold">ภาษีมูลค่าเพิ่มที่ต้องชำระ (Net VAT to Pay/Claim)</TableCell>
                                            <TableCell className={`text-right font-bold ${summary?.netVat >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {formatCurrency(summary?.netVat || 0)}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
