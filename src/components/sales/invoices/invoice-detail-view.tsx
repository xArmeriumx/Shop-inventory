'use client';

import { useState } from 'react';
import { StatusBadgeGlass } from '@/components/ui/status-badge-glass';
import { ClientDate } from '@/components/ui/client-date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Wallet, PlusCircle, CheckCircle2, Receipt, ShieldCheck, ExternalLink } from 'lucide-react';
import { InvoiceActions } from '@/components/sales/invoices/invoice-actions';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Guard } from '@/components/core/auth/guard';
import { PaymentModal } from '@/components/accounting/finance/payment-modal';
import { FinancialTimeline } from '@/components/accounting/finance/financial-timeline';
import { PdfPrintTrigger } from '@/features/print/components/pdf-print-trigger';
import { buildInvoicePrintDTO } from '@/features/print/builders/invoice-print.builder';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PostingPreview } from '@/components/accounting/posting-preview';
import { WorkflowAssistant, WorkflowStep } from '@/components/ui/workflow-assistant';

interface InvoiceDetailViewProps {
    invoice: any;
    shop: any;
    payments?: any[];
    postingPreview?: any;
    journalEntry?: any;
}

const INVOICE_STATUS_MAP: Record<string, string> = {
    DRAFT: 'ฉบับร่าง',
    POSTED: 'บันทึกแล้ว',
    PAID: 'ชำระแล้ว',
    CANCELLED: 'ยกเลิกแล้ว',
};

export function InvoiceDetailView({ invoice, shop, payments = [], postingPreview, journalEntry }: InvoiceDetailViewProps) {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const router = useRouter();

    const totalAmount = Number(invoice.totalAmount);
    const residualAmount = Number(invoice.residualAmount);
    const paidAmount = Number(invoice.paidAmount || (totalAmount - residualAmount));
    const isFullyPaid = residualAmount <= 0;

    // T2 Tax Snapshots - Sanitize to Number to avoid Decimal warnings in Client Components
    const taxableBaseAmount = Number(invoice.taxableBaseAmount || 0);
    const taxAmount = Number(invoice.taxAmount || 0);
    const taxRate = Number(invoice.taxRateSnapshot || 0);
    const taxCode = invoice.taxCodeSnapshot as string | null;
    const isTaxInvoice = invoice.isTaxInvoice as boolean;
    const hasTax = taxAmount > 0;

    // Prepare print data using the builder (Deterministic)
    const printData = buildInvoicePrintDTO(invoice, shop);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <BackPageHeader
                backHref="/invoices"
                title={`ใบแจ้งหนี้ ${invoice.invoiceNo}`}
                description={`ลูกค้า: ${invoice.customerNameSnapshot ?? invoice.customer?.name ?? '-'}${isTaxInvoice ? ' · ใบกำกับภาษีเต็มรูป' : ''}`}
                className="flex-1 min-w-0"
                action={
                    <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto sm:justify-end">
                        {invoice.sale && (
                            <Button variant="outline" size="sm" asChild title={`อ้างอิงจากรายการขาย: ${invoice.sale.invoiceNumber}`} className="flex-1 sm:flex-none justify-start sm:justify-center">
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
                            size="sm"
                        />
                        <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
                    </div>
                }
            />

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6 min-w-0">
                    {/* Workflow Assistant - Premium Guided UX */}
                    <WorkflowAssistant
                        type="invoice"
                        status={invoice.status}
                        steps={[
                            ...(invoice.status === 'DRAFT' ? [{
                                label: 'เอกสารยังเป็นฉบับร่าง',
                                action: 'ยืนยันใบแจ้งหนี้',
                                description: 'สถานะฉบับร่างจะยังไม่ลงบัญชีและไม่มีผลต่อยอดค้างชำระ กรุณายืนยันเพื่อบันทึกบัญชีอัตโนมัติ',
                                isPrimary: true,
                                onClick: () => {
                                    // Trigger posting logic - assuming there's a post action in InvoiceActions or similar
                                    // For now we guide them to the action area
                                    const el = document.getElementById('invoice-actions');
                                    el?.scrollIntoView({ behavior: 'smooth' });
                                }
                            }] : !isFullyPaid ? [{
                                label: 'มียอดค้างชำระ',
                                action: 'บันทึกรับเงิน',
                                description: `รายการนี้ค้างชำระอยู่ ${formatCurrency(residualAmount)} กรุณาบันทึกการรับเงินเพื่อปิดยอดหลักฐานการเงิน`,
                                isPrimary: true,
                                onClick: () => setIsPaymentModalOpen(true)
                            }, {
                                label: 'สร้างใบสำคัญรับเงิน',
                                action: 'ไปหน้าบันทึกรับ',
                                description: 'ต้องการไปหน้าสร้างเอกสารใบสำคัญรับเงิน (Receipt) แบบเต็มรูปแบบ',
                                onClick: () => router.push(`/accounting/receipts/new?partnerId=${invoice.customerId}&invoiceId=${invoice.id}`)
                            }] : [{
                                label: 'ชำระครบถ้วนแล้ว',
                                action: 'ดูประวัติการชำระ',
                                description: 'รายการนี้ได้รับการชำระเงินครบถ้วนและลงบัญชีเรียบร้อยแล้ว',
                                onClick: () => {
                                    const el = document.getElementById('ledger-section');
                                    el?.scrollIntoView({ behavior: 'smooth' });
                                }
                            }])
                        ]}
                    />

                    {/* Safe Post Indicator for Confirmed Invoices */}
                    {journalEntry && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shadow-sm animate-in zoom-in-95 duration-500">
                            <div className="flex items-start sm:items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-full shrink-0">
                                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-emerald-800 text-sm">Safe Post: บันทึกข้อมูลบัญชีสำเร็จ (Verified GL Impact)</p>
                                    <p className="text-xs text-emerald-600 truncate sm:whitespace-normal">
                                        ลงสมุดรายวันเลขที่ <span className="font-mono font-bold underline cursor-help">{journalEntry.journalNo}</span> อย่างสมบูรณ์
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-emerald-700 hover:bg-emerald-100 border-emerald-200 w-full sm:w-auto" asChild>
                                <Link href="/settings/accounting">
                                    <ExternalLink className="w-4 h-4 mr-2" /> ดูรายการในแยกประเภท
                                </Link>
                            </Button>
                        </div>
                    )}

                    {/* Posting Preview for Draft Invoices */}
                    {invoice.status === 'DRAFT' && postingPreview && (
                        <PostingPreview
                            preview={postingPreview}
                            title="พรีวิวการลงบัญชีอัตโนมัติ (Automated Posting Preview)"
                        />
                    )}

                    {/* Snapshot Banner */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex items-start gap-3">
                        <FileText className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="font-semibold">Financial Snapshot Document</p>
                            <p className="opacity-80 leading-relaxed">
                                เอกสารนี้เป็น Snapshot ทางการเงิน ข้อมูลลูกค้าและรายการสินค้าจะถูกฟิกซ์ตั้งแต่วันที่ออกเอกสาร
                            </p>
                        </div>
                    </div>

                    {/* Customer Info Snapshot */}
                    <Card>
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-medium">ข้อมูลลูกค้า (Snapshot)</CardTitle>
                        </CardHeader>
                        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm p-4">
                            <div className="space-y-1">
                                <p className="text-muted-foreground">ชื่อลูกค้า</p>
                                <p className="font-semibold">{invoice.customerNameSnapshot}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">เลขประจำตัวผู้เสียภาษี</p>
                                <p className="font-semibold font-mono">{invoice.taxIdSnapshot || '-'}</p>
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                                <p className="text-muted-foreground text-xs uppercase tracking-wider">ที่อยู่สำหรับวางบิล (Billing Address)</p>
                                <p className="font-medium text-pretty">{invoice.billingAddressSnapshot}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Items Table */}
                    <Card>
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-medium">รายการสินค้า (Snapshot)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="min-w-[180px]">สินค้า</TableHead>
                                            <TableHead className="text-right">จำนวน</TableHead>
                                            <TableHead className="text-right">ราคา/หน่วย</TableHead>
                                            <TableHead className="text-right">ส่วนลด</TableHead>
                                            <TableHead className="text-right">ฐานภาษี</TableHead>
                                            <TableHead className="text-right">VAT</TableHead>
                                            <TableHead className="text-right">รวม</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(invoice.items as any[]).map((item: any) => (
                                            <TableRow key={item.id} className="text-sm">
                                                <TableCell>
                                                    <div className="font-medium truncate max-w-[200px]">{item.productNameSnapshot || item.description || item.product?.name}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        {item.skuSnapshot || item.product?.sku}
                                                        {item.taxCodeSnapshot && (
                                                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                                                                {item.taxCodeSnapshot}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">{item.quantity} {item.uomSnapshot}</TableCell>
                                                <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(item.unitPrice))}</TableCell>
                                                <TableCell className="text-right whitespace-nowrap text-red-500">
                                                    {Number(item.discountAmount) > 0 ? `-${formatCurrency(Number(item.discountAmount))}` : '-'}
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                                                    {formatCurrency(Number(item.taxableBaseAmount ?? item.lineSubtotalAmount))}
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    {Number(item.taxAmount) > 0
                                                        ? <span className="text-amber-600 font-medium">{formatCurrency(Number(item.taxAmount))}</span>
                                                        : <span className="text-muted-foreground text-xs">-</span>
                                                    }
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap font-semibold">{formatCurrency(Number(item.lineNetAmount))}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Financial Ledger */}
                    {/* ... keep Ledger section as is but maybe adjust positioning if needed ... */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2" id="ledger-section">
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
                                <StatusBadgeGlass
                                    status={INVOICE_STATUS_MAP[invoice.status] || invoice.status}
                                    variant={
                                        invoice.status === 'PAID' ? 'success' :
                                            invoice.status === 'CANCELLED' ? 'destructive' :
                                                invoice.status === 'POSTED' ? 'info' : 'default'
                                    }
                                />
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

                    {/* T2 Tax Summary Card */}
                    <Card className="border-amber-200 bg-amber-50/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-amber-600" />
                                สรุปภาษี (Tax Snapshot)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tax Code</span>
                                <Badge variant="outline" className="text-xs font-mono">
                                    {taxCode || 'NOVAT'}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">อัตรา VAT</span>
                                <span className="font-medium">{taxRate}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">ฐานภาษี</span>
                                <span className="font-medium">{formatCurrency(taxableBaseAmount)}</span>
                            </div>
                            {hasTax && (
                                <div className="flex justify-between text-amber-700">
                                    <span>VAT {taxRate}%</span>
                                    <span className="font-semibold">{formatCurrency(taxAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-2">
                                <span>ประเภทเอกสาร</span>
                                <span>{isTaxInvoice ? '✅ ใบกำกับภาษีเต็มรูป' : '📄 ใบแจ้งหนี้'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/10 border-primary/20">
                        <CardHeader>
                            <CardTitle>สรุปยอดเงิน</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">ยอดรวม (Gross)</span>
                                <span className="font-medium">{formatCurrency(Number(invoice.subtotalAmount))}</span>
                            </div>
                            {Number(invoice.discountAmount) > 0 && (
                                <div className="flex justify-between text-red-500">
                                    <span>ส่วนลดทั้งหมด</span>
                                    <span className="font-medium">-{formatCurrency(Number(invoice.discountAmount))}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                                <span>ฐานภาษี</span>
                                <span>{formatCurrency(taxableBaseAmount)}</span>
                            </div>
                            {hasTax && (
                                <div className="flex justify-between text-amber-700">
                                    <span>VAT {taxRate}%</span>
                                    <span className="font-medium">{formatCurrency(taxAmount)}</span>
                                </div>
                            )}
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-base">ยอดสุทธิ</span>
                                <span className="text-xl font-black text-primary">
                                    {formatCurrency(totalAmount)}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-green-600 italic">
                                <span>ชำระแล้ว</span>
                                <span className="font-medium">{formatCurrency(paidAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-primary/5 p-2 rounded">
                                <span className="font-bold">ยอดค้างชำระ</span>
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
