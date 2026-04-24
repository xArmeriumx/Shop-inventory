'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { XCircle, Eye } from 'lucide-react';
import { cancelSale } from '@/actions/sales/sales.actions';
import { useState } from 'react';
import { CancelDialog } from '@/components/shared/cancel-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { Guard } from '@/components/core/auth/guard';
import { PaginationControl } from '@/components/ui/pagination-control';

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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelDialogSale, setCancelDialogSale] = useState<SaleWithCustomer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // RBAC: Check permissions for sensitive columns and actions
  const { hasPermission } = usePermissions();
  const canViewProfit = hasPermission('SALE_VIEW_PROFIT');

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
      <div className="rounded-2xl border border-dashed bg-muted/20 p-12 text-center">
        <p className="text-muted-foreground font-medium">ไม่พบรายการขาย</p>
        <Button asChild className="mt-4 rounded-xl">
          <Link href="/sales/new">บันทึกการขายใหม่</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold">เลขที่ใบเสร็จ</TableHead>
                <TableHead className="hidden sm:table-cell font-bold">วันที่</TableHead>
                <TableHead className="hidden md:table-cell font-bold">ลูกค้า</TableHead>
                <TableHead className="hidden sm:table-cell font-bold">วิธีชำระ</TableHead>
                <TableHead className="text-right font-bold">ยอดรวม</TableHead>
                {canViewProfit && <TableHead className="text-right hidden lg:table-cell font-bold">กำไร</TableHead>}
                <TableHead className="w-[80px] sm:w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="font-bold text-foreground">{sale.invoiceNumber}</div>
                    {/* Mobile: show date + customer inline */}
                    <div className="sm:hidden text-[10px] text-muted-foreground mt-0.5 font-medium">
                      {formatDate(sale.date)}
                      {(sale.customer?.name || sale.customerName) && (
                        <span> · {sale.customer?.name || sale.customerName}</span>
                      )}
                    </div>
                    <div className="sm:hidden mt-1">
                      <Badge variant={getPaymentVariant(sale.paymentMethod) as any} className="text-[10px] px-1.5 py-0 font-bold uppercase">
                        {getPaymentMethodLabel(sale.paymentMethod)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm font-medium">
                    {formatDate(sale.date)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm font-medium">
                    {sale.customer?.name || sale.customerName || (
                      <span className="text-muted-foreground italic">ลูกค้าทั่วไป</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={getPaymentVariant(sale.paymentMethod) as any} className="font-bold uppercase tracking-wider text-[10px]">
                      {getPaymentMethodLabel(sale.paymentMethod)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {formatCurrency(((sale as any).netAmount || sale.totalAmount).toString())}
                  </TableCell>
                  {canViewProfit && (
                    <TableCell className="text-right hidden lg:table-cell font-bold">
                      <span className={Number(sale.profit) >= 0 ? 'text-green-600' : 'text-destructive'}>
                        {formatCurrency(sale.profit.toString())}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" asChild title="ดูรายละเอียด">
                        <Link href={`/sales/${sale.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Guard permission="SALE_CANCEL">
                        {sale.status !== 'CANCELLED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => setCancelDialogSale(sale)}
                            disabled={cancellingId === sale.id}
                            title="ยกเลิกรายการ"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </Guard>
                      {sale.status === 'CANCELLED' && (
                        <Badge variant="outline" className="text-[10px] font-bold text-destructive border-destructive uppercase">
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

      <PaginationControl pagination={pagination} />

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
