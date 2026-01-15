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

interface StockLog {
  id: string;
  type: string;
  quantity: number;
  balance: number;
  referenceId: string | null;
  referenceType: string | null;
  note: string | null;
  date: Date;
  user: {
    name: string | null;
  };
}

interface StockHistoryTableProps {
  logs: StockLog[];
}

export function StockHistoryTable({ logs }: StockHistoryTableProps) {
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

  return (
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
              <TableCell className="text-sm text-muted-foreground">
                {log.referenceType === 'SALE' && log.referenceId && (
                   // Ideally we link to the sale, but simplest is just text for now
                   `Sale`
                )}
                {log.referenceType === 'PURCHASE' && log.referenceId && (
                   `Purchase`
                )}
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
  );
}
