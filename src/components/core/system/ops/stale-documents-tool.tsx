'use client';

import { useState, useEffect } from 'react';
import { getStaleDocuments } from '@/actions/inventory/ops.actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import Link from 'next/link';

export function StaleDocumentsTool() {
  const [data, setData] = useState<{ sales: any[], purchases: any[] }>({ sales: [], purchases: [] });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getStaleDocuments();
      setData(result.success && result.data ? result.data : { sales: [], purchases: [] });
    } catch (error) {
      console.error('Failed to load stale documents', error);
      toast.error('ไม่สามารถโหลดข้อมูลเอกสารค้างได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalStale = data.sales.length + data.purchases.length;

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12 text-muted-foreground">
        กำลังตรวจสอบเอกสารตกค้าง...
      </div>
    );
  }

  const DocumentRow = ({ doc }: { doc: any }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full ${doc.type === 'SALE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold">{doc.number}</span>
            <Badge variant="secondary" className="text-[10px] h-4">
              {doc.type}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-4 border-orange-200 text-orange-700 bg-orange-50">
              {doc.status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
            <span>{doc.partner}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              สร้างเมื่อ {formatDate(doc.createdAt)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-medium">{formatCurrency(doc.amount)}</div>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/${doc.type === 'SALE' ? 'sales' : 'purchases'}/${doc.id}`}>
            ตรวจสอบ <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">ติดตามเอกสารตกค้าง (Stale Documents)</h3>
          <p className="text-sm text-muted-foreground">รายการที่สร้างไว้นานกว่า 3 วันแต่ยังไม่มีความคืบหน้า (เช่น ยังไม่ยืนยัน, ยังไม่รับของ)</p>
        </div>
        <div className="flex items-center gap-2">
          {totalStale > 0 ? (
            <div className="flex items-center gap-1 text-orange-600 font-medium text-sm border border-orange-200 bg-orange-50 px-3 py-1 rounded-full">
              <AlertTriangle className="h-4 w-4" />
              ค้าง {totalStale} รายการ
            </div>
          ) : (
            <div className="flex items-center gap-1 text-green-600 font-medium text-sm border border-green-200 bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle2 className="h-4 w-4" />
              ไม่มีเอกสารค้าง
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* Sales Section */}
        <section>
          <h4 className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            ฝั่งรายการขาย
            <Badge variant="secondary" className="rounded-sm px-1.5">{data.sales.length}</Badge>
          </h4>
          <Card>
            <CardContent className="p-0">
              {data.sales.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  ไม่มีรายการขายที่ตกค้างเกิน 3 วัน
                </div>
              ) : (
                data.sales.map(doc => <DocumentRow key={doc.id} doc={doc} />)
              )}
            </CardContent>
          </Card>
        </section>

        {/* Purchases Section */}
        <section>
          <h4 className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            ฝั่งรายการซื้อ
            <Badge variant="secondary" className="rounded-sm px-1.5">{data.purchases.length}</Badge>
          </h4>
          <Card>
            <CardContent className="p-0">
              {data.purchases.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  ไม่มีใบขอซื้อ/สั่งซื้อที่ตกค้างเกิน 3 วัน
                </div>
              ) : (
                data.purchases.map(doc => <DocumentRow key={doc.id} doc={doc} />)
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
