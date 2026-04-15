'use client';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ShipmentStatusBadge } from './shipment-status-badge';
import { ChevronLeft, ChevronRight, Eye, Package, MapPin, Loader2 } from 'lucide-react';
import type { ShipmentStatus } from '@prisma/client';
import { processShipmentRoute } from '@/actions/shipments';
import { useState } from 'react';
import { toast } from 'sonner';

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
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function ShipmentsTable({ shipments, pagination }: ShipmentsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessRoute = async (type: 'OUTBOUND' | 'INBOUND') => {
    const pendingIds = shipments
      .filter(s => s.status === 'PENDING')
      .map(s => s.id);

    if (pendingIds.length === 0) {
      toast.error('ไม่มีรายการที่รอจัดส่งเพื่อแสดงเส้นทาง');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await processShipmentRoute(pendingIds, type);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการคำนวณเส้นทาง');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  if (shipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">ยังไม่มีรายการจัดส่ง</h3>
        <p className="text-sm text-muted-foreground mt-1">
          สร้างรายการจัดส่งแรกของคุณ
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Route Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Logistics Intelligence</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-8"
            onClick={() => handleProcessRoute('OUTBOUND')}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <MapPin className="h-3 w-3 mr-1" />}
            จัดเส้นทาง (ใกล้-ไกล)
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-8"
            onClick={() => handleProcessRoute('INBOUND')}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <MapPin className="h-3 w-3 mr-1" />}
            จัดเส้นทาง (ไกล-ใกล้)
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขจัดส่ง</TableHead>
                <TableHead className="hidden sm:table-cell">ผู้รับ</TableHead>
                <TableHead className="hidden md:table-cell">Invoice</TableHead>
                <TableHead className="hidden lg:table-cell">Tracking</TableHead>
                <TableHead className="hidden lg:table-cell">ขนส่ง</TableHead>
                <TableHead className="hidden md:table-cell text-right">ค่าส่ง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="hidden sm:table-cell">วันที่</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell>
                    <span className="font-mono text-sm">{shipment.shipmentNumber}</span>
                    <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
                      {shipment.recipientName}
                    </div>
                    <div className="sm:hidden text-xs text-muted-foreground">
                      {formatDate(shipment.createdAt)}
                    </div>
                    {shipment.trackingNumber && (
                      <div className="lg:hidden text-xs text-muted-foreground mt-0.5">
                        📦 {shipment.trackingNumber}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div>
                      <p className="font-medium">{shipment.recipientName}</p>
                      {shipment.recipientPhone && (
                        <p className="text-xs text-muted-foreground">
                          {shipment.recipientPhone}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {shipment.sale ? (
                      <Link
                        href={`/sales/${shipment.sale.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {shipment.sale.invoiceNumber}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-sm">
                    {shipment.trackingNumber || '-'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{shipment.shippingProvider || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell text-right">
                    {shipment.shippingCost
                      ? formatCurrency(shipment.shippingCost)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <ShipmentStatusBadge status={shipment.status} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDate(shipment.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/shipments/${shipment.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {pagination.total} รายการ
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
