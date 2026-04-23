'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';
import { Send, Truck, RotateCcw, Wallet, PlusCircle, CheckCircle2, FilePlus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { calculateCtn } from '@/lib/erp-utils';
import { PrintButton } from '@/components/sales/print-button';
import { ReceiptImage } from '@/components/receipts/receipt-image';
import { ShipmentStatusBadge } from '@/components/shipments/shipment-status-badge';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { Guard } from '@/components/auth/guard';
import { PaymentModal } from '@/components/finance/payment-modal';
import { FinancialTimeline } from '@/components/finance/financial-timeline';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createInvoiceFromSale } from '@/actions/invoices';
import { PdfPrintTrigger } from '@/features/print/components/pdf-print-trigger';
import { buildSalePrintDTO } from '@/features/print/builders/sale-print.builder';
import { WorkflowAssistant } from '@/components/ui/workflow-assistant';
import { StatusBadgeGlass } from '@/components/ui/status-badge-glass';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SaleDetailViewProps {
    sale: any;
    shop: any;
    payments?: any[];
}

// ─── SaleDetailView ──────────────────────────────────────────────────────────────

/**
 * Renders the complete sale detail receipt view.
 * Extracted from sales/[id]/page.tsx to keep the page file thin.
 */
export function SaleDetailView({ sale, shop, payments = [] }: SaleDetailViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const zonedDate = toZonedTime(sale.date, 'Asia/Bangkok');
    const activeShipment = sale.shipments?.[0];
    const existingInvoice = sale.invoices?.[0];

    const totalAmount = Number(sale.netAmount) || Number(sale.totalAmount);
    const paidAmount = Number(sale.paidAmount);
    const residualAmount = Number(sale.residualAmount);
    const isFullyPaid = residualAmount <= 0;

    const handleCreateInvoice = () => {
        startTransition(async () => {
            const res = await createInvoiceFromSale(sale.id);
            if (res.success) {
                toast.success(res.message);
                router.push(`/invoices/${(res.data as any).id}`);
            } else {
                toast.error(res.message);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between print:hidden">
                <BackPageHeader backHref="/sales" title="รายละเอียดการขาย" className="flex-1 min-w-0" />
                <div className="flex flex-wrap gap-2 sm:justify-end">
                    {existingInvoice ? (
                        <Button variant="outline" size="sm" className="border-blue-500 text-blue-600 hover:bg-blue-50" asChild>
                            <Link href={`/invoices/${existingInvoice.id}`}>
                                <ExternalLink className="mr-2 h-4 w-4" /> ดูใบแจ้งหนี้
                            </Link>
                        </Button>
                    ) : (
                        <Guard permission={'SALE_CREATE' as any}>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-primary text-primary hover:bg-primary/5"
                                onClick={handleCreateInvoice}
                                disabled={isPending || sale.status === 'CANCELLED' || sale.billingStatus === 'BILLED'}
                            >
                                <FilePlus className="mr-2 h-4 w-4" />
                                {isPending ? 'กำลังสร้าง...' : 'สร้างใบแจ้งหนี้'}
                            </Button>
                        </Guard>
                    )}
                    <PdfPrintTrigger
                        type="INVOICE"
                        documentData={buildSalePrintDTO(sale, shop)}
                        fileName={`Sale-${sale.invoiceNumber || sale.id.slice(0, 8)}.pdf`}
                        label="ดาวน์โหลด PDF"
                        variant="outline"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/5"
                    />
                    <PrintButton />
                </div>
            </div>

            {/* Workflow Assistant - Premium Guided UX */}
            <WorkflowAssistant
                type="sale"
                status={sale.status}
                steps={[
                    ...(!activeShipment && sale.status !== 'CANCELLED' ? [{
                        label: 'เตรียมสินค้าเพื่อจัดส่ง',
                        action: 'สร้างใบส่งของ (DO)',
                        description: 'รายการขายนี้พร้อมสำหรับการจัดส่งแล้ว กรุณาสร้างรายการจัดส่งเพื่อตัดสต็อกจริงและติดตามพัสดุ',
                        isPrimary: true,
                        onClick: () => router.push(`/shipments/create?saleId=${sale.id}`)
                    }] : !existingInvoice && sale.status !== 'CANCELLED' ? [{
                        label: 'สินค้าเตรียมส่ง/ส่งแล้ว',
                        action: 'ออกใบแจ้งหนี้',
                        description: 'เมื่อสินค้าพร้อมส่ง คุณควรออกใบแจ้งหนี้ (Invoice) เพื่อบันทึกยอดตั้งหนี้ลูกค้าและลงบัญชี',
                        isPrimary: true,
                        onClick: handleCreateInvoice
                    }] : !isFullyPaid && sale.status !== 'CANCELLED' ? [{
                        label: 'รอชำระยอดค้างจ่าย',
                        action: 'รับชำระเงิน',
                        description: `มียอดค้างชำระ ${formatCurrency(residualAmount)} กรุณาบันทึกรับเงินเพื่อปิดบิลให้สมบูรณ์`,
                        isPrimary: true,
                        onClick: () => setIsPaymentModalOpen(true)
                    }] : sale.status === 'CANCELLED' ? [{
                        label: 'รายการนี้ถูกยกเลิกแล้ว',
                        action: 'กลับไปหน้าหลัก',
                        description: 'รายการขายนี้ถูกยกเลิก ระบบได้คืนสต็อกและล้างยอดบัญชีให้แล้ว',
                        onClick: () => router.push('/sales')
                    }] : [{
                        label: 'เสร็จสิ้นกระบวนการขาย',
                        action: 'ดูรายการจัดส่ง',
                        description: 'กระบวนการขาย จัดส่ง และรับชำระเงินเสร็จสิ้นสมบูรณ์แล้ว',
                        onClick: () => {
                            const el = document.getElementById('shipment-section');
                            el?.scrollIntoView({ behavior: 'smooth' });
                        }
                    }])
                ]}
            />

            {/* Lock Banner */}
            {sale.editLockStatus !== 'NONE' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-3 print:hidden">
                    <div className="bg-amber-100 p-1.5 rounded-full">
                        <CheckCircle2 className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <div className="font-bold flex items-center gap-2">
                            เอกสารนี้ถูกล็อก (Locked)
                            <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-700 ml-2">
                                {sale.editLockStatus}
                            </Badge>
                        </div>
                        <p className="mt-0.5 opacity-90">{sale.lockReason || 'เอกสารนี้ไม่สามารถแก้ไขได้เนื่องจากเข้าสู่กระบวนการถัดไปแล้ว'}</p>
                    </div>
                    {existingInvoice && (
                        <Button variant="link" className="text-amber-700 font-bold h-auto p-0 underline decoration-amber-300" asChild>
                            <Link href={`/invoices/${existingInvoice.id}`}>ไปที่ใบแจ้งหนี้</Link>
                        </Button>
                    )}
                </div>
            )}

            {/* Main Receipt Card */}
            <Card className="print:shadow-none print:border-none">
                <CardHeader className="border-b print:border-none">
                    {/* Shop Header */}
                    <div className="text-center mb-4 print:mb-6">
                        <h2 className="text-2xl font-bold">{shop?.name || 'ร้านค้า'}</h2>
                        {shop?.address && <p className="text-sm text-muted-foreground mt-1">{shop.address}</p>}
                        {shop?.phone && <p className="text-sm text-muted-foreground">โทร: {shop.phone}</p>}
                        {shop?.taxId && <p className="text-sm text-muted-foreground">เลขประจำตัวผู้เสียภาษี: {shop.taxId}</p>}
                    </div>
                    <Separator className="my-4" />
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-xl">ใบเสร็จรับเงิน / Receipt</CardTitle>
                                <StatusBadgeGlass
                                    status={
                                        sale.status === 'COMPLETED' ? 'เสร็จสมบูรณ์' :
                                            sale.status === 'CANCELLED' ? 'ยกเลิกแล้ว' :
                                                sale.status === 'CONFIRMED' ? 'จองสต็อกแล้ว' : 'ฉบับร่าง'
                                    }
                                    variant={
                                        sale.status === 'COMPLETED' ? 'success' :
                                            sale.status === 'CANCELLED' ? 'destructive' :
                                                sale.status === 'CONFIRMED' ? 'info' : 'default'
                                    }
                                />
                            </div>
                            <p className="text-muted-foreground text-sm mt-1">เลขที่: {sale.invoiceNumber}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-medium">วันที่: {format(zonedDate, 'dd MMMM yyyy', { locale: th })}</p>
                            <p className="text-sm text-muted-foreground">เวลา: {format(zonedDate, 'HH:mm', { locale: th })} น.</p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    {/* Customer Info */}
                    <div className="mb-8 grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-semibold mb-2">ข้อมูลลูกค้า</h3>
                            <p className="text-sm">{sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป'}</p>
                            {sale.customer && (
                                <>
                                    <p className="text-sm text-muted-foreground">{sale.customer.address}</p>
                                    <p className="text-sm text-muted-foreground">{sale.customer.phone}</p>
                                </>
                            )}
                        </div>
                        <div className="text-right">
                            <h3 className="font-semibold mb-2">วิธีการชำระเงินเดิม</h3>
                            <p className="text-sm">{sale.paymentMethod === 'CASH' ? 'เงินสด' : 'เงินโอน/QR'}</p>
                        </div>
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Wallet className="h-5 w-5 text-primary" />
                                    <h3 className="font-bold">รายงานการชำระเงิน (Ledger)</h3>
                                </div>
                                {!isFullyPaid && sale.status !== 'CANCELLED' && (
                                    <Guard permission={'PAYMENT_RECORD' as any}>
                                        <Button size="sm" onClick={() => setIsPaymentModalOpen(true)} className="h-8">
                                            <PlusCircle className="h-4 w-4 mr-2" />
                                            บันทึกการชำระเงิน
                                        </Button>
                                    </Guard>
                                )}
                            </div>
                            <FinancialTimeline
                                payments={payments}
                                saleId={sale.id}
                                totalAmount={totalAmount}
                                paidAmount={paidAmount}
                                residualAmount={residualAmount}
                            />
                        </div>

                        <div className="bg-muted/30 p-6 rounded-xl border space-y-4">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-tight">สรุปยอดการเงิน</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span>ยอดรวมสุทธิ</span>
                                    <span className="font-medium">{formatCurrency(Number(sale.netAmount) || Number(sale.totalAmount))}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-green-600">
                                    <span>ชำระแล้ว</span>
                                    <span className="font-medium">{formatCurrency(Number(sale.paidAmount))}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between items-center">
                                    <span className="font-bold">ยอดคงเหลือ</span>
                                    <span className={`text-xl font-black ${isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(residualAmount)}
                                    </span>
                                </div>
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
                        </div>
                    </div>

                    <PaymentModal
                        isOpen={isPaymentModalOpen}
                        onClose={() => setIsPaymentModalOpen(false)}
                        saleId={sale.id}
                        residualAmount={residualAmount}
                        parentTitle={`บิลเลขที่ ${sale.invoiceNumber}`}
                    />

                    {/* Items Table */}
                    <div className="rounded-md border mb-8 print:border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-sm min-w-[600px] lg:min-w-full">
                                <thead className="bg-muted/50 border-b print:bg-gray-100">
                                    <tr className="text-left">
                                        <th className="p-3 font-medium">ลำดับ</th>
                                        <th className="p-3 font-medium">รายการ</th>
                                        <th className="p-3 font-medium text-right">ราคาต่อหน่วย</th>
                                        <th className="p-3 font-medium text-right">จำนวน (Unit)</th>
                                        <th className="p-3 font-medium text-right">บรรจุภัณฑ์ (Pack)</th>
                                        <th className="p-3 font-medium text-right">จำนวนกล่อง (CTN)</th>
                                        <th className="p-3 font-medium text-right">รวม</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sale.items.map((item: any, index: number) => (
                                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                                            <td className="p-3">{index + 1}</td>
                                            <td className="p-3">
                                                <div className="max-w-[200px] sm:max-w-none">
                                                    {item.product.name}
                                                    {Number(item.discountAmount) > 0 && (
                                                        <span className="text-xs text-orange-600 ml-1">
                                                            (ลด {formatCurrency(Number(item.discountAmount))}/ชิ้น)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">{formatCurrency(Number(item.salePrice))}</td>
                                            <td className="p-3 text-right font-medium">{item.quantity}</td>
                                            <td className="p-3 text-right text-muted-foreground">{item.packagingQty || 1}</td>
                                            <td className="p-3 text-right font-bold text-primary">
                                                {calculateCtn(item.quantity, item.packagingQty || 1)}
                                            </td>
                                            <td className="p-3 text-right">{formatCurrency(Number(item.subtotal))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals Section */}
                    <div className="flex justify-end mb-8">
                        <div className="w-64 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">ยอดรวมสินค้า</span>
                                <span>{formatCurrency(Number(sale.totalAmount))}</span>
                            </div>
                            {Number(sale.discountAmount) > 0 && (
                                <div className="flex justify-between text-sm text-orange-600">
                                    <span>
                                        ส่วนลดบิล
                                        {sale.discountType === 'PERCENT' && sale.discountValue ? ` (${Number(sale.discountValue)}%)` : ''}
                                    </span>
                                    <span>-{formatCurrency(Number(sale.discountAmount))}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t pt-2">
                                <span className="font-semibold">ยอดสุทธิ</span>
                                <span className="font-bold text-lg">{formatCurrency(Number(sale.netAmount) || Number(sale.totalAmount))}</span>
                            </div>
                        </div>
                    </div>

                    {sale.notes && (
                        <div className="mt-8 border-t pt-4">
                            <h4 className="font-semibold mb-1 text-sm">หมายเหตุ:</h4>
                            <p className="text-sm text-muted-foreground">{sale.notes}</p>
                        </div>
                    )}

                    {sale.receiptUrl && <ReceiptImage receiptUrl={sale.receiptUrl} alt="หลักฐานการขาย" />}

                    {/* Shipment Info */}
                    {activeShipment ? (
                        <div className="mt-8 border-t pt-4 print:hidden" id="shipment-section">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Truck className="h-4 w-4" />
                                    <h4 className="font-semibold text-sm">ข้อมูลจัดส่ง</h4>
                                </div>
                                <ShipmentStatusBadge status={activeShipment.status} />
                            </div>
                            <div className="grid gap-2 mt-2 sm:grid-cols-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">เลขจัดส่ง: </span>
                                    <Link href={`/shipments/${activeShipment.id}`} className="text-blue-600 hover:underline">
                                        {activeShipment.shipmentNumber}
                                    </Link>
                                </div>
                                {activeShipment.trackingNumber && (
                                    <div>
                                        <span className="text-muted-foreground">Tracking: </span>
                                        <span className="font-mono">{activeShipment.trackingNumber}</span>
                                    </div>
                                )}
                                {activeShipment.shippingProvider && (
                                    <div>
                                        <span className="text-muted-foreground">ขนส่ง: </span>
                                        {activeShipment.shippingProvider}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : sale.status !== 'CANCELLED' ? (
                        <Guard permission={'SHIPMENT_CREATE' as any}>
                            <div className="mt-8 border-t pt-4 print:hidden">
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/shipments/create?saleId=${sale.id}`}>
                                            <Send className="h-4 w-4 mr-2" />สร้างรายการจัดส่ง
                                        </Link>
                                    </Button>
                                    <Guard permission={'RETURN_CREATE' as any}>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/returns/create?saleId=${sale.id}`}>
                                                <RotateCcw className="h-4 w-4 mr-2" />คืนสินค้า
                                            </Link>
                                        </Button>
                                    </Guard>
                                </div>
                            </div>
                        </Guard>
                    ) : null}

                    <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground print:mt-12">
                        <p>ขอบคุณที่ใช้บริการ</p>
                        {shop?.name && <p className="font-medium">{shop.name}</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
