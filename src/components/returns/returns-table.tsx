'use client';

import Link from 'next/link';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, type StatusConfig } from '@/components/ui/status-badge';
import { TablePagination, type PaginationInfo } from '@/components/ui/table-pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { RotateCcw } from 'lucide-react';

// ─── Status Config (SSOT for return status display) ──────────────────────────

const RETURN_STATUS_CONFIG: Record<string, StatusConfig> = {
  COMPLETED: { label: 'สำเร็จ', variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
  PENDING: { label: 'รอดำเนินการ', variant: 'secondary' },
  CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

const REFUND_METHOD_LABEL: Record<string, string> = {
  CASH: 'เงินสด',
  TRANSFER: 'เงินโอน',
  CREDIT: 'เครดิต',
};

// ─── Types ──────────────────────────────────────────────────────────────────

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
  items: { id: string; quantity: number; product: { name: string; sku: string | null } }[];
}

interface ReturnsTableProps {
  returns: ReturnRecord[];
  pagination: PaginationInfo;
}

// ─── ReturnsTable ─────────────────────────────────────────────────────────────

export function ReturnsTable({ returns, pagination }: ReturnsTableProps) {
  const { goToPage, isPending } = useUrlFilters();

  if (returns.length === 0) {
    return (
      <EmptyState
        icon={<RotateCcw className="h-12 w-12" />}
        title="ไม่พบรายการคืนสินค้า"
      />
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
                    {/* Mobile: sale + date + status */}
                    <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
                      {ret.sale.invoiceNumber} · {formatDate(ret.createdAt)}
                    </div>
                    <div className="sm:hidden mt-1 flex items-center gap-1">
                      <StatusBadge status={ret.status} config={RETURN_STATUS_CONFIG} />
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {REFUND_METHOD_LABEL[ret.refundMethod] || ret.refundMethod}
                      </Badge>
                    </div>
                    {/* Mobile: product names */}
                    <div className="lg:hidden text-xs text-muted-foreground mt-0.5">
                      {ret.items.map(item => `${item.product.name} x${item.quantity}`).join(', ')}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Link href={`/sales/${ret.sale?.invoiceNumber}`} className="text-muted-foreground hover:underline">
                      {ret.sale.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{formatDate(ret.createdAt)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-sm">
                      {ret.items.map((item) => (
                        <div key={item.id}>{item.product.name} x{item.quantity}</div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-sm">{ret.reason}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(ret.refundAmount)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge status={ret.status} config={RETURN_STATUS_CONFIG} />
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
