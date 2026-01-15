'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createProduct, updateProduct } from '@/actions/products';
import { StockAdjustmentDialog } from '@/components/features/products/stock-adjustment-dialog';

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface ProductFormProps {
  product?: Product;
  categories: Category[];
}

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const isEdit = !!product;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      sku: (formData.get('sku') as string) || null,
      category: formData.get('category') as string,
      costPrice: parseFloat(formData.get('costPrice') as string) || 0,
      salePrice: parseFloat(formData.get('salePrice') as string) || 0,
      stock: isEdit ? undefined : (parseInt(formData.get('stock') as string) || 0),
      minStock: parseInt(formData.get('minStock') as string) || 5,
      images: [] as string[],
    };
    
    // Remove undefined keys
    if (isEdit) {
        delete (data as any).stock;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateProduct(product.id, data)
        : await createProduct(data as any);

      if (result.error) {
        setErrors(result.error as Record<string, string[]>);
      } else {
        router.push('/products');
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors._form && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors._form.join(', ')}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">ชื่อสินค้า *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={product?.name}
                placeholder="เช่น มอเตอร์ไซค์ไฟฟ้า รุ่น X"
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">รหัสสินค้า (SKU)</Label>
              <Input
                id="sku"
                name="sku"
                defaultValue={product?.sku || ''}
                placeholder="เช่น EBIKE-001"
              />
              {errors.sku && (
                <p className="text-sm text-destructive">{errors.sku[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">หมวดหมู่ *</Label>
              <select
                id="category"
                name="category"
                defaultValue={product?.category || ''}
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">เลือกหมวดหมู่</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="costPrice">ราคาทุน (บาท) *</Label>
              <Input
                id="costPrice"
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product?.costPrice.toString() || ''}
                placeholder="0.00"
                required
              />
              {errors.costPrice && (
                <p className="text-sm text-destructive">{errors.costPrice[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salePrice">ราคาขาย (บาท) *</Label>
              <Input
                id="salePrice"
                name="salePrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product?.salePrice.toString() || ''}
                placeholder="0.00"
                required
              />
              {errors.salePrice && (
                <p className="text-sm text-destructive">{errors.salePrice[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">จำนวนในสต็อก *</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min="0"
                required
                disabled={isEdit}
                className={isEdit ? 'bg-muted' : ''}
              />
              {isEdit && (
                <div className="mt-2">
                  <StockAdjustmentDialog 
                    productId={product.id} 
                    currentStock={product.stock}
                  />
                </div>
              )}
              {errors.stock && (
                <p className="text-sm text-destructive">{errors.stock[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="minStock">สต็อกขั้นต่ำ (แจ้งเตือน)</Label>
              <Input
                id="minStock"
                name="minStock"
                type="number"
                min="0"
                defaultValue={product?.minStock || 5}
                placeholder="5"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">รายละเอียด</Label>
              <textarea
                id="description"
                name="description"
                defaultValue={product?.description || ''}
                placeholder="รายละเอียดสินค้า (ไม่บังคับ)"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              ยกเลิก
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
