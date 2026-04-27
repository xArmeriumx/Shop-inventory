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
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { ChevronRight, PackageCheck } from 'lucide-react';
import Link from 'next/link';
import { PurchaseStatus } from '@/types/domain';

interface ReceivingTableProps {
  data: any[];
  pagination: any;
}

export function ReceivingTable({ data, pagination }: ReceivingTableProps) {
  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[150px]">เลขที่ใบสั่งซื้อ</TableHead>
            <TableHead>วันที่</TableHead>
            <TableHead>ผู้จำหน่าย</TableHead>
            <TableHead>รายการ</TableHead>
            <TableHead>สถานะการรับ</TableHead>
            <TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <PackageCheck className="w-8 h-8 opacity-20" />
                  <p>ไม่มีรายการรอรับสินค้าในขณะนี้</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((po) => {
              const totalItems = po.items?.length || 0;
              const receivedItems = po.items?.filter((i: any) => i.receivedQuantity >= i.quantity).length || 0;
              
              return (
                <TableRow key={po.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{po.purchaseNumber}</TableCell>
                  <TableCell>
                    {format(new Date(po.date), 'dd MMM yyyy', { locale: th })}
                  </TableCell>
                  <TableCell>{po.supplier?.name || po.supplierName || '-'}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      {receivedItems} / {totalItems} รายการรับเสร็จ
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={po.status === PurchaseStatus.PARTIALLY_RECEIVED ? 'warning' : 'secondary'}>
                      {po.status === PurchaseStatus.PARTIALLY_RECEIVED ? 'รับแล้วบางส่วน' : 'รอรับสินค้า'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/purchases/receiving/${po.id}`} className="flex items-center gap-2">
                        รับสินค้า
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
