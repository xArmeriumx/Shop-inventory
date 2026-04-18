'use client';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Customer } from '@prisma/client';
import type { SerializedSale } from '@/types/serialized';
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
import { XCircle, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { cancelSale } from '@/actions/sales';
import { useState, useTransition } from 'react';
import { CancelDialog } from '@/components/shared/cancel-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { Guard } from '@/components/auth/guard';

type SaleWithCustomer = SerializedSale & {
  customer: Pick<Customer, 'name'> | null;
  status?: string;
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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelDialogSale, setCancelDialogSale] = useState<SaleWithCustomer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // RBAC: Check permissions for sensitive columns and actions
  const { hasPermission } = usePermissions();
  const canViewProfit = hasPermission('SALE_VIEW_PROFIT');
  const canCancelSale = hasPermission('SALE_CANCEL');

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

  const handleCancelConfirm = async (reasonCode: string, reasonDetail?: string) => {
    if (!cancelDialogSale) return;
    
    setIsProcessing(true);
    setCancellingId(cancelDialogSale.id);
    try {
      const result = await cancelSale({
        id: cancelDialogSale.id,
        reasonCode,
        reasonDetail,
      });
      if (!result.success) {
        alert(result.message || 'เกิดข้อผิดพลาดในการยกเลิก');
      } else {
        setCancelDialogSale(null);
      }
      router.refresh();
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
      setCancellingId(null);
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
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่ใบเสร็จ</TableHead>
                <TableHead className="hidden sm:table-cell">วันที่</TableHead>
                <TableHead className="hidden md:table-cell">ลูกค้า</TableHead>
                <TableHead className="hidden sm:table-cell">วิธีชำระ</TableHead>
                <TableHead className="text-right">ยอดรวม</TableHead>
                {canViewProfit && <TableHead className="text-right hidden lg:table-cell">กำไร</TableHead>}
                <TableHead className="w-[80px] sm:w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div className="font-medium">{sale.invoiceNumber}</div>
                    {/* Mobile: show date + customer inline */}
                    <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
                      {formatDate(sale.date)}
                      {(sale.customer?.name || sale.customerName) && (
                        <span> · {sale.customer?.name || sale.customerName}</span>
                      )}
                    </div>
                    <div className="sm:hidden mt-1">
                      <Badge variant={getPaymentVariant(sale.paymentMethod) as any} className="text-[10px] px-1.5 py-0">
                        {getPaymentMethodLabel(sale.paymentMethod)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="text-sm">{formatDate(sale.date)}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {sale.customer?.name || sale.customerName || (
                      <span className="text-muted-foreground">ลูกค้าทั่วไป</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={getPaymentVariant(sale.paymentMethod) as any}>
                      {getPaymentMethodLabel(sale.paymentMethod)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(((sale as any).netAmount || sale.totalAmount).toString())}
                  </TableCell>
                  {canViewProfit && (
                    <TableCell className="text-right hidden lg:table-cell">
                      <span className={Number(sale.profit) >= 0 ? 'text-green-600' : 'text-destructive'}>
                        {formatCurrency(sale.profit.toString())}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/sales/${sale.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Guard permission="SALE_CANCEL">
                        {sale.status !== 'CANCELLED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCancelDialogSale(sale)}
                            disabled={cancellingId === sale.id}
                            title="ยกเลิกรายการ"
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </Guard>
                      {sale.status === 'CANCELLED' && (
                        <Badge variant="outline" className="text-[10px] text-destructive border-destructive">
                          ยกเลิก
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs sm:text-sm text-muted-foreground">
          <span className="hidden sm:inline">แสดง {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} จาก </span>
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
            {pagination.page}/{pagination.totalPages}
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
        isOpen={!!cancelDialogSale}
        onClose={() => setCancelDialogSale(null)}
        onConfirm={handleCancelConfirm}
        title="ยกเลิกรายการขาย"
        description={cancelDialogSale ? `ยกเลิก ${cancelDialogSale.invoiceNumber}` : ''}
        stockChangePreview="สต็อกจะถูกเพิ่มกลับตามจำนวนที่ขาย"
        isLoading={isProcessing}
      />
    </div>
  );
}
