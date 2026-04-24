'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaginationControl } from '@/components/ui/pagination-control';
import { EmptyState } from '@/components/ui/empty-state';
import { GuidedErrorAlert } from '@/components/ui/guided-error-alert';
import { CancelDialog, PURCHASE_VOID_REASONS } from '@/components/ui/cancel-dialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getPurchaseStatusLabel } from '@/lib/erp-utils';
import { cancelPurchase, convertToPurchaseOrder } from '@/actions/purchases/purchases.actions';
import { usePermissions } from '@/hooks/use-permissions';
import { Package, Edit, Trash2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import type { ErrorAction } from '@/types/domain';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Status helpers (SSOT) ───────────────────────────────────────────────────

const PURCHASE_STATUS_VARIANT: Record<string, string> = {
  DRAFT: 'outline',
  PENDING: 'secondary',
  APPROVED: 'default',
  ORDERED: 'default',
  RECEIVED: 'success',
  CANCELLED: 'destructive',
};

// ─── PurchasesTable ──────────────────────────────────────────────────────────

export function PurchasesTable({ purchases, pagination }: PurchasesTableProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();

  const [cancelDialogPurchase, setCancelDialogPurchase] = useState<Purchase | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; action?: ErrorAction } | null>(null);

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
        setErrorInfo({ message: result.message || 'ไม่สามารถแปลงเอกสารได้', action: result.action });
        toast.error(result.message || 'ไม่สามารถแปลงเอกสารได้');
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
    try {
      const result = await cancelPurchase({ id: cancelDialogPurchase.id, reasonCode, reasonDetail });
      if (!result.success) toast.error(result.message || 'ไม่สามารถยกเลิกรายการได้');
      else { toast.success(result.message || 'ยกเลิกรายการสำเร็จ'); setCancelDialogPurchase(null); }
      router.refresh();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  if (purchases.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-12 w-12" />}
        title="ไม่พบรายการซื้อ"
        action={<Button asChild className="rounded-xl"><Link href="/purchases/new">บันทึกการซื้อใหม่</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {errorInfo && <GuidedErrorAlert message={errorInfo.message} action={errorInfo.action} />}

      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold">วันที่</TableHead>
                <TableHead className="font-bold">เลขที่เอกสาร</TableHead>
                <TableHead className="font-bold">ประเภท</TableHead>
                <TableHead className="font-bold">ผู้จำหน่าย</TableHead>
                <TableHead className="font-bold">หมายเหตุ</TableHead>
                <TableHead className="text-right font-bold">ยอดรวม</TableHead>
                <TableHead className="text-right font-bold">สถานะ</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase: any) => (
                <TableRow key={purchase.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    {formatDate(purchase.date)}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-bold text-primary">
                      {purchase.purchaseNumber || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={purchase.docType === 'REQUEST' ? 'outline' : 'default'} className="w-fit text-[10px] px-1.5 py-0 font-bold uppercase">
                        {purchase.docType === 'REQUEST' ? 'PR (ขอซื้อ)' : 'PO (สั่งซื้อ)'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                        {purchase.purchaseType === 'LOCAL' ? 'ในประเทศ (C)' : 'ต่างประเทศ (T)'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{purchase.supplier?.name || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={purchase.notes}>
                    {purchase.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {formatCurrency(purchase.totalCost.toString())}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={PURCHASE_STATUS_VARIANT[purchase.status] as any} className="text-[10px] font-bold uppercase tracking-wider">
                      {getPurchaseStatusLabel(purchase.status, purchase.docType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {purchase.docType === 'REQUEST' && purchase.status === 'APPROVED' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" title="Convert to PO"
                          onClick={() => handleConvertToPO(purchase.id, purchase.purchaseNumber)}>
                          <Package className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted font-medium" asChild>
                        <Link href={`/purchases/${purchase.id}`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                      {purchase.status !== 'CANCELLED' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelDialogPurchase(purchase)}>
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

      <PaginationControl pagination={pagination} />

      <CancelDialog
        isOpen={!!cancelDialogPurchase}
        onClose={() => setCancelDialogPurchase(null)}
        onConfirm={handleCancelConfirm}
        title="ยกเลิกรายการซื้อ"
        description="ยกเลิกรายการซื้อนี้"
        stockChangePreview="สต็อกจะถูกหักออกตามจำนวนที่ซื้อ"
        isLoading={isProcessing}
        reasons={PURCHASE_VOID_REASONS}
      />
    </div>
  );
}
