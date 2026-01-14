'use client';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Sale, Customer } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PAYMENT_METHODS } from '@/lib/constants';
import { Trash2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { deleteSale } from '@/actions/sales';
import { useState, useTransition } from 'react';

type SaleWithCustomer = Sale & {
  customer: Pick<Customer, 'name'> | null;
};

interface SalesTableProps {
  sales: SaleWithCustomer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function SalesTable({ sales, pagination }: SalesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getPaymentMethodLabel = (value: string) => {
    return PAYMENT_METHODS.find((m) => m.value === value)?.label || value;
  };

  const getPaymentVariant = (method: string) => {
    switch (method) {
      case 'CASH':
        return 'default';
      case 'TRANSFER':
        return 'secondary';
      case 'CREDIT':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!confirm(`ต้องการลบ "${invoiceNumber}" หรือไม่?\n\n⚠️ สต็อกสินค้าจะถูก restore กลับ`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteSale(id);
      if (result.error) {
        alert(result.error);
      }
      router.refresh();
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
    }
  };

  if (sales.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">ไม่พบรายการขาย</p>
        <Button asChild className="mt-4">
          <Link href="/sales/new">บันทึกการขายใหม่</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เลขที่ใบเสร็จ</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>ลูกค้า</TableHead>
              <TableHead>วิธีชำระ</TableHead>
              <TableHead className="text-right">ยอดรวม</TableHead>
              <TableHead className="text-right">กำไร</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>
                  <div className="font-medium">{sale.invoiceNumber}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{formatDate(sale.date)}</div>
                </TableCell>
                <TableCell>
                  {sale.customer?.name || sale.customerName || (
                    <span className="text-muted-foreground">ลูกค้าทั่วไป</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={getPaymentVariant(sale.paymentMethod) as any}>
                    {getPaymentMethodLabel(sale.paymentMethod)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(sale.totalAmount.toString())}
                </TableCell>
                <TableCell className="text-right">
                  <span className={Number(sale.profit) >= 0 ? 'text-green-600' : 'text-destructive'}>
                    {formatCurrency(sale.profit.toString())}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/sales/${sale.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(sale.id, sale.invoiceNumber)}
                      disabled={deletingId === sale.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          แสดง {((pagination.page - 1) * pagination.limit) + 1} -{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} จาก{' '}
          {pagination.total} รายการ
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrevPage || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            หน้า {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNextPage || isPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
