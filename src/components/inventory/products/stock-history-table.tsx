import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { ClientDate } from '@/components/ui/client-date';
import Link from 'next/link';

interface StockLog {
  id: string;
  type: string;
  quantity: number;
  balance: number;
  saleId: string | null;
  purchaseId: string | null;
  returnId: string | null;
  note: string | null;
  date: Date;
  user: {
    name: string | null;
  };
}

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StockHistoryTableProps {
  logs: StockLog[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  onPageChange?: (page: number) => void;
}

export function StockHistoryTable(props: StockHistoryTableProps) {
  const { logs } = props;
  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'SALE':
        return 'destructive'; // Red
      case 'PURCHASE':
        return 'default'; // Black/Primary
      case 'ADJUSTMENT':
        return 'secondary'; // Gray
      case 'RETURN':
        return 'default';
      case 'WASTE':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'SALE':
        return 'ขายสินค้า';
      case 'PURCHASE':
        return 'ซื้อสินค้า';
      case 'ADJUSTMENT':
        return 'ปรับยอด';
      case 'RETURN':
        return 'รับคืน';
      case 'WASTE':
        return 'ของเสีย';
      case 'CANCEL':
        return 'ยกเลิกรายการ';
      default:
        return type;
    }
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground border rounded-lg">
        ยังไม่มีประวัติการเคลื่อนไหวของสินค้า
      </div>
    );
  }
  const { logs: _logs, pagination, onPageChange } = props;

  // If onPageChange is not provided, we might want to default to URL param Update
  // But typically it's better if the parent component handles it.
  // We'll leave it to the parent to provide the handler or we can fallback to simple navigation here if needed.
  // For this specific use case, we updated the parent to pass historyPage param, so we need a client-side wrapper in the parent OR simply use Link/router here if we want self-contained.
  // However, since this is a table component, best practice is to accept a handler.
  
  // Let's assume parent passes the handler. If not, and we have pagination, buttons won't do anything unless we wire them.
  // Given we are in a server component world for the page, but this might be a client component (it has 'use client' at top? No, let's check).
  // Ah, the file doesn't have 'use client'. But it imports hooks? No, it imports UI components.
  // Wait, `StockHistoryTable` imports `ClientDate` which is client.
  // To make buttons interactive, this component needs to be client-side OR use <form> actions / or standard Links.
  // Since we used onClick, this MUST be a client component.
  
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่/เวลา</TableHead>
              <TableHead>รายการ</TableHead>
              <TableHead className="text-right">จำนวน</TableHead>
              <TableHead className="text-right">คงเหลือ</TableHead>
              <TableHead>อ้างอิง</TableHead>
              <TableHead>หมายเหตุ</TableHead>
              <TableHead>ผู้ทำรายการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  {/* Display date using client-side formatting to match user timezone */}
                  <ClientDate date={log.date} />
                </TableCell>
                <TableCell>
                  <Badge variant={getBadgeColor(log.type) as any}>
                    {getTypeName(log.type)}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-medium ${log.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {log.quantity > 0 ? '+' : ''}{log.quantity}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {log.balance}
                </TableCell>
                <TableCell className="text-sm">
                  {((log.type === 'SALE' || log.type === 'SALE_CANCEL' || log.type === 'RESERVATION' || log.type === 'RELEASE') && log.saleId) ? (
                    <Link href={`/sales/${log.saleId}`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      Sale 🔗
                    </Link>
                  ) : null}
                  {(log.type === 'PURCHASE' || log.type === 'PURCHASE_VOID') && log.purchaseId ? (
                    <Link href={`/purchases/${log.purchaseId}`} className="text-orange-600 hover:underline inline-flex items-center gap-1">
                      Purchase 🔗
                    </Link>
                  ) : null}
                  {log.type === 'RETURN' && log.returnId ? (
                    <Link href={`/returns/${log.returnId}`} className="text-green-600 hover:underline inline-flex items-center gap-1">
                      Return 🔗
                    </Link>
                  ) : null}
                  {!log.saleId && !log.purchaseId && !log.returnId && <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-sm max-w-[200px] truncate" title={log.note || ''}>
                   {log.note || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.user.name || 'Unknown'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {pagination && (
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
              onClick={() => onPageChange?.(pagination!.page - 1)}
              disabled={!pagination.hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              หน้า {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination!.page + 1)}
              disabled={!pagination.hasNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
