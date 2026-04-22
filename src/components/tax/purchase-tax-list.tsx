'use client';

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import Link from 'next/link';
import { Eye, FileText, AlertCircle } from 'lucide-react';

interface PurchaseTaxListProps {
    data: any[];
}

export function PurchaseTaxList({ data }: PurchaseTaxListProps) {
    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-muted/30">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">ไม่พบข้อมูลภาษีซื้อ</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2">
                    คุณยังไม่ได้จดทะเบียนภาษีซื้อจากใบสั่งซื้อ หรือยังไม่ได้สร้างเอกสารภาษีซื้อแมนนวล
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="w-[150px]">เลขที่เอกสารภายใน</TableHead>
                        <TableHead className="w-[150px]">เลขที่ใบกำกับภาษี</TableHead>
                        <TableHead>ผู้จำหน่าย</TableHead>
                        <TableHead className="text-right">จํานวนเงิน (สุทธิ)</TableHead>
                        <TableHead className="text-right">ภาษี (VAT)</TableHead>
                        <TableHead className="text-center">สถานะ</TableHead>
                        <TableHead className="text-center">สิทธิการเคลม</TableHead>
                        <TableHead className="text-right">การกระทำ</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                                <Link href={`/tax/purchase-tax/${doc.id}`} className="hover:underline text-primary">
                                    {doc.internalDocNo}
                                </Link>
                                <div className="text-[10px] text-muted-foreground">
                                    {format(new Date(doc.createdAt), 'dd MMM yy HH:mm', { locale: th })}
                                </div>
                            </TableCell>
                            <TableCell>
                                {doc.vendorDocNo || (
                                    <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        รอเลขที่
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="font-medium line-clamp-1">{doc.vendorNameSnapshot}</div>
                                <div className="text-xs text-muted-foreground">{doc.vendorTaxIdSnapshot || 'ไม่มีเลขประจำตัวผู้เสียภาษี'}</div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                                {formatCurrency(Number(doc.netAmount))}
                            </TableCell>
                            <TableCell className="text-right text-blue-600">
                                {formatCurrency(Number(doc.taxAmount))}
                                <div className="text-[10px]">({doc.taxRateSnapshot}%)</div>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant={
                                    doc.status === 'POSTED' ? 'default' :
                                        doc.status === 'VOIDED' ? 'destructive' :
                                            'secondary'
                                }>
                                    {doc.status === 'POSTED' ? 'ลงบัญชีแล้ว' :
                                        doc.status === 'VOIDED' ? 'ยกเลิก' :
                                            'ฉบับร่าง'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant="outline" className={
                                    doc.claimStatus === 'CLAIMABLE' ? 'text-green-600 border-green-200' :
                                        doc.claimStatus === 'WAITING_DOC' ? 'text-blue-600 border-blue-200' :
                                            'text-gray-600 border-gray-200'
                                }>
                                    {doc.claimStatus === 'CLAIMABLE' ? 'ขอคืนได้' :
                                        doc.claimStatus === 'WAITING_DOC' ? 'รอเอกสาร' :
                                            'ไม่ขอคืน'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="ghost" size="icon">
                                    <Link href={`/tax/purchase-tax/${doc.id}`}>
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
