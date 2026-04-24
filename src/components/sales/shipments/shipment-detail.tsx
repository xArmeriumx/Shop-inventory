'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ShipmentStatusBadge } from './shipment-status-badge';
import { ShipmentTimeline } from './shipment-timeline';
import { updateShipment, updateShipmentStatus, cancelShipment, calculateShipmentLoad } from '@/actions/sales/shipments.actions';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';
import { GuidedErrorAlert } from '@/components/ui/guided-error-alert';
import { ErrorAction } from '@/types/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle,
  ArrowLeft,
  Edit2,
  Loader2,
  Package,
  Save,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type { ShipmentStatus } from '@prisma/client';
import { Guard } from '@/components/core/auth/guard';

const STATUS_ACTION_LABELS: Partial<Record<ShipmentStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'destructive' | 'outline' }>> = {
  SHIPPED: { label: 'ส่งพัสดุ', icon: <Truck className="h-4 w-4 mr-2" />, variant: 'default' },
  DELIVERED: { label: 'ส่งถึงแล้ว', icon: <Package className="h-4 w-4 mr-2" />, variant: 'default' },
  CANCELLED: { label: 'ยกเลิก', icon: <X className="h-4 w-4 mr-2" />, variant: 'destructive' },
  RETURNED: { label: 'ส่งคืน', icon: <AlertTriangle className="h-4 w-4 mr-2" />, variant: 'outline' },
  PENDING: { label: 'ส่งใหม่', icon: <Package className="h-4 w-4 mr-2" />, variant: 'outline' },
  PROCESSING: { label: 'เริ่มแพ็คสินค้า', icon: <Loader2 className="h-4 w-4 mr-2" />, variant: 'default' },
};

interface ShipmentDetailProps {
  shipment: any; // From getShipment()
}

export function ShipmentDetail({ shipment }: ShipmentDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cancelReason, setCancelReason] = useState('');
  const [loadData, setLoadData] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; action?: ErrorAction } | null>(null);

  const handleCalculateLoad = async () => {
    setIsCalculating(true);
    try {
      const result = await calculateShipmentLoad(shipment.id);
      if (result.success) {
        setLoadData(result.data);
        setErrorInfo(null);
      } else {
        const fallbackMsg = result.message || 'ไม่สามารถคำนวณ Load ได้';
        setErrorInfo({ message: fallbackMsg, action: result.action });
        toast.error(fallbackMsg);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการคำนวณ');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleStatusChange = (newStatus: ShipmentStatus) => {
    startTransition(async () => {
      const result = await updateShipmentStatus({
        id: shipment.id,
        status: newStatus,
      });

      if (result.success) {
        toast.success(result.message);
        setErrorInfo(null);
        router.refresh();
      } else {
        const fallbackMsg = result.message || 'ไม่สามารถเปลี่ยนสถานะได้';
        setErrorInfo({ message: fallbackMsg, action: result.action });
        toast.error(fallbackMsg);
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelShipment(shipment.id, cancelReason || undefined);
      if (result.success) {
        toast.success(result.message);
        setCancelReason('');
        router.refresh();
      } else {
        toast.error(result.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateShipment({
        id: shipment.id,
        trackingNumber: (formData.get('trackingNumber') as string) || null,
        shippingProvider: (formData.get('shippingProvider') as string) || null,
        shippingCost: formData.get('shippingCost')
          ? Number(formData.get('shippingCost'))
          : null,
        recipientName: formData.get('recipientName') as string,
        recipientPhone: (formData.get('recipientPhone') as string) || null,
        shippingAddress: formData.get('shippingAddress') as string,
        notes: (formData.get('notes') as string) || null,
      });

      if (result.success) {
        toast.success(result.message);
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Guided Error Alert */}
      {errorInfo && (
        <GuidedErrorAlert 
          message={errorInfo.message} 
          action={errorInfo.action} 
          className="mb-6"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/shipments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{shipment.shipmentNumber}</h1>
            <p className="text-sm text-muted-foreground">
              สร้างเมื่อ {formatDate(shipment.createdAt)}
            </p>
          </div>
          <ShipmentStatusBadge status={shipment.status} />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/shipments/${shipment.id}/print`} target="_blank">
              <Package className="h-4 w-4 mr-2" />
              พิมพ์ใบส่งของ
            </Link>
          </Button>

          <Guard permission="SHIPMENT_EDIT">
            {!isEditing && shipment.status !== 'CANCELLED' && shipment.status !== 'DELIVERED' && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                แก้ไข
              </Button>
            )}
          </Guard>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <form onSubmit={handleUpdate}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">แก้ไขข้อมูล</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>ชื่อผู้รับ</Label>
                    <Input name="recipientName" defaultValue={shipment.recipientName} required />
                  </div>
                  <div className="space-y-2">
                    <Label>เบอร์โทร</Label>
                    <Input name="recipientPhone" defaultValue={shipment.recipientPhone || ''} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>ที่อยู่จัดส่ง</Label>
                    <Textarea name="shippingAddress" defaultValue={shipment.shippingAddress} required rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tracking</Label>
                    <Input name="trackingNumber" defaultValue={shipment.trackingNumber || ''} className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>บริษัทขนส่ง</Label>
                    <Input name="shippingProvider" defaultValue={shipment.shippingProvider || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>ค่าส่ง</Label>
                    <Input name="shippingCost" type="number" step="0.01" defaultValue={shipment.shippingCost || ''} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>หมายเหตุ</Label>
                    <Textarea name="notes" defaultValue={shipment.notes || ''} rows={2} />
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-3 justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  บันทึก
                </Button>
              </div>
            </form>
          ) : (
            <>
              {/* Recipient Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    ข้อมูลผู้รับ
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">ชื่อผู้รับ</p>
                    <p className="font-medium">{shipment.recipientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">เบอร์โทร</p>
                    <p className="font-medium">{shipment.recipientPhone || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">ที่อยู่</p>
                    <p className="font-medium">{shipment.shippingAddress}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Tracking Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    ข้อมูลขนส่ง
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Tracking</p>
                    <p className="font-mono font-medium">{shipment.trackingNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">บริษัทขนส่ง</p>
                    <p className="font-medium">{shipment.shippingProvider || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ค่าส่ง</p>
                    <p className="font-medium">
                      {shipment.shippingCost ? formatCurrency(shipment.shippingCost) : '-'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Linked Sale */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    รายการขายที่เชื่อมต่อ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Invoice</p>
                      <Link
                        href={`/sales/${shipment.sale.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {shipment.sale.invoiceNumber}
                      </Link>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ลูกค้า</p>
                      <p className="font-medium">{shipment.sale.customer?.name || shipment.sale.customerName || 'ลูกค้าทั่วไป'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ยอดขาย</p>
                      <p className="font-medium">{formatCurrency(shipment.sale.totalAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {shipment.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">หมายเหตุ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{shipment.notes}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Right Column: Timeline + Status Actions */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">สถานะจัดส่ง</CardTitle>
            </CardHeader>
            <CardContent>
              <ShipmentTimeline shipment={shipment} />
            </CardContent>
          </Card>

          {/* Status Actions */}
          <Guard permission="SHIPMENT_EDIT">
            {shipment.allowedTransitions?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">เปลี่ยนสถานะ</CardTitle>
                  <CardDescription>เลือกสถานะถัดไป</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {shipment.allowedTransitions.map((status: ShipmentStatus) => {
                    const action = STATUS_ACTION_LABELS[status];
                    if (!action) return null;
                    return (
                      <Button
                        key={status}
                        variant={action.variant}
                        className="w-full justify-start"
                        disabled={isPending}
                        onClick={() => handleStatusChange(status)}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          action.icon
                        )}
                        {action.label}
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </Guard>

          {/* Logistics Load Hub (Phase 4) */}
          <Card className="border-blue-100 bg-blue-50/10 dark:border-blue-900 dark:bg-blue-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>การคำนวณน้ำหนักและปริมาตร</span>
                <Truck className="h-4 w-4 text-blue-500" />
              </CardTitle>
              <CardDescription className="text-xs">Logistics Load Center</CardDescription>
            </CardHeader>
            <CardContent>
              {!loadData ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs" 
                  onClick={handleCalculateLoad}
                  disabled={isCalculating}
                >
                  {isCalculating ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Save className="h-3 w-3 mr-2" />}
                  คำนวณ Load
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-background border">
                      <p className="text-muted-foreground mb-1">น้ำหนักรวม</p>
                      <p className="font-bold">{loadData.totalWeight} kg</p>
                    </div>
                    <div className="p-2 rounded bg-background border">
                      <p className="text-muted-foreground mb-1">ปริมาตร (CBM)</p>
                      <p className="font-bold">{loadData.totalCbm} m³</p>
                    </div>
                  </div>
                  
                  <div className="p-2 rounded bg-blue-100/30 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider mb-1">แนะนำตู้คอนเทนเนอร์</p>
                    <p className="text-sm font-bold">{loadData.recommendedContainer}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>อัตราการใช้งานตู้</span>
                        <span>{loadData.utilization}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full" 
                          style={{ width: `${Math.min(loadData.utilization, 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="sm" className="w-full text-[10px] h-6" onClick={handleCalculateLoad}>
                    คำนวณใหม่
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cancel Action */}
          <Guard permission="SHIPMENT_CANCEL">
            {shipment.status !== 'CANCELLED' && shipment.status !== 'DELIVERED' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isPending}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    ยกเลิกการจัดส่ง
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการยกเลิก</AlertDialogTitle>
                    <AlertDialogDescription>
                      คุณต้องการยกเลิกการจัดส่ง {shipment.shipmentNumber} ใช่หรือไม่?
                      การดำเนินการนี้ไม่สามารถย้อนกลับได้
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-2">
                    <Input
                      placeholder="เหตุผลที่ยกเลิก (ไม่บังคับ)"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCancelReason('')}>ไม่ใช่</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      ยืนยันยกเลิก
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </Guard>
        </div>
      </div>
    </div>
  );
}
