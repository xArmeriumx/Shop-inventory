import { Metadata } from 'next';
import { OrderRequestService } from '@/services/order-request.service';
import { requirePermission } from '@/lib/auth-guard';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { OrderRequestStatus } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, FileText, Printer } from 'lucide-react';
import { notFound } from 'next/navigation';
import { OrderRequestActions } from '@/components/order-requests/order-request-actions';
import { ApprovalActions } from '@/components/approvals/approval-actions';

export const metadata: Metadata = {
    title: 'รายละเอียดคำขอซื้อ | ERP System',
};

const ORDER_REQUEST_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: { label: 'ฉบับร่าง', variant: 'secondary' },
    SUBMITTED: { label: 'ส่งขออนุมัติ', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
    APPROVED: { label: 'อนุมัติแล้ว', variant: 'default', className: 'bg-green-500' },
    IN_PROGRESS: { label: 'กำลังดำเนินการ', variant: 'outline', className: 'border-blue-500 text-blue-600' },
    DONE: { label: 'เสร็จสิ้น', variant: 'default', className: 'bg-green-600' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

export default async function OrderRequestDetailPage({ params }: { params: { id: string } }) {
    const ctx = await requirePermission('ORDER_REQUEST_VIEW');

    let request;
    try {
        request = await OrderRequestService.getById(ctx, params.id);
    } catch (error) {
        return notFound();
    }

    return (
        <div className="p-6 space-y-6">
            <BackPageHeader
                backHref="/order-requests"
                title={`คำขอซื้อ ${request.requestNo}`}
                description={`ผู้ขอซื้อ: ${request.requester?.user?.name || '-'}`}
                action={
                    <div className="flex gap-2 items-center">
                        <Button variant="outline" size="sm">
                            <Printer className="mr-2 h-4 w-4" /> พิมพ์เอกสาร
                        </Button>
                        <OrderRequestActions requestId={request.id} status={request.status} />
                        <ApprovalActions documentId={request.id} documentType="ORDER_REQUEST" status={request.status} />
                    </div>
                }
            />

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>รายการสินค้าที่ต้องการ</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>สินค้า / รายละเอียด</TableHead>
                                    <TableHead className="text-right">จำนวน</TableHead>
                                    <TableHead className="text-right">หน่วย</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {request.items.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium">{item.product?.name || item.description}</div>
                                            {item.product && item.description && (
                                                <div className="text-xs text-muted-foreground">{item.description}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{item.uom || 'ชิ้น'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>สถานะความคืบหน้า</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">สถานะปัจจุบัน</span>
                                <StatusBadge
                                    status={request.status}
                                    config={ORDER_REQUEST_STATUS_CONFIG}
                                />
                            </div>
                            <div className="flex justify-between items-center border-t pt-2">
                                <span className="text-sm text-muted-foreground">วันที่ขอซื้อ</span>
                                <span className="text-sm font-medium"><ClientDate date={request.date} /></span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>เหตุผลการขอซื้อ</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {request.notes || 'ไม่ได้ระบุเหตุผล'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
