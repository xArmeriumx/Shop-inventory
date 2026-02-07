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
import { ChevronLeft, ChevronRight, Eye, Package } from 'lucide-react';
import type { ShipmentStatus } from '@prisma/client';

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
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">เลขจัดส่ง</TableHead>
              <TableHead>ผู้รับ</TableHead>
              <TableHead>เลข Invoice</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>ขนส่ง</TableHead>
              <TableHead className="text-right">ค่าส่ง</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.map((shipment) => (
              <TableRow key={shipment.id}>
                <TableCell className="font-mono text-sm">
                  {shipment.shipmentNumber}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{shipment.recipientName}</p>
                    {shipment.recipientPhone && (
                      <p className="text-xs text-muted-foreground">
                        {shipment.recipientPhone}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
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
                <TableCell className="font-mono text-sm">
                  {shipment.trackingNumber || '-'}
                </TableCell>
                <TableCell>{shipment.shippingProvider || '-'}</TableCell>
                <TableCell className="text-right">
                  {shipment.shippingCost
                    ? formatCurrency(shipment.shippingCost)
                    : '-'}
                </TableCell>
                <TableCell>
                  <ShipmentStatusBadge status={shipment.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(shipment.createdAt)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            แสดง {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} จาก{' '}
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
