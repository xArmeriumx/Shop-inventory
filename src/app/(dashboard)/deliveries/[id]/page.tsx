import { Metadata } from 'next';
import { DeliveryOrderService } from '@/services/inventory/delivery-order.service';
import { requirePermission } from '@/lib/auth-guard';
import { StatusBadge, StatusConfig } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { DeliveryStatus } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, Printer, PackageCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { DeliveryActions } from '@/components/sales/deliveries/delivery-actions';

export const metadata: Metadata = {
    title: 'รายละเอียดใบส่งสินค้า | ERP System',
};

const DELIVERY_STATUS_CONFIG: Record<string, StatusConfig> = {
    WAITING: { label: 'สินค้าไม่พอ (Waiting)', variant: 'outline', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
    PROCESSING: { label: 'พร้อมส่ง (Available)', variant: 'outline', className: 'border-blue-500 text-blue-600 bg-blue-50' },
    DELIVERED: { label: 'ส่งสำเร็จ (Done)', variant: 'default', className: 'bg-green-600' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

export default async function DeliveryOrderDetailPage({ params }: { params: { id: string } }) {
    const ctx = await requirePermission('DELIVERY_VIEW');

    let delivery;
    try {
        delivery = await DeliveryOrderService.getById(ctx, params.id);
    } catch (error) {
        return notFound();
    }

    return (
        <div className="p-6 space-y-6">
            <BackPageHeader
                backHref="/deliveries"
                title={`ใบส่งสินค้า ${delivery.deliveryNo}`}
                description={`ลูกค้า: ${delivery.sale?.customer?.name || '-'}`}
                action={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Printer className="mr-2 h-4 w-4" /> พิมพ์ใบส่งของ
                        </Button>
                        <DeliveryActions deliveryId={delivery.id} status={delivery.status} />
                    </div>
                }
            />

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PackageCheck className="h-5 w-5 text-blue-500" />
                            รายการพัสดุ
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>สินค้า</TableHead>
                                    <TableHead className="text-right">จำนวนที่ส่ง</TableHead>
                                    <TableHead>สถานะคลัง</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {delivery.items.map((item: any) => {
                                    const available = (item.product?.stock || 0);
                                    const isShort = item.quantity > available;
                                    const shortQty = item.quantity - available;

                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="font-medium">{item.product?.name}</div>
                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                    <span>SKU: {item.product?.sku || '-'}</span>
                                                    <span className="font-bold text-blue-600">ในคลัง: {available}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-lg">
                                                {item.quantity}
                                            </TableCell>
                                            <TableCell>
                                                {isShort ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold inline-block w-fit">
                                                            สต็อกไม่พอ
                                                        </span>
                                                        <span className="text-[10px] text-red-600 font-bold">ขาดอีก: {shortQty}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">
                                                        พร้อมส่ง
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>ข้อมูลการจัดส่ง</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">สถานะ</span>
                                <StatusBadge
                                    status={delivery.status}
                                    config={DELIVERY_STATUS_CONFIG}
                                />
                            </div>
                            <div className="flex justify-between items-center text-sm border-t pt-2">
                                <span className="text-muted-foreground">กำหนดส่ง</span>
                                <span className="font-medium">
                                    {delivery.scheduledDate ? <ClientDate date={delivery.scheduledDate} /> : 'ไม่ระบุ'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">อ้างอิงใบขาย</span>
                                <span className="font-medium">{delivery.sale?.invoiceNumber || '-'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>หมายเหตุ</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground italic">
                                {delivery.notes || 'ไม่มีหมายเหตุเพิ่มเติม'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
