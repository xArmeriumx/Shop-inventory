'use client';

import { useState } from 'react';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Wallet, PlusCircle, CheckCircle2 } from 'lucide-react';
import { InvoiceActions } from '@/components/invoices/invoice-actions';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Guard } from '@/components/auth/guard';
import { PaymentModal } from '@/components/finance/payment-modal';
import { FinancialTimeline } from '@/components/finance/financial-timeline';
import { PdfPrintTrigger } from '@/features/print/components/pdf-print-trigger';
import { buildInvoicePrintDTO } from '@/features/print/builders/invoice-print.builder';
import Link from 'next/link';

interface InvoiceDetailViewProps {
    invoice: any;
    shop: any;
    payments?: any[];
}

const INVOICE_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: { label: 'ฉบับร่าง', variant: 'secondary' },
    POSTED: { label: 'บันทึกแล้ว', variant: 'outline', className: 'border-blue-500 text-blue-600' },
    PAID: { label: 'ชำระแล้ว', variant: 'default', className: 'bg-green-600' },
    CANCELLED: { label: 'ยกเลิกแล้ว', variant: 'destructive' },
};

export function InvoiceDetailView({ invoice, shop, payments = [] }: InvoiceDetailViewProps) {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const totalAmount = Number(invoice.totalAmount);
    const residualAmount = Number(invoice.residualAmount);
    const paidAmount = Number(invoice.paidAmount || (totalAmount - residualAmount));
    const isFullyPaid = residualAmount <= 0;

    // Prepare print data using the builder (Deterministic)
    const printData = buildInvoicePrintDTO(invoice, shop);

    return (
        <div className="p-6 space-y-6">
            <BackPageHeader
                backHref="/invoices"
                title={`ใบแจ้งหนี้ ${invoice.invoiceNo}`}
                description={`ลูกค้า: ${invoice.customerNameSnapshot ?? invoice.customer?.name ?? '-'}`}
                action={
                    <div className="flex gap-2 items-center">
                        {invoice.sale && (
                            <Button variant="outline" size="sm" asChild title={`อ้างอิงจากรายการขาย: ${invoice.sale.invoiceNumber}`}>
                                <Link href={`/sales/${invoice.sale.id}`}>
                                    <FileText className="mr-2 h-4 w-4" /> ดูใบขาย
                                </Link>
                            </Button>
                        )}
                        <PdfPrintTrigger
                            type="INVOICE"
                            documentData={printData}
                            fileName={`Invoice-${invoice.invoiceNo}.pdf`}
                            label="พิมพ์ใบแจ้งหนี้ (PDF)"
                        />
                        <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
                    </div>
                }
            />

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    {/* Snapshot Banner */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex items-start gap-3">
                        <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                            <p className="font-semibold">Financial Snapshot Document</p>
                            <p className="opacity-80">
                                เอกสารนี้เป็น Snapshot ทางการเงิน ข้อมูลลูกค้าและรายการสินค้าจะถูกฟิกซ์ตั้งแต่วันที่ออกเอกสาร
                                การแก้ไขข้อมูลมาสเตอร์ (ชื่อลูกค้า/ราคาสินค้า) จะไม่มีผลย้อนหลังกับใบแจ้งหนี้ใบนี้
                            </p>
                        </div>
                    </div>

                    {/* Customer Info Snapshot */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">ข้อมูลลูกค้า (Snapshot)</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <p className="text-muted-foreground">ชื่อลูกค้า</p>
                                <p className="font-medium">{invoice.customerNameSnapshot}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">เลขประจำตัวผู้เสียภาษี</p>
                                <p className="font-medium">{invoice.taxIdSnapshot || '-'}</p>
                            </div>
                            <div className="md:col-span-2 space-y-1">
                                <p className="text-muted-foreground">ที่อยู่สำหรับวางบิล (Billing Address)</p>
                                <p className="font-medium">{invoice.billingAddressSnapshot}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Items Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>รายการสินค้า (Snapshot)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>สินค้า</TableHead>
                                        <TableHead className="text-right">จำนวน</TableHead>
                                        <TableHead className="text-right">ราคา/หน่วย</TableHead>
                                        <TableHead className="text-right">ส่วนลด</TableHead>
                                        <TableHead className="text-right">รวม</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(invoice.items as any[]).map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="font-medium">{item.productNameSnapshot || item.description || item.product?.name}</div>
                                                <div className="text-xs text-muted-foreground">{item.skuSnapshot || item.product?.sku}</div>
                                            </TableCell>
                                            <TableCell className="text-right">{item.quantity} {item.uomSnapshot}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                                            <TableCell className="text-right text-red-500">
                                                {Number(item.discountAmount) > 0 ? `-${formatCurrency(Number(item.discountAmount))}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(Number(item.lineNetAmount))}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Financial Ledger */}
                    {/* ... keep Ledger section as is but maybe adjust positioning if needed ... */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wallet className="h-5 w-5 text-primary" />
                                <CardTitle>ประวัติการชำระเงิน (Ledger)</CardTitle>
                            </div>
                            {!isFullyPaid && invoice.status !== 'CANCELLED' && (
                                <Guard permission={'PAYMENT_RECORD' as any}>
                                    <Button size="sm" onClick={() => setIsPaymentModalOpen(true)}>
                                        <PlusCircle className="h-4 w-4 mr-2" />
                                        บันทึกการชำระ
                                    </Button>
                                </Guard>
                            )}
                        </CardHeader>
                        <CardContent>
                            <FinancialTimeline
                                payments={payments}
                                invoiceId={invoice.id}
                                totalAmount={totalAmount}
                                paidAmount={paidAmount}
                                residualAmount={residualAmount}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Summary Sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>สถานะเอกสาร</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">สถานะ</span>
                                <StatusBadge status={invoice.status} config={INVOICE_STATUS_CONFIG} />
                            </div>
                            <div className="flex justify-between items-center border-t pt-2">
                                <span className="text-muted-foreground">วันที่ออก</span>
                                <ClientDate date={invoice.date} />
                            </div>
                            {invoice.dueDate && (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">วันครบกำหนด</span>
                                    <ClientDate date={invoice.dueDate} />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/10 border-primary/20">
                        <CardHeader>
                            <CardTitle>สรุปยอดเงิน</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">ยอดรวมสินค้า (Gross)</span>
                                <span className="font-medium">{formatCurrency(Number(invoice.subtotalAmount))}</span>
                            </div>
                            <div className="flex justify-between text-red-500">
                                <span>ส่วนลดทั้งหมด</span>
                                <span className="font-medium">-{formatCurrency(Number(invoice.discountAmount))}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>ภาษีมูลค่าเพิ่ม (0%)</span>
                                <span className="font-medium">{formatCurrency(Number(invoice.taxAmount))}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-base">ยอดสุทธิที่ต้องชำระ</span>
                                <span className="text-xl font-black text-primary">
                                    {formatCurrency(totalAmount)}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-green-600 italic">
                                <span>ชำระแลัว</span>
                                <span className="font-medium">{formatCurrency(paidAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-primary/5 p-2 rounded">
                                <span className="font-bold">ยอดเงินคงเหลือ</span>
                                <span className={`text-xl font-black ${isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(residualAmount)}
                                </span>
                            </div>
                            {isFullyPaid ? (
                                <Badge className="w-full justify-center py-2 bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                    <CheckCircle2 className="h-4 w-4 mr-2" /> ชำระครบถ้วนแล้ว
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="w-full justify-center py-2 border-red-200 text-red-600 bg-red-50">
                                    รอชำระ {formatCurrency(residualAmount)}
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                invoiceId={invoice.id}
                residualAmount={residualAmount}
                parentTitle={`ใบแจ้งหนี้ ${invoice.invoiceNo}`}
            />
        </div>
    );
}
