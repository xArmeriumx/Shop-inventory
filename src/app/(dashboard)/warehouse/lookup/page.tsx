'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Barcode, ArrowLeft, Package, Warehouse, AlertTriangle, ExternalLink, QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { quickSearchProduct } from '@/actions/warehouse';
import { formatCurrency } from '@/lib/formatters';
import Link from 'next/link';

export default function MobileLookup() {
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus for barcode scanners on mount
    inputRef.current?.focus();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await quickSearchProduct(query);
      setProduct(result);
      if (result) {
        setQuery(''); // Clear for next scan
      }
    } finally {
      setLoading(false);
      // Keep focus for next scan
      inputRef.current?.focus();
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/warehouse">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">เช็คสต็อก</h1>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            ref={inputRef}
            placeholder="ยิง Barcode หรือระบุ SKU..." 
            className="pl-9 h-12 text-lg shadow-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button disabled={loading} className="h-12 w-12 shrink-0">
          <Search className="h-5 w-5" />
        </Button>
      </form>

      {product ? (
        <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <Badge variant="outline" className="mb-1">{product.sku || 'No SKU'}</Badge>
                <CardTitle className="text-xl">{product.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{product.category}</p>
              </div>
              <div className="bg-primary/10 p-2 rounded-lg">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x border-y">
              <div className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">คงเหลือจริง (On-hand)</p>
                <p className="text-3xl font-black text-blue-600">{product.stock}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">จองแล้ว (Reserved)</p>
                <p className="text-3xl font-black text-amber-600">{product.reservedStock || 0}</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <span className="font-bold text-green-800">ที่สั่งขายได้ (Available)</span>
                </div>
                <span className="text-2xl font-black text-green-700">
                  {product.stock - (product.reservedStock || 0)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase">ราคาขาย</p>
                  <p className="font-bold">{formatCurrency(product.salePrice)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase">หน่วย (Pack/CTN)</p>
                  <p className="font-bold">{product.metadata?.packagingQty || 1} ชิ้น/ลัง</p>
                </div>
              </div>

              {product.isLowStock && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-100 animate-pulse">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-xs font-bold">สินค้าเหลือน้อยกว่าจุดสั่งซื้อ ({product.minStock})</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/warehouse/adjust?productId=${product.id}`}>
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    ปรับสต็อก
                  </Link>
                </Button>
                {product.isLowStock && (
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href={`/purchases/new?productId=${product.id}&quantity=${product.minStock * 2}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      เปิดใบขอซื้อ
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : query && !loading ? (
        <div className="text-center p-12 border-2 border-dashed rounded-2xl text-muted-foreground">
          <Search className="h-10 w-10 mx-auto opacity-20 mb-2" />
          <p>ไม่พบสินค้าที่ค้นหา</p>
        </div>
      ) : (
        <div className="text-center p-12 text-muted-foreground opacity-40">
          <Barcode className="h-20 w-20 mx-auto mb-4" />
          <p>พร้อมยิง Barcode</p>
        </div>
      )}
    </div>
  );
}

// Re-using LayoutGrid for icon in adjust link
function LayoutGrid(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}
