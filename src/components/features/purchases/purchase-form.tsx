'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/ui/file-upload';
import { PAYMENT_METHODS } from '@/lib/constants';
import { createPurchase } from '@/actions/purchases';
import { getProductsForSelect } from '@/actions/products';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  costPrice: number;
  stock: number;
}

interface PurchaseItem {
  productId: string;
  product?: Product;
  quantity: number;
  costPrice: number;
}

export function PurchaseForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [items, setItems] = useState<PurchaseItem[]>([
    { productId: '', quantity: 1, costPrice: 0 },
  ]);

  useEffect(() => {
    getProductsForSelect().then((data) => {
      const mappedProducts = data.map((p: any) => ({
        ...p,
        costPrice: Number(p.costPrice),
      }));
      setProducts(mappedProducts);
    });
  }, []);

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, costPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseItem,
    value: string | number
  ) => {
    const newItems = [...items];
    
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value as string,
        product,
        costPrice: product?.costPrice || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.costPrice,
      0
    );
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      supplierName: (formData.get('supplierName') as string) || null,
      paymentMethod: formData.get('paymentMethod') as any,
      notes: (formData.get('notes') as string) || null,
      receiptUrl: receiptUrl,
      date: new Date(date).toISOString(),
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        costPrice: item.costPrice,
      })),
    };

    startTransition(async () => {
      const result = await createPurchase(data);

      if (result.error) {
        setErrors(result.error as Record<string, string[]>);
      } else {
        router.push('/purchases');
        router.refresh();
      }
    });
  }

  const total = calculateTotal();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors._form.join(', ')}
        </div>
      )}

      {/* Supplier Info & Date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลการซื้อ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">วันที่และเวลา (ย้อนหลังได้)</Label>
            <Input
              id="date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplierName">ชื่อผู้จัดจำหน่าย</Label>
              <Input
                id="supplierName"
                name="supplierName"
                placeholder="ไม่ระบุ = ไม่ทราบ"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">วิธีชำระเงิน *</Label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">เลือกวิธีชำระเงิน</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              {errors.paymentMethod && (
                <p className="text-sm text-destructive">{errors.paymentMethod[0]}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">หมายเหตุ</Label>
            <textarea
              id="notes"
              name="notes"
              placeholder="บันทึกเพิ่มเติม"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>หลักฐานการซื้อ</Label>
            <FileUpload
              value={receiptUrl || undefined}
              onChange={(url) => setReceiptUrl(url)}
              folder="purchases"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">รายการสินค้า</CardTitle>
            <Button type="button" size="sm" onClick={handleAddItem}>
              <Plus className="mr-1 h-4 w-4" />
              เพิ่มรายการ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row"
            >
              <div className="flex-1 space-y-2">
                <Label>สินค้า *</Label>
                <select
                  value={item.productId}
                  onChange={(e) =>
                    handleItemChange(index, 'productId', e.target.value)
                  }
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">เลือกสินค้า</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku && `(${product.sku})`} - สต็อก:{' '}
                      {product.stock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-24 space-y-2">
                <Label>จำนวน *</Label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) =>
                    handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)
                  }
                  required
                />
              </div>

              <div className="w-full sm:w-32 space-y-2">
                <Label>ต้นทุน/หน่วย *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.costPrice}
                  onChange={(e) =>
                    handleItemChange(index, 'costPrice', parseFloat(e.target.value) || 0)
                  }
                  required
                />
              </div>

              <div className="flex items-end">
                <div className="space-y-2">
                  <Label>รวม</Label>
                  <div className="text-sm font-medium">
                    {formatCurrency((item.quantity * item.costPrice).toString())}
                  </div>
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(index)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {errors.items && (
            <p className="text-sm text-destructive">{errors.items[0]}</p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-lg font-bold">
            <span>ยอดรวมทั้งหมด</span>
            <span>{formatCurrency(total.toString())}</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || items.some((item) => !item.productId)}>
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการซื้อ'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
