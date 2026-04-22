'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { money } from '@/lib/money';
import { formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, UserCircle, ArrowRightLeft, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatementEntry {
    id: string;
    date: Date;
    docType: string;
    docNo: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

interface PartnerStatementProps {
    data: {
        partnerId: string;
        partnerName: string;
        startDate: Date;
        endDate: Date;
        openingBalance: number;
        closingBalance: number;
        entries: StatementEntry[];
    };
    type: 'CUSTOMER' | 'SUPPLIER';
}

export const PartnerStatementView: React.FC<PartnerStatementProps> = ({ data, type }) => {
    const isCustomer = type === 'CUSTOMER';
    const totalDebit = data.entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = data.entries.reduce((sum, e) => sum + e.credit, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${isCustomer ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                        {isCustomer ? <UserCircle size={32} /> : <Landmark size={32} />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{data.partnerName}</h2>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <ArrowRightLeft size={14} />
                            Partner Statement: {formatDate(data.startDate)} — {formatDate(data.endDate)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2">
                        <Printer size={16} />
                        Print
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Download size={16} />
                        CSV
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-50 border-none shadow-sm">
                    <CardContent className="pt-6">
                        <p className="text-xs uppercase font-bold text-muted-foreground">Opening Balance / ยอดยกมา</p>
                        <p className="text-xl font-bold mt-1">{money.format(data.openingBalance)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-none shadow-sm">
                    <CardContent className="pt-6">
                        <p className="text-xs uppercase font-bold text-muted-foreground">Period Net Move / การเคลื่อนไหวสุทธิ</p>
                        <p className={`text-xl font-bold mt-1 ${isCustomer ? (totalDebit > totalCredit ? 'text-blue-600' : 'text-slate-900') : (totalCredit > totalDebit ? 'text-amber-600' : 'text-slate-900')}`}>
                            {money.format(isCustomer ? totalDebit - totalCredit : totalCredit - totalDebit)}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 text-white border-none shadow-lg">
                    <CardContent className="pt-6">
                        <p className="text-xs uppercase font-bold opacity-70">Closing Balance / ยอดคงเหลือ</p>
                        <p className="text-2xl font-bold mt-1">{money.format(data.closingBalance)}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-md">
                <CardHeader className="bg-slate-50/50 border-b">
                    <CardTitle className="text-lg">รายการความเคลื่อนไหว (Transaction Details)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">วันที่</TableHead>
                                <TableHead>ประเภท/เลขที่เอกสาร</TableHead>
                                <TableHead className="min-w-[200px]">คำอธิบาย</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="text-right font-bold bg-slate-50/50">Running Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-slate-50/30">
                                <TableCell className="text-muted-foreground italic">{formatDate(data.startDate)}</TableCell>
                                <TableCell colSpan={2} className="font-medium">ยอดยกมา (Opening Balance)</TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right font-bold bg-slate-50/30">{money.format(data.openingBalance)}</TableCell>
                            </TableRow>

                            {data.entries.map((entry) => (
                                <TableRow key={entry.id} className="hover:bg-slate-50 transition-colors">
                                    <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-mono font-bold text-blue-600">{entry.docNo}</span>
                                            <Badge variant="outline" className="w-fit text-[10px] h-4 mt-1">{entry.docType}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{entry.description}</TableCell>
                                    <TableCell className="text-right">{entry.debit > 0 ? money.format(entry.debit) : '-'}</TableCell>
                                    <TableCell className="text-right">{entry.credit > 0 ? money.format(entry.credit) : '-'}</TableCell>
                                    <TableCell className="text-right font-bold bg-slate-50/10">{money.format(entry.balance)}</TableCell>
                                </TableRow>
                            ))}

                            {data.entries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                        ไม่มีรายการเคลื่อนไหวในช่วงเวลานี้
                                    </TableCell>
                                </TableRow>
                            )}

                            <TableRow className="bg-slate-900 text-white font-bold">
                                <TableCell colSpan={3} className="text-right">Totals / รวมสุทธิ</TableCell>
                                <TableCell className="text-right">{money.format(totalDebit)}</TableCell>
                                <TableCell className="text-right">{money.format(totalCredit)}</TableCell>
                                <TableCell className="text-right text-indigo-300">{money.format(data.closingBalance)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-12 text-sm text-muted-foreground italic px-4">
                <p>* Debit: Increases AR (Asset) / Decreases AP (Liability)</p>
                <p>* Credit: Decreases AR (Asset) / Increases AP (Liability)</p>
            </div>
        </div>
    );
};
