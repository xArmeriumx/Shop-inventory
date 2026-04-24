'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Button,
  EmptyState,
  TablePagination,
  GuidedErrorAlert,
} from '@/components/ui';
import type { PaginationInfo } from '@/components/ui';
import { ShipmentStatusBadge } from './shipment-status-badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useUrlFilters } from '@/hooks';
import { Eye, Package, MapPin, Loader2 } from 'lucide-react';
import { processShipmentRoute } from '@/actions/sales/shipments.actions';
import { toast } from 'sonner';
import type { ShipmentStatus } from '@prisma/client';
import type { ErrorAction } from '@/types/domain';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ShipmentRow {
  id: string;
  shipmentNumber: string;
  recipientName: string;
  recipientPhone: string | null;
  trackingNumber: string | null;
  shippingProvider: string | null;
  shippingCost: number | null;
  status: ShipmentStatus;
  createdAt: Date | string;
  sale: {
    id: string;
    invoiceNumber: string;
    customerName: string | null;
    totalAmount: number;
    customer?: { name: string } | null;
  } | null;
}

interface ShipmentsTableProps {
  shipments: ShipmentRow[];
  pagination: PaginationInfo;
}

// ─── Route Intelligence Banner ────────────────────────────────────────────────

function RouteIntelligenceBanner({
  onRoute,
  isProcessing,
}: {
  onRoute: (type: 'OUTBOUND' | 'INBOUND') => void;
  isProcessing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border border-dashed">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Logistics Intelligence</p>
      </div>
      <div className="flex gap-2">
        {(['OUTBOUND', 'INBOUND'] as const).map((type) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => onRoute(type)}
            disabled={isProcessing}
          >
            {isProcessing
              ? <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              : <MapPin className="h-3 w-3 mr-1" />
            }
            {type === 'OUTBOUND' ? 'จัดเส้นทาง (ใกล้-ไกล)' : 'จัดเส้นทาง (ไกล-ใกล้)'}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── ShipmentsTable ───────────────────────────────────────────────────────────

export function ShipmentsTable({ shipments, pagination }: ShipmentsTableProps) {
  const router = useRouter();
  const { goToPage, isPending } = useUrlFilters();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; action?: ErrorAction } | null>(null);

  const handleProcessRoute = async (type: 'OUTBOUND' | 'INBOUND') => {
    const pendingIds = shipments.filter((s) => s.status === 'PENDING').map((s) => s.id);
    if (pendingIds.length === 0) {
      toast.error('ไม่มีรายการที่รอจัดส่งเพื่อแสดงเส้นทาง');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await processShipmentRoute(pendingIds, type);
      if (result.success) {
        toast.success(result.message);
        setErrorInfo(null);
        router.refresh();
      } else {
        const msg = result.message || 'ไม่สามารถคำนวณเส้นทางได้';
        setErrorInfo({ message: msg, action: result.action });
        toast.error(msg);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการคำนวณเส้นทาง');
    } finally {
      setIsProcessing(false);
    }
  };

  if (shipments.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-12 w-12" />}
        title="ยังไม่มีรายการจัดส่ง"
        description="สร้างรายการจัดส่งแรกของคุณ"
      />
    );
  }

  return (
    <div className="space-y-4">
      {errorInfo && (
        <GuidedErrorAlert message={errorInfo.message} action={errorInfo.action} />
      )}

      <RouteIntelligenceBanner onRoute={handleProcessRoute} isProcessing={isProcessing} />

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขจัดส่ง</TableHead>
                <TableHead className="hidden sm:table-cell">ผู้รับ</TableHead>
                <TableHead className="hidden md:table-cell">เลขที่บิล</TableHead>
                <TableHead className="hidden lg:table-cell">Tracking</TableHead>
                <TableHead className="hidden lg:table-cell">ขนส่ง</TableHead>
                <TableHead className="hidden md:table-cell text-right">ค่าส่ง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="hidden sm:table-cell">วันที่</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  {/* Shipment Number + mobile sub-info */}
                  <TableCell>
                    <span className="font-mono text-sm">{shipment.shipmentNumber}</span>
                    <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
                      {shipment.recipientName} · {formatDate(shipment.createdAt)}
                    </div>
                    {shipment.trackingNumber && (
                      <div className="lg:hidden text-xs text-muted-foreground mt-0.5">
                        📦 {shipment.trackingNumber}
                      </div>
                    )}
                  </TableCell>

                  {/* Recipient */}
                  <TableCell className="hidden sm:table-cell">
                    <p className="font-medium">{shipment.recipientName}</p>
                    {shipment.recipientPhone && (
                      <p className="text-xs text-muted-foreground">{shipment.recipientPhone}</p>
                    )}
                  </TableCell>

                  {/* Invoice */}
                  <TableCell className="hidden md:table-cell">
                    {shipment.sale ? (
                      <Link href={`/sales/${shipment.sale.id}`} className="text-blue-600 hover:underline">
                        {shipment.sale.invoiceNumber}
                      </Link>
                    ) : '-'}
                  </TableCell>

                  {/* Tracking # */}
                  <TableCell className="hidden lg:table-cell font-mono text-sm">
                    {shipment.trackingNumber || '-'}
                  </TableCell>

                  {/* Provider */}
                  <TableCell className="hidden lg:table-cell">
                    {shipment.shippingProvider || '-'}
                  </TableCell>

                  {/* Cost */}
                  <TableCell className="hidden md:table-cell text-right">
                    {shipment.shippingCost ? formatCurrency(shipment.shippingCost) : '-'}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <ShipmentStatusBadge status={shipment.status} />
                  </TableCell>

                  {/* Date */}
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDate(shipment.createdAt)}
                  </TableCell>

                  {/* View */}
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/shipments/${shipment.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <TablePagination pagination={pagination} onPageChange={goToPage} isPending={isPending} />
    </div>
  );
}
