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
import { XCircle, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { cancelPurchase } from '@/actions/purchases';
import { useState, useTransition } from 'react';
import { CancelDialog, PURCHASE_CANCEL_REASONS } from '@/components/features/shared/cancel-dialog';

interface Purchase {
  id: string;
  date: Date;
  totalCost: number | { toString: () => string };
  supplier?: { name: string } | null;
  notes: string | null;
  status?: string;
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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelDialogPurchase, setCancelDialogPurchase] = useState<Purchase | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleCancelConfirm = async (reasonCode: string, reasonDetail?: string) => {
    if (!cancelDialogPurchase) return;
    
    setIsProcessing(true);
    setCancellingId(cancelDialogPurchase.id);
    try {
      const result = await cancelPurchase({
        id: cancelDialogPurchase.id,
        reasonCode,
        reasonDetail,
      });
      if (!result.success) {
        alert(result.message);
      } else {
        setCancelDialogPurchase(null);
      }
      router.refresh();
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
      setCancellingId(null);
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
                    {purchase.status !== 'CANCELLED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCancelDialogPurchase(purchase)}
                        disabled={cancellingId === purchase.id}
                        title="ยกเลิกรายการ"
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    {purchase.status === 'CANCELLED' && (
                      <Badge variant="outline" className="text-xs text-destructive border-destructive">
                        ยกเลิกแล้ว
                      </Badge>
                    )}
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

      {/* Cancel Dialog */}
      <CancelDialog
        isOpen={!!cancelDialogPurchase}
        onClose={() => setCancelDialogPurchase(null)}
        onConfirm={handleCancelConfirm}
        title="ยกเลิกรายการซื้อ"
        description="ยกเลิกรายการซื้อนี้"
        stockChangePreview="สต็อกจะถูกหักออกตามจำนวนที่ซื้อ"
        isLoading={isProcessing}
        reasons={PURCHASE_CANCEL_REASONS}
      />
    </div>
  );
}
