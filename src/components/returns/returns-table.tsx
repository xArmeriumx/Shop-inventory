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
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่คืน</TableHead>
                <TableHead className="hidden sm:table-cell">บิลขาย</TableHead>
                <TableHead className="hidden md:table-cell">วันที่</TableHead>
                <TableHead className="hidden lg:table-cell">สินค้า</TableHead>
                <TableHead className="hidden lg:table-cell">เหตุผล</TableHead>
                <TableHead className="text-right">คืนเงิน</TableHead>
                <TableHead className="hidden sm:table-cell">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell>
                    <Link href={`/returns/${ret.id}`} className="font-medium text-blue-600 hover:underline">
                      {ret.returnNumber}
                    </Link>
                    {/* Mobile: show sale + date + status inline */}
                    <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
                      {ret.sale.invoiceNumber} · {formatDate(ret.createdAt)}
                    </div>
                    <div className="sm:hidden mt-1 flex items-center gap-1">
                      {getStatusBadge(ret.status)}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {getRefundMethodLabel(ret.refundMethod)}
                      </Badge>
                    </div>
                    {/* Mobile: show product names */}
                    <div className="lg:hidden text-xs text-muted-foreground mt-0.5">
                      {ret.items.map(item => `${item.product.name} x${item.quantity}`).join(', ')}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Link href={`/sales/${ret.id}`} className="text-muted-foreground hover:underline">
                      {ret.sale.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {formatDate(ret.createdAt)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-sm">
                      {ret.items.map((item) => (
                        <div key={item.id}>
                          {item.product.name} x{item.quantity}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-sm">
                    {ret.reason}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(ret.refundAmount)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {getStatusBadge(ret.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {pagination.total} รายการ
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
