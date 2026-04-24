import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/formatters';
import { getPurchaseStatusLabel, calculateCtn } from '@/lib/erp-utils';
import { PrintButton } from '@/components/sales/print-button';
import { ReceiptImage } from '@/components/purchases/receipts/receipt-image';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { PdfPrintTrigger } from '@/features/print/components/pdf-print-trigger';
import { buildPurchasePrintDTO } from '@/features/print/builders/purchase-order-print.builder';
import { RegisterPurchaseTaxButton } from '@/components/tax/register-purchase-tax-button';
import { WorkflowAssistant } from '@/components/ui/workflow-assistant';
import { Truck, Wallet, FileText, CheckCircle2 } from 'lucide-react';
import { DocumentFlowPath } from '@/components/ui/document-flow-path';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PurchaseDetailViewProps {
    purchase: any;
    shop: any;
}

// ─── PurchaseDetailView ──────────────────────────────────────────────────────────

/**
 * Renders the complete purchase detail receipt view.
 * Extracted from purchases/[id]/page.tsx to keep the page file thin.
 */
export function PurchaseDetailView({ purchase, shop }: PurchaseDetailViewProps) {
    const zonedDate = toZonedTime(purchase.date, 'Asia/Bangkok');

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between print:hidden">
                <BackPageHeader backHref="/purchases" title="รายละเอียดการซื้อ" className="flex-1 min-w-0" />
                <div className="flex flex-wrap gap-2 sm:justify-end">
                    <RegisterPurchaseTaxButton
                        purchaseId={purchase.id}
                        hasTaxDoc={purchase.purchaseTaxLinks?.length > 0}
                    />
                    <PdfPrintTrigger
                        type="PURCHASE"
                        documentData={buildPurchasePrintDTO(purchase, shop)}
                        fileName={`PO-${purchase.invoiceNumber || purchase.id.slice(0, 8)}.pdf`}
                        label="พิมพ์ใบสั่งซื้อ (PDF)"
                        size="sm"
                    />
                </div>
            </div>

            {/* Document Lifecycle Path */}
            <DocumentFlowPath
                steps={[
                    {
                        id: 'pr',
                        label: 'ใบขอซื้อ (PR)',
                        status: purchase.linkedPRId ? 'completed' : 'skipped'
                    },
                    {
                        id: 'po',
                        label: 'ใบสั่งซื้อ (PO)',
                        status: 'current'
                    },
                    {
                        id: 'receipt',
                        label: 'รับสินค้า',
                        status: purchase.status === 'RECEIVED' ? 'completed' : 'pending'
                    },
                    {
                        id: 'tax',
                        label: 'ภาษีซื้อ',
                        status: purchase.purchaseTaxLinks?.length > 0 ? 'completed' : 'pending'
                    },
                    {
                        id: 'payment',
                        label: 'จ่ายเงิน',
                        status: purchase.residualAmount <= 0 ? 'completed' : 'pending'
                    }
                ]}
            />

            {/* Workflow Assistant - Guided UX */}
            <div className="print:hidden">
                <WorkflowAssistant
                    type="purchase"
                    status={purchase.status === 'RECEIVED' ? 'รับสินค้าแล้ว' : 'รอรับสินค้า'}
                    steps={[
                        ...(purchase.status !== 'RECEIVED' ? [{
                            label: 'ขั้นตอนถัดไป: บันทึกการรับสินค้า',
                            action: 'บันทึกรับของ',
                            description: 'สินค้ายังไม่ถูกรับเข้าสต็อก กรุณาตรวจสอบจำนวนและบันทึกการรับสินค้าเพื่ออัปเดตยอดคงเหลือ',
                            isPrimary: true,
                            onClick: () => {
                                // Logic for receiving would go here
                                alert('บันทึกรับของ (Simulation)');
                            }
                        }] : []),
                        ...(purchase.status === 'RECEIVED' && purchase.residualAmount > 0 ? [{
                            label: 'ขั้นตอนถัดไป: ชำระเงินเจ้าหนี้',
                            action: 'บันทึกจ่ายเงิน',
                            description: `ได้รับสินค้าแล้ว แต่ยังมียอดค้างชำระ ${formatCurrency(purchase.residualAmount)} กรุณาบันทึกการจ่ายเงินเพื่อปิดยอด`,
                            isPrimary: true,
                            onClick: () => {
                                window.location.href = `/accounting/payments/new?partnerId=${purchase.supplierId}&purchaseId=${purchase.id}`;
                            }
                        }] : []),
                        // Secondary action: Register Tax if not already done
                        ...(purchase.purchaseTaxLinks?.length === 0 ? [{
                            label: 'บันทึกใบรับรองภาษี',
                            action: 'ปักหมุดภาษีซื้อ',
                            description: 'ยังไม่มีการผูกใบกำกับภาษีซื้อกับรายการนี้',
                            onClick: () => {
                                // Scroll to tax button or trigger modal
                            }
                        }] : [])
                    ]}
                />
            </div>

            <Card className="print:shadow-none print:border-none">
                <CardHeader className="border-b print:border-none">
                    {/* Shop Header */}
                    <div className="text-center mb-4 print:mb-6">
                        <h2 className="text-2xl font-bold">{shop?.name || 'ร้านค้า'}</h2>
                        {shop?.address && <p className="text-sm text-muted-foreground mt-1">{shop.address}</p>}
                        {shop?.phone && <p className="text-sm text-muted-foreground">โทร: {shop.phone}</p>}
                    </div>
                    <Separator className="my-4" />
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl">ใบรับสินค้า / Purchase Order</CardTitle>
                            <p className="text-muted-foreground text-sm mt-1">รหัส: {purchase.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-medium">วันที่: {format(zonedDate, 'dd MMMM yyyy', { locale: th })}</p>
                            <p className="text-sm text-muted-foreground">เวลา: {format(zonedDate, 'HH:mm', { locale: th })} น.</p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    {/* Supplier */}
                    <div className="mb-8 grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-semibold mb-2">ข้อมูลผู้จำหน่าย</h3>
                            {purchase.supplier ? (
                                <>
                                    <p className="text-sm font-medium">{purchase.supplier.name}</p>
                                    {purchase.supplier.phone && <p className="text-sm text-muted-foreground">โทร: {purchase.supplier.phone}</p>}
                                    {purchase.supplier.address && <p className="text-sm text-muted-foreground">{purchase.supplier.address}</p>}
                                </>
                            ) : purchase.supplierName ? (
                                <p className="text-sm font-medium">{purchase.supplierName}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground">ไม่ระบุผู้จำหน่าย</p>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                {getPurchaseStatusLabel(purchase.status, purchase.docType as any)}
                            </span>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="rounded-md border mb-8 print:border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-sm min-w-[600px] lg:min-w-full">
                                <thead className="bg-muted/50 border-b print:bg-gray-100">
                                    <tr className="text-left">
                                        <th className="p-3 font-medium">ลำดับ</th>
                                        <th className="p-3 font-medium">รายการ</th>
                                        <th className="p-3 font-medium">SKU</th>
                                        <th className="p-3 font-medium text-right">ราคาต่อหน่วย</th>
                                        <th className="p-3 font-medium text-right">จำนวน (Unit)</th>
                                        <th className="p-3 font-medium text-right">บรรจุภัณฑ์ (Pack)</th>
                                        <th className="p-3 font-medium text-right">จำนวนกล่อง (CTN)</th>
                                        <th className="p-3 font-medium text-right">รวม</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchase.items.map((item: any, index: number) => (
                                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                                            <td className="p-3">{index + 1}</td>
                                            <td className="p-3">
                                                <div className="max-w-[200px] sm:max-w-none">
                                                    {item.product.name}
                                                </div>
                                            </td>
                                            <td className="p-3 text-muted-foreground">{item.product.sku || '-'}</td>
                                            <td className="p-3 text-right">{formatCurrency(Number(item.costPrice))}</td>
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

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-64">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">ยอดรวมทั้งหมด</span>
                                <span className="font-bold text-lg">{formatCurrency(Number(purchase.totalCost))}</span>
                            </div>
                        </div>
                    </div>

                    {purchase.notes && (
                        <div className="mt-8 border-t pt-4">
                            <h4 className="font-semibold mb-1 text-sm">หมายเหตุ:</h4>
                            <p className="text-sm text-muted-foreground">{purchase.notes}</p>
                        </div>
                    )}

                    {purchase.receiptUrl && <ReceiptImage receiptUrl={purchase.receiptUrl} alt="หลักฐานการซื้อ" />}

                    <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground print:mt-12">
                        <p>เอกสารนี้ออกโดยระบบอัตโนมัติ</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
