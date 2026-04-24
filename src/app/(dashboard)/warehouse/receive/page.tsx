'use client';

import { useState, useEffect, useTransition } from 'react';
import { ArrowLeft, Download, Truck, Package, ChevronRight, CheckCircle2, ShoppingBag, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPendingDeliveries, confirmReceipt } from '@/actions/inventory/warehouse.actions';
import { toast } from 'sonner';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

export default function MobileReceivePage() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadDeliveries();
  }, []);

  async function loadDeliveries() {
    setLoading(true);
    try {
      const data = await getPendingDeliveries();
      setDeliveries(data);
    } finally {
      setLoading(false);
    }
  }

  const handleConfirm = async (id: string) => {
    startTransition(async () => {
      try {
        await confirmReceipt(id);
        toast.success('รับสินค้าเข้าคลังเรียบร้อยแล้ว');
        setSelectedPO(null);
        await loadDeliveries();
      } catch (err: any) {
        toast.error(err.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  if (selectedPO) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedPO(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">ยืนยันรายการรับของ</h1>
        </div>

        <Card className="border-green-600/20 shadow-lg">
          <CardHeader className="bg-green-50/50 border-b pb-4">
            <div className="flex justify-between items-start">
              <div>
                <Badge variant="outline" className="mb-1 text-green-700 border-green-200">{selectedPO.purchaseNumber}</Badge>
                <CardTitle className="text-lg">{selectedPO.supplier?.name}</CardTitle>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  <span>สั่งซื้อเมื่อ {formatDistanceToNow(new Date(selectedPO.date), { addSuffix: true, locale: th })}</span>
                </div>
              </div>
              <Truck className="h-8 w-8 text-green-600 opacity-40" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">รายการสินค้า ({selectedPO.items.length})</p>
              <div className="space-y-3">
                {selectedPO.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate pr-4">{item.product?.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.product?.sku || 'No SKU'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black">{item.quantity}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">จำนวนรวม</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-muted/10 border-t space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  การกดรับสินค้าจะเพิ่มจำนวนในคลังทันที และคำนวณต้นทุนเฉลี่ย (Weighted Average Cost) ให้อัตโนมัติ
                </p>
              </div>
              <Button 
                className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg" 
                disabled={isPending}
                onClick={() => handleConfirm(selectedPO.id)}
              >
                <Download className="h-5 w-5 mr-2" />
                {isPending ? 'กำลังบันทึก...' : 'บันทึกรับของทั้งหมด'}
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setSelectedPO(null)}>
                ยกเลิก
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/warehouse">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">รับสินค้าเข้า</h1>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 w-full bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed rounded-3xl text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto opacity-20 mb-3" />
            <p className="font-medium">ไม่มีรายการสั่งซื้อที่รอรับของ</p>
            <p className="text-xs mt-1">รายการจะปรากฏที่นี่เมื่อมีการกด &quot;สั่งซื้อสินค้า&quot; (PO Ordered)</p>
          </div>
        ) : (
          deliveries.map((po) => (
            <Card 
              key={po.id} 
              className="hover:border-primary/40 cursor-pointer transition-all active:scale-[0.98]"
              onClick={() => setSelectedPO(po)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">{po.purchaseNumber}</span>
                    <Badge variant="outline" className="text-[10px] py-0">{po.purchaseType}</Badge>
                  </div>
                  <h3 className="font-bold truncate">{po.supplier?.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                    <span className="flex items-center gap-0.5">
                      <Package className="h-3 w-3" />
                      {po.items.length} รายการ
                    </span>
                    <span>สั่งเมื่อ {formatDistanceToNow(new Date(po.date), { locale: th })}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
