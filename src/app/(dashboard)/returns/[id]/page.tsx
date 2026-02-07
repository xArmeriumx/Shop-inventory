import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';
import { ArrowLeft, RotateCcw, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getReturnById } from '@/actions/returns';
import { formatCurrency } from '@/lib/formatters';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const returnData = await getReturnById(params.id);
  return {
    title: returnData
      ? `${returnData.returnNumber} | Returns`
      : 'Return Not Found',
  };
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  COMPLETED: { label: 'Completed', variant: 'default' },
  PENDING: { label: 'Pending', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

const REFUND_METHOD_MAP: Record<string, string> = {
  CASH: 'Cash',
  TRANSFER: 'Bank Transfer',
  CREDIT: 'Store Credit',
};

function formatThaiDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(d, 'Asia/Bangkok');
  return format(zonedDate, 'd MMM yyyy, HH:mm', { locale: th });
}

export default async function ReturnDetailPage({ params }: { params: { id: string } }) {
  const returnData = await getReturnById(params.id);

  if (!returnData) {
    notFound();
  }

  const statusConfig = STATUS_MAP[returnData.status] || STATUS_MAP.COMPLETED;
  const customerName = returnData.sale?.customer?.name || returnData.sale?.customerName || 'Walk-in Customer';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/returns">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{returnData.returnNumber}</h1>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatThaiDate(returnData.createdAt)}
            {returnData.user?.name && ` • by ${returnData.user.name}`}
          </p>
        </div>
      </div>

      {/* Sale Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sale Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Invoice:</span>
                <Link
                  href={`/sales/${returnData.saleId}`}
                  className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {returnData.sale?.invoiceNumber || returnData.saleId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <span className="text-muted-foreground">Customer: </span>
                <span>{customerName}</span>
              </div>
              {returnData.sale?.date && (
                <div>
                  <span className="text-muted-foreground">Sale Date: </span>
                  <span>{formatThaiDate(returnData.sale.date)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Returned Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Returned Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">#</th>
                  <th className="text-left py-2 font-medium">Product</th>
                  <th className="text-right py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Refund/Unit</th>
                  <th className="text-right py-2 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {returnData.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3">{idx + 1}</td>
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                        {item.product?.sku && (
                          <p className="text-xs text-muted-foreground">SKU: {item.product.sku}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right">{item.quantity}</td>
                    <td className="py-3 text-right">{formatCurrency(item.refundPerUnit)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(item.refundAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator className="my-4" />

          {/* Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Items</span>
              <span>{returnData.items.reduce((sum: number, i: any) => sum + i.quantity, 0)} pcs</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Refund Method</span>
              <Badge variant="outline">
                {REFUND_METHOD_MAP[returnData.refundMethod] || returnData.refundMethod}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Refund</span>
              <span className="text-xl font-bold text-green-600">{formatCurrency(returnData.refundAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reason */}
      {returnData.reason && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{returnData.reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
