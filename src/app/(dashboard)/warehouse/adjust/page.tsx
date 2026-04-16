'use client';

import { useState, useEffect, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Minus, LayoutGrid, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { quickSearchProduct, quickAdjustStock } from '@/actions/warehouse';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function MobileAdjustPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MobileAdjustContent />
    </Suspense>
  );
}

function MobileAdjustContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState<'ADD' | 'REMOVE' | 'SET'>('ADD');
  const [reason, setReason] = useState('COUNT_UPDATE');
  const [note, setNote] = useState('');

  const productId = searchParams.get('productId');

  useEffect(() => {
    if (productId) {
      loadProduct(productId);
    }
  }, [productId]);

  async function loadProduct(id: string) {
    // In a real app, I'd have a getProductById action, using quickSearch for now
    // By passing the ID as a "query", the service will find it if it's treated as SKU or I should add a specific action.
    // For now, I'll use the ID directly if the service supports it or add a quick helper.
    const res = await quickSearchProduct(productId!); 
    setProduct(res);
  }

  const handleAdjust = () => {
    if (!product) return;
    if (quantity <= 0 && type !== 'SET') {
      toast.error('กรุณาระบุจำนวนที่มากกว่า 0');
      return;
    }

    startTransition(async () => {
      try {
        const fullNote = `[Warehouse-Mobile] ${reason}: ${note}`;
        await quickAdjustStock(product.id, type, quantity, fullNote);
        toast.success('ปรับสต็อกสำเร็จ');
        router.push('/warehouse/lookup');
      } catch (err: any) {
        toast.error(err.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  if (!productId || !product) {
    return (
      <div className="max-w-md mx-auto p-10 text-center space-y-4">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
        <h2 className="text-xl font-bold">ไม่พบข้อมูลสินค้า</h2>
        <p className="text-sm text-muted-foreground">กรุณาเลือกสินค้าจากหน้าเช็คสต็อกก่อน</p>
        <Button asChild className="w-full">
          <Link href="/warehouse/lookup">ไปหน้าเช็คสต็อก</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/warehouse/lookup">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">ปรับปรุงสต็อก</h1>
      </div>

      <Card className="border-orange-500/20">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-lg shrink-0">
              <Package className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{product.name}</CardTitle>
              <CardDescription>
                สต็อกปัจจุบัน: <span className="font-bold text-foreground">{product.stock}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant={type === 'ADD' ? 'default' : 'outline'} 
              className={cn("h-12 flex-col gap-0", type === 'ADD' && "bg-green-600 hover:bg-green-700")}
              onClick={() => setType('ADD')}
            >
              <Plus className="h-4 w-4" />
              <span className="text-[10px]">เพิ่มเข้า</span>
            </Button>
            <Button 
              variant={type === 'REMOVE' ? 'default' : 'outline'} 
              className={cn("h-12 flex-col gap-0", type === 'REMOVE' && "bg-red-600 hover:bg-red-700")}
              onClick={() => setType('REMOVE')}
            >
              <Minus className="h-4 w-4" />
              <span className="text-[10px]">เบิกออก</span>
            </Button>
            <Button 
              variant={type === 'SET' ? 'default' : 'outline'} 
              className={cn("h-12 flex-col gap-0", type === 'SET' && "bg-blue-600 hover:bg-blue-700")}
              onClick={() => setType('SET')}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="text-[10px]">นับใหม่</span>
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">จำนวนที่ {type === 'ADD' ? 'เพิ่มร' : type === 'REMOVE' ? 'หักออก' : 'นับได้จริง'}</label>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-14 w-14 shrink-0"
                onClick={() => setQuantity(q => Math.max(0, q - 1))}
              >
                <Minus className="h-6 w-6" />
              </Button>
              <Input 
                type="number" 
                className="h-14 text-center text-3xl font-black"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              <Button 
                variant="outline" 
                size="icon" 
                className="h-14 w-14 shrink-0"
                onClick={() => setQuantity(q => q + 1)}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">เหตุผลการปรับปรุง</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COUNT_UPDATE">ตรวจนับสต็อก (Stock Count)</SelectItem>
                  <SelectItem value="DAMAGE">สินค้าเสียหาย (Damage)</SelectItem>
                  <SelectItem value="WASTE">หมดอายุ / สูญหาย (Waste)</SelectItem>
                  <SelectItem value="RETURN">รับคือจากลูกค้า (Customer Return)</SelectItem>
                  <SelectItem value="OTHER">อื่นๆ (โปรดระบุ)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">หมายเหตุเพิ่มเติม</label>
              <Input 
                placeholder="ระบุรายละเอียด..." 
                className="h-12"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold shadow-lg" 
            disabled={isPending}
            onClick={handleAdjust}
          >
            <Save className="h-5 w-5 mr-2" />
            {isPending ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
