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
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PAYMENT_METHODS } from '@/lib/constants';
import { Trash2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { deletePurchase } from '@/actions/purchases';
import { useState, useTransition } from 'react';

interface Purchase {
  id: string;
  date: Date;
  totalCost: number | { toString: () => string };
  supplier?: { name: string } | null;
  notes: string | null;
}

interface PurchasesTableProps {
  purchases: Purchase[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function PurchasesTable({ purchases, pagination }: PurchasesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`ต้องการลบรายการนี้หรือไม่?\n\n⚠️ สต็อกสินค้าจะถูกหักออก`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deletePurchase(id);
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

  if (purchases.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">ไม่พบรายการซื้อ</p>
        <Button asChild className="mt-4">
          <Link href="/purchases/new">บันทึกการซื้อใหม่</Link>
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
              <TableHead>วันที่</TableHead>
              <TableHead>ผู้จัดจำหน่าย</TableHead>
              <TableHead>หมายเหตุ</TableHead>
              <TableHead className="text-right">ยอดรวม</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((purchase) => (
              <TableRow key={purchase.id}>
                <TableCell>
                  <div className="text-sm">{formatDate(purchase.date)}</div>
                </TableCell>
                <TableCell>
                  {purchase.supplier?.name || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {purchase.notes ? (
                    <span className="text-sm">{purchase.notes}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(purchase.totalCost.toString())}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/purchases/${purchase.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(purchase.id)}
                      disabled={deletingId === purchase.id}
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
