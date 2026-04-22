'use client';

import React, { useState } from 'react';
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
    FileText,
    ExternalLink,
    ChevronDown,
    ChevronRight,
    Clock,
    CheckCircle2,
    Ban,
    ArrowRightLeft,
    AlertCircle,
    HelpCircle,
    Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface JournalTableProps {
    data: any[];
    mode?: 'simple' | 'advanced';
    filterByAccountId?: string;
    onClearFilter?: () => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    SALE_INVOICE: { label: 'รายการขาย (Invoice)', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: FileText },
    PURCHASE_TAX: { label: 'ซื้อสินค้า/ค่าใช้จ่าย (Expenses)', color: 'text-orange-600 bg-orange-50 border-orange-100', icon: ArrowRightLeft },
    PAYMENT_RECEIPT: { label: 'รับชำระเงิน (Receipt)', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
    JOURNAL_VOUCHER: { label: 'รายการแยกประเภท (JV)', color: 'text-purple-600 bg-purple-50 border-purple-100', icon: FileText },
    WHT_CERTIFICATE: { label: 'ภาษีหัก ณ ที่จ่าย (WHT)', color: 'text-rose-600 bg-rose-50 border-rose-100', icon: Ban },
};

export function JournalTable({ data, mode = 'simple', filterByAccountId, onClearFilter }: JournalTableProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Filter data if filterByAccountId is provided
    const filteredData = filterByAccountId
        ? data.filter(j => j.lines.some((line: any) => line.accountId === filterByAccountId))
        : data;

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedRows(newExpanded);
    };

    // Stats for Summary Cards
    const stats = {
        draft: filteredData.filter(j => j.status === 'DRAFT').length,
        posted: filteredData.filter(j => j.status === 'POSTED').length,
        voided: filteredData.filter(j => j.status === 'VOIDED').length,
        totalAmount: filteredData.reduce((sum, j) => money.add(sum, j.totalAmount), 0)
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-sm border-none bg-blue-50/50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">รอดำเนินการ (Draft)</p>
                            <p className="text-2xl font-bold text-blue-700">{stats.draft}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-emerald-50/50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">ลงบัญชีแล้ว (Posted)</p>
                            <p className="text-2xl font-bold text-emerald-700">{stats.posted}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-red-50/50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-red-500/10 rounded-xl">
                            <Ban className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">ยกเลิก (Voided)</p>
                            <p className="text-2xl font-bold text-red-700">{stats.voided}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-muted/30">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <ArrowRightLeft className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">มูลค่ารวม (Total)</p>
                            <p className="text-xl font-bold">{money.format(stats.totalAmount)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="border rounded-2xl shadow-sm overflow-hidden bg-background">
                {filterByAccountId && (
                    <div className="bg-primary/5 px-4 py-2 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-primary">
                            <Activity className="w-4 h-4" />
                            <span>กำลังกรองข้อมูลสำหรับผังบัญชี (Filtering by Account)</span>
                            <Badge variant="outline" className="bg-white border-primary/20 text-primary">
                                {filterByAccountId}
                            </Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClearFilter}
                            className="h-7 text-xs text-primary hover:bg-primary/10"
                        >
                            <AlertCircle className="w-3 h-3 mr-1" />
                            ล้างการกรอง (Clear Filter)
                        </Button>
                    </div>
                )}
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="w-[120px]">วันที่</TableHead>
                            <TableHead className="w-[140px]">เลขที่รายการ</TableHead>
                            <TableHead className="w-[180px]">ประเภทรายการ</TableHead>
                            <TableHead>คำอธิบาย</TableHead>
                            {mode === 'advanced' && (
                                <>
                                    <TableHead className="w-[150px] text-right">เดบิต (Debit)</TableHead>
                                    <TableHead className="w-[150px] text-right">เครดิต (Credit)</TableHead>
                                </>
                            )}
                            {mode === 'simple' && (
                                <TableHead className="w-[150px] text-right">จำนวนเงินรวม</TableHead>
                            )}
                            <TableHead className="w-[120px] text-center">สถานะ</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.map((journal) => {
                            const isExpanded = expandedRows.has(journal.id);
                            const typeConfig = TYPE_LABELS[journal.sourceType] || { label: journal.sourceType, color: 'bg-muted', icon: HelpCircle };

                            return (
                                <React.Fragment key={journal.id}>
                                    <TableRow className={cn(
                                        "group cursor-pointer hover:bg-muted/5 transition-colors",
                                        isExpanded && "bg-muted/5 border-b-0"
                                    )} onClick={() => toggleExpand(journal.id)}>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">
                                            {format(new Date(journal.journalDate), 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-bold text-primary">
                                            {journal.entryNo}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("text-[10px] font-bold h-6 gap-1", typeConfig.color)}>
                                                <typeConfig.icon className="w-3 h-3" />
                                                {typeConfig.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[400px]">
                                            <div className="flex flex-col gap-1">
                                                <span className="truncate">{journal.description || '-'}</span>
                                                {journal.postingPurpose === 'VOID_REVERSAL' && (
                                                    <Badge variant="outline" className="w-fit bg-amber-50 text-amber-600 border-amber-200 text-[9px] py-0 h-4">
                                                        รายการกลับบัญชี (Reversing Entry)
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        {mode === 'advanced' ? (
                                            <>
                                                <TableCell className="text-right font-mono text-blue-600 font-medium">
                                                    {money.format(journal.totalAmount)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-red-600 font-medium">
                                                    {money.format(journal.totalAmount)}
                                                </TableCell>
                                            </>
                                        ) : (
                                            <TableCell className="text-right font-mono font-bold">
                                                {money.format(journal.totalAmount)}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-center">
                                            <Badge
                                                variant={journal.status === 'POSTED' ? 'secondary' : journal.status === 'VOIDED' ? 'destructive' : 'outline'}
                                                className="text-[10px] py-0"
                                            >
                                                {journal.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100">
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>

                                    {isExpanded && (
                                        <TableRow className="bg-muted/5 hover:bg-muted/5">
                                            <TableCell colSpan={mode === 'advanced' ? 9 : 8} className="p-0 border-t-0">
                                                <div className="px-14 pb-8 pt-2 space-y-6">
                                                    {/* Why this entry panel */}
                                                    <div className="bg-white/60 rounded-xl p-4 border border-dashed border-primary/20 flex items-start gap-3 shadow-inner">
                                                        <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-bold text-primary italic">&quot;ทำไมถึงมีรายการนี้?&quot;</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {journal.sourceType === 'SALE_INVOICE' && journal.postingPurpose !== 'VOID_REVERSAL' && 'รายการนี้ถูกสร้างจากการบันทึกยอดขาย (Invoice) เพื่อรับรู้รายได้และลูกหนี้การค้า'}
                                                                {journal.sourceType === 'PAYMENT_RECEIPT' && journal.postingPurpose !== 'VOID_REVERSAL' && 'รายการนี้เกิดจากการรับชำระเงินจากลูกค้า เพื่อล้างยอดลูกหนี้และรับเข้าเงินสด/ธนาคาร'}
                                                                {journal.postingPurpose === 'VOID_REVERSAL' && 'รายการนี้เป็นการกลับบัญชี (Reversal) เพื่อยกเลิกผลกระทบทางบัญชีของเอกสารที่ถูก Void'}
                                                                {journal.sourceType === 'PURCHASE_TAX' && 'รายการนี้ถูกสร้างจากการบันทึกยอดซื้อหรือค่าใช้จ่าย เพื่อรับรู้ต้นทุนและเจ้าหนี้การค้า'}
                                                                {journal.sourceType === 'JOURNAL_VOUCHER' && 'รายการนี้เป็นการปรับปรุงบัญชีด้วยตนเองโดยฝ่ายบัญชี'}
                                                                {journal.sourceType === 'WHT_CERTIFICATE' && 'รายการนี้เกิดจากการบันทึกภาษีหัก ณ ที่จ่าย'}
                                                            </p>
                                                        </div>
                                                        <div className="ml-auto">
                                                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 border-primary/20 text-primary hover:bg-primary/5">
                                                                ดูเอกสารอ้างอิง: {journal.sourceNo}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                                                        <Table>
                                                            <TableHeader className="bg-muted/20">
                                                                <TableRow>
                                                                    <TableHead className="w-[100px] text-xs font-bold">รหัส</TableHead>
                                                                    <TableHead className="text-xs font-bold">ชื่อบัญชี</TableHead>
                                                                    <TableHead className="text-xs font-bold">คำอธิบายรายบรรทัด</TableHead>
                                                                    <TableHead className="w-[120px] text-right text-xs font-bold">เดบิต (Debit)</TableHead>
                                                                    <TableHead className="w-[120px] text-right text-xs font-bold">เครดิต (Credit)</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {journal.lines?.map((line: any) => (
                                                                    <TableRow key={line.id} className="hover:bg-transparent">
                                                                        <TableCell className="font-mono text-[10px] text-muted-foreground">
                                                                            {line.account?.code}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs font-medium">
                                                                            {line.account?.name}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-muted-foreground italic">
                                                                            {line.description || '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-mono text-blue-600 font-bold text-xs">
                                                                            {line.debitAmount > 0 ? money.format(line.debitAmount) : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-mono text-red-600 font-bold text-xs">
                                                                            {line.creditAmount > 0 ? money.format(line.creditAmount) : '-'}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

