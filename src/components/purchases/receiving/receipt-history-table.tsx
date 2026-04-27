'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { FileText } from 'lucide-react';

interface ReceiptHistoryTableProps {
  data: any[];
  pagination: any;
}

export function ReceiptHistoryTable({ data, pagination }: ReceiptHistoryTableProps) {
  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[180px]">เลขที่ใบรับสินค้า</TableHead>
            <TableHead>วันที่รับ</TableHead>
            <TableHead>ใบสั่งซื้ออ้างอิง</TableHead>
            <TableHead>ผู้จำหน่าย</TableHead>
            <TableHead>จำนวนรายการ</TableHead>
            <TableHead>สถานะ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 opacity-20" />
                  <p>ยังไม่มีประวัติการรับสินค้า</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((receipt) => (
              <TableRow 
                key={receipt.id} 
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/purchases/receiving/receipts/${receipt.id}`}
              >
                <TableCell className="font-bold text-primary">{receipt.receiptNumber}</TableCell>
                <TableCell>
                  {format(new Date(receipt.receivedDate), 'dd MMM yyyy HH:mm', { locale: th })}
                </TableCell>
                <TableCell className="font-medium">{receipt.purchase?.purchaseNumber || '-'}</TableCell>
                <TableCell>{receipt.purchase?.supplier?.name || '-'}</TableCell>
                <TableCell>{receipt.lines?.length || 0} รายการ</TableCell>
                <TableCell>
                  <Badge variant="success">สำเร็จ</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
