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
import { getPurchaseStatusLabel } from '@/lib/erp-utils';
import { XCircle, ChevronLeft, ChevronRight, Eye, Package, Edit, Trash2 } from 'lucide-react';
import { cancelPurchase, convertToPurchaseOrder } from '@/actions/purchases';
import { useState, useTransition } from 'react';
import { CancelDialog, PURCHASE_CANCEL_REASONS } from '@/components/shared/cancel-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';
import { GuidedErrorAlert } from '@/components/ui/guided-error-alert';
import { ErrorAction } from '@/types/domain';

interface Purchase {
  id: string;
  purchaseNumber: string | null;
  purchaseType: string;
  docType: string;
  date: Date | string;
  supplier?: { name: string } | null;
  totalCost: number;
  status: string;
  notes?: string | null;
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
  const [errorInfo, setErrorInfo] = useState<{ message: string; action?: ErrorAction } | null>(null);
  
  // RBAC: Check permissions for actions
  const { hasPermission } = usePermissions();

  const getStatusLabel = (status: string, docType: string) => {
    return getPurchaseStatusLabel(status, docType as any);
  };

  const getStatusVariant = (status?: string): any => {
    switch (status) {
      case 'DRAFT': return 'outline';
      case 'PENDING': return 'secondary';
      case 'APPROVED': return 'default';
      case 'ORDERED': return 'default';
      case 'RECEIVED': return 'success';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleConvertToPO = async (id: string, number: string) => {
    if (!confirm(`ต้องการแปลงใบขอซื้อ ${number} เป็นใบสั่งซื้อ (PO) ใช่หรือไม่?`)) return;
    
    setIsProcessing(true);
    try {
      const result = await convertToPurchaseOrder(id);
      if (result.success) {
        toast.success(result.message);
        setErrorInfo(null);
        router.refresh();
      } else {
        const fallbackMsg = result.message || 'ไม่สามารถแปลงเอกสารได้';
        setErrorInfo({ message: fallbackMsg, action: result.action });
        toast.error(fallbackMsg);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการแปลงเอกสาร');
    } finally {
      setIsProcessing(false);
    }
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
        toast.error(result.message || 'ไม่สามารถยกเลิกรายการได้');
      } else {
        toast.success(result.message || 'ยกเลิกรายการสำเร็จ');
        setCancelDialogPurchase(null);
      }
      router.refresh();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
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
      {errorInfo && (
        <GuidedErrorAlert 
          message={errorInfo.message} 
          action={errorInfo.action} 
          className="mb-4"
        />
      )}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>เลขที่เอกสาร</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>ผู้ผลิต/จำหน่าย</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="text-right">ยอดรวม</TableHead>
                <TableHead className="text-right">สถานะ</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase: any) => (
                <TableRow key={purchase.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(purchase.date).toLocaleDateString('th-TH')}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm font-semibold">
                      {purchase.purchaseNumber || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={purchase.docType === 'REQUEST' ? 'outline' : 'default'} className="w-fit text-[10px] px-1.5 py-0">
                        {purchase.docType === 'REQUEST' ? 'PR (ขอซื้อ)' : 'PO (สั่งซื้อ)'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {purchase.purchaseType === 'LOCAL' ? 'ในประเทศ (C)' : 'ต่างประเทศ (T)'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{purchase.supplier?.name || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={purchase.notes}>
                    {purchase.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(purchase.totalCost.toString())}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={getStatusVariant(purchase.status)}>
                      {getStatusLabel(purchase.status, purchase.docType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {purchase.docType === 'REQUEST' && purchase.status === 'APPROVED' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" 
                          title="Convert to PO"
                          onClick={() => handleConvertToPO(purchase.id, purchase.purchaseNumber)}
                        >
                          <Package className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/purchases/${purchase.id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      {purchase.status !== 'CANCELLED' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelDialogPurchase(purchase)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
