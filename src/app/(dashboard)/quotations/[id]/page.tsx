import { Metadata } from 'next';
import { QuotationService } from '@/services/sales/quotation.service';
import { requirePermission } from '@/lib/auth-guard';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer } from 'lucide-react';
import { notFound } from 'next/navigation';
import { QuotationActions } from '@/components/sales/quotations/quotation-actions';
import { DocumentFlowPath } from '@/components/ui/document-flow-path';
import { WorkflowAssistant } from '@/components/ui/workflow-assistant';

export const metadata: Metadata = {
    title: 'รายละเอียดใบเสนอราคา | ERP System',
};

const QUOTATION_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: { label: 'ฉบับร่าง', variant: 'secondary' },
    SENT: { label: 'ส่งแล้ว', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
    CONFIRMED: { label: 'ยืนยันแล้ว', variant: 'default', className: 'bg-green-500' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
    const ctx = await requirePermission('QUOTATION_VIEW');

    const quotation = await QuotationService.getById(ctx, params.id) as any;
    if (!quotation) return notFound();

    const firstSale = quotation.sales?.[0];
    const hasSale = !!firstSale;
    const hasInvoice = hasSale && firstSale.invoices?.length > 0;
    const isPaid = hasSale && Number(firstSale.residualAmount) <= 0;

    return (
        <div className="p-6 space-y-6">
            <BackPageHeader
                backHref="/quotations"
                title={`ใบเสนอราคา ${quotation.quotationNo}`}
                description={`ลูกค้า: ${quotation.customer?.name || '-'}`}
                action={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Printer className="mr-2 h-4 w-4" /> พิมพ์เอกสาร
                        </Button>
                        <QuotationActions quotationId={quotation.id} status={quotation.status} />
                    </div>
                }
            />

            {/* Document Lifecycle Path */}
            <DocumentFlowPath
                steps={[
                    {
                        id: 'quote',
                        label: 'ใบเสนอราคา',
                        status: 'current'
                    },
                    {
                        id: 'sale',
                        label: 'รายการขาย',
                        status: hasSale ? 'completed' : 'pending'
                    },
                    {
                        id: 'invoice',
                        label: 'ใบแจ้งหนี้',
                        status: hasInvoice ? 'completed' : 'pending'
                    },
                    {
                        id: 'payment',
                        label: 'ชำระเงิน',
                        status: isPaid ? 'completed' : 'pending'
                    }
                ]}
            />

            {/* Workflow Assistant */}
            <WorkflowAssistant
                type="sale"
                status={quotation.status === 'CONFIRMED' ? 'ใบเสนอราคาได้รับการยืนยันแล้ว' : 'รอการยืนยันจากลูกค้า'}
                steps={[
                    ...(quotation.status === 'CONFIRMED' && !hasSale ? [{
                        label: 'ขั้นตอนถัดไป: สร้างรายการขาย',
                        action: 'เปิดบิลขาย',
                        description: 'ใบเสนอราคานี้ได้รับการยืนยันแล้ว คุณสามารถสร้างรายการขาย (Sale) เพื่อตัดสต็อกและรับชำระเงินได้ทันที',
                        isPrimary: true,
                        href: `/sales/new?quotationId=${quotation.id}`
                    }] : []),
                    ...(quotation.status === 'DRAFT' ? [{
                        label: 'เตรียมส่งให้ลูกค้า',
                        action: 'ส่งเอกสาร',
                        description: 'ตรวจสอบความถูกต้องของราคาและส่วนลด ก่อนส่งให้ลูกค้าพิจารณา',
                        href: '#' // Placeholder or actual link to sharable URL
                    }] : [])
                ]}
            />

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>รายการสินค้า</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>สินค้า</TableHead>
                                    <TableHead>รายละเอียด</TableHead>
                                    <TableHead className="text-right">จำนวน</TableHead>
                                    <TableHead className="text-right">ราคา/หน่วย</TableHead>
                                    <TableHead className="text-right">ส่วนลด</TableHead>
                                    <TableHead className="text-right">รวม</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotation.items.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.product?.name || '-'}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{item.description || '-'}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{new Intl.NumberFormat('th-TH').format(Number(item.unitPrice))}</TableCell>
                                        <TableCell className="text-right">{new Intl.NumberFormat('th-TH').format(Number(item.discount))}</TableCell>
                                        <TableCell className="text-right font-medium">{new Intl.NumberFormat('th-TH').format(Number(item.subtotal))}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-muted/50 font-bold">
                                    <TableCell colSpan={5} className="text-right text-lg">ยอดรวมสุทธิ</TableCell>
                                    <TableCell className="text-right text-lg text-primary">
                                        {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(quotation.totalAmount))}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>สถานะเอกสาร</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">สถานะปัจจุบัน</span>
                                <StatusBadge
                                    status={quotation.status}
                                    config={QUOTATION_STATUS_CONFIG}
                                />
                            </div>
                            <div className="flex justify-between items-center border-t pt-2">
                                <span className="text-sm text-muted-foreground">วันที่สร้าง</span>
                                <span className="text-sm font-medium"><ClientDate date={quotation.createdAt} /></span>
                            </div>
                            <div className="flex justify-between items-center border-t pt-2">
                                <span className="text-sm text-muted-foreground">พนักงานขาย</span>
                                <span className="text-sm font-medium">{quotation.salesperson?.user?.name || '-'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>หมายเหตุ</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {quotation.notes || 'ไม่มีหมายเหตุ'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
