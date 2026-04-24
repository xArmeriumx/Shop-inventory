import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { StatusBadge, type StatusConfig } from '@/components/ui/status-badge';
import { getReturnById } from '@/actions/sales/returns.actions';
import { formatCurrency } from '@/lib/formatters';
import Loading from '@/app/(dashboard)/loading';
import { DocumentFlowPath } from '@/components/ui/document-flow-path';
import { WorkflowAssistant } from '@/components/ui/workflow-assistant';

// ─── Status / Label Config ───────────────────────────────────────────────────

const RETURN_STATUS_CONFIG: Record<string, StatusConfig> = {
  COMPLETED: { label: 'สำเร็จ', variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
  PENDING: { label: 'รอดำเนินการ', variant: 'secondary' },
  CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

const REFUND_METHOD_LABEL: Record<string, string> = {
  CASH: 'เงินสด',
  TRANSFER: 'เงินโอน',
  CREDIT: 'เครดิต (Store Credit)',
};

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { id: string } }) {
  const data = await getReturnById(params.id);
  return { title: data ? `${data.returnNumber} | คืนสินค้า` : 'ไม่พบรายการ' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatThaiDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(toZonedTime(d, 'Asia/Bangkok'), 'd MMM yyyy, HH:mm', { locale: th });
}

// ─── Detail View ─────────────────────────────────────────────────────────────

async function ReturnDetailContent({ id }: { id: string }) {
  const returnData = await getReturnById(id);
  if (!returnData) notFound();

  const customerName =
    returnData.sale?.customer?.name || returnData.sale?.customerName || 'ลูกค้าทั่วไป';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <BackPageHeader
          backHref="/returns"
          title={returnData.returnNumber}
          description={`${formatThaiDate(returnData.createdAt)}${returnData.user?.name ? ` • โดย ${returnData.user.name}` : ''}`}
        />
        <StatusBadge status={returnData.status} config={RETURN_STATUS_CONFIG} />
      </div>

      {/* Document Lifecycle Path */}
      <DocumentFlowPath
        steps={[
          {
            id: 'sale',
            label: 'บิลขายต้นทาง',
            status: 'completed'
          },
          {
            id: 'return',
            label: 'ใบคืนสินค้า',
            status: 'current'
          },
          {
            id: 'refund',
            label: 'คืนเงิน / Credit Note',
            status: returnData.status === 'COMPLETED' ? 'completed' : 'pending'
          }
        ]}
      />

      {/* Workflow Assistant */}
      <WorkflowAssistant
        type="sale" // Using sale context for refund actions
        status={returnData.status === 'COMPLETED' ? 'ดำเนินคืนสินค้าเสร็จสิ้น' : 'รอตรวจสอบการคืน'}
        steps={[
          ...(returnData.status === 'PENDING' ? [{
            label: 'ตรวจสอบสภาพสินค้าที่คืน',
            action: 'ยืนยันการรับคืน',
            description: 'เมื่อได้รับสินค้าคืนและตรวจสอบความถูกต้องแล้ว กรุณายืนยันเพื่อบันทึกสต็อกและเตรียมคืนเงิน',
            isPrimary: true,
            onClick: () => {
              // Action logic
              alert('ยืนยันคืนสินค้า (Simulation)');
            }
          }] : []),
          ...(returnData.status === 'COMPLETED' ? [{
            label: 'ขั้นตอนถัดไป: บันทึกการคืนเงิน',
            action: 'ไปที่รายการรับเงิน',
            description: 'การคืนสินค้าเสร็จสิ้นแล้ว หากเป็นการคืนเงินสดหรือโอนเงิน กรุณาตรวจสอบประวัติการเงินเพื่อความถูกต้อง',
            onClick: () => {
              window.location.href = `/accounting/payments`;
            }
          }] : [])
        ]}
      />

      {/* Sale Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">บิลขายอ้างอิง</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">เลขที่บิล:</span>
            <Link
              href={`/sales/${returnData.saleId}`}
              className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              {returnData.sale?.invoiceNumber || returnData.saleId}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div>
            <span className="text-muted-foreground">ลูกค้า: </span>
            <span>{customerName}</span>
          </div>
          {returnData.sale?.date && (
            <div>
              <span className="text-muted-foreground">วันขาย: </span>
              <span>{formatThaiDate(returnData.sale.date)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Returned Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">สินค้าที่คืน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">#</th>
                  <th className="text-left py-2 font-medium">สินค้า</th>
                  <th className="text-right py-2 font-medium">จำนวน</th>
                  <th className="text-right py-2 font-medium">คืน/หน่วย</th>
                  <th className="text-right py-2 font-medium">รวม</th>
                </tr>
              </thead>
              <tbody>
                {returnData.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3">{idx + 1}</td>
                    <td className="py-3">
                      <p className="font-medium">{item.product?.name || 'ไม่ทราบ'}</p>
                      {item.product?.sku && (
                        <p className="text-xs text-muted-foreground">SKU: {item.product.sku}</p>
                      )}
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
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">จำนวนชิ้นรวม</span>
              <span>{returnData.items.reduce((sum: number, i: any) => sum + i.quantity, 0)} ชิ้น</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">วิธีคืนเงิน</span>
              <Badge variant="outline">
                {REFUND_METHOD_LABEL[returnData.refundMethod] || returnData.refundMethod}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-semibold">ยอดคืนทั้งหมด</span>
              <span className="text-xl font-bold text-green-600">{formatCurrency(returnData.refundAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reason */}
      {returnData.reason && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">เหตุผลการคืน</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{returnData.reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReturnDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<Loading />}>
      <ReturnDetailContent id={params.id} />
    </Suspense>
  );
}
