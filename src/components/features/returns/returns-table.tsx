'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface ReturnRecord {
  id: string;
  returnNumber: string;
  reason: string;
  refundAmount: number;
  refundMethod: string;
  status: string;
  createdAt: Date;
  sale: { invoiceNumber: string };
  user: { name: string };
  items: {
    id: string;
    quantity: number;
    product: { name: string; sku: string | null };
  }[];
}

interface ReturnsTableProps {
  returns: ReturnRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

function getRefundMethodLabel(method: string) {
  const map: Record<string, string> = {
    CASH: 'เงินสด',
    TRANSFER: 'เงินโอน',
    CREDIT: 'เครดิต',
  };
  return map[method] || method;
}

function getStatusBadge(status: string) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    COMPLETED: { label: 'สำเร็จ', variant: 'default' },
    PENDING: { label: 'รอดำเนินการ', variant: 'secondary' },
    CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
  };
  const c = config[status] || config.COMPLETED;
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function ReturnsTable({ returns, pagination }: ReturnsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/returns?${params.toString()}`);
  };

  if (returns.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">ไม่พบรายการคืนสินค้า</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เลขที่คืน</TableHead>
              <TableHead>บิลขาย</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>สินค้า</TableHead>
              <TableHead>เหตุผล</TableHead>
              <TableHead className="text-right">คืนเงิน</TableHead>
              <TableHead>วิธีคืน</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((ret) => (
              <TableRow key={ret.id}>
                <TableCell>
                  <Link href={`/returns/${ret.id}`} className="font-medium text-blue-600 hover:underline">
                    {ret.returnNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/sales/${ret.id}`} className="text-muted-foreground hover:underline">
                    {ret.sale.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(ret.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {ret.items.map((item, i) => (
                      <div key={item.id}>
                        {item.product.name} x{item.quantity}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {ret.reason}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(ret.refundAmount)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getRefundMethodLabel(ret.refundMethod)}</Badge>
                </TableCell>
                <TableCell>
                  {getStatusBadge(ret.status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            ทั้งหมด {pagination.total} รายการ (หน้า {pagination.page}/{pagination.totalPages})
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrevPage}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
