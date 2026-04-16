'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SerializedProduct } from '@/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createProduct, updateProduct } from '@/actions/products';
import { StockAdjustmentDialog } from '@/components/features/products/stock-adjustment-dialog';
import { ProductImageUpload } from '@/components/ui/product-image-upload';
import { usePermissions } from '@/hooks/use-permissions';
import { VERSION_CONFLICT_ERROR } from '@/lib/optimistic-lock';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface ProductFormProps {
  product?: SerializedProduct;
  categories: Category[];
}

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [isActive, setIsActive] = useState<boolean>(product?.isActive ?? true);
  const [isSaleable, setIsSaleable] = useState<boolean>(product?.isSaleable ?? true);
  const { hasPermission } = usePermissions();

  const isEdit = !!product;
  const metadata = (product?.metadata as Record<string, any>) || {};

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
      moq: formData.get('moq') ? parseInt(formData.get('moq') as string) : null,
      packagingQty: parseInt(formData.get('packagingQty') as string) || 1,
      isActive,
      isSaleable,
      images: images,
      metadata: {
        weight: parseFloat(formData.get('weight') as string) || 0,
        width: parseFloat(formData.get('width') as string) || 0,
        height: parseFloat(formData.get('height') as string) || 0,
        length: parseFloat(formData.get('length') as string) || 0,
      }
    };
    
    // Remove undefined keys
    if (isEdit) {
        delete (data as any).stock;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateProduct(product.id, { 
            ...data, 
            version: (product as any).version 
          })
        : await createProduct(data as any);

      if (!result.success) {
        // Check for version conflict (optimistic locking)
        const errors = result.errors;
        const hasVersionConflict = 
          errors && 
          typeof errors === 'object' && 
          '_form' in errors && 
          Array.isArray(errors._form) && 
          errors._form.includes(VERSION_CONFLICT_ERROR);
        
        if (hasVersionConflict) {
          toast.error('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น', {
            description: 'กรุณารีเฟรชเพื่อดูข้อมูลล่าสุด',
            action: {
              label: 'รีเฟรช',
              onClick: () => {
                router.refresh();
              },
            },
            duration: 10000,
          });
          return;
        }
        
        if (result.errors) {
          setErrors(result.errors as Record<string, string[]>);
        } else if (result.message) {
          setErrors({ _form: [result.message] });
        }
      } else {
        toast.success(isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มสินค้าสำเร็จ');
        router.push('/products');
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {errors._form && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors._form.join(', ')}
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column: Basic Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">ชื่อสินค้า *</Label>
                    <Input id="name" name="name" defaultValue={product?.name} placeholder="ระบุชื่อสินค้า" required />
                    {errors.name && <p className="text-sm text-destructive">{errors.name[0]}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sku">รหัสสินค้า (SKU)</Label>
                    <Input id="sku" name="sku" defaultValue={product?.sku || ''} placeholder="SKU-001" />
                    {errors.sku && <p className="text-sm text-destructive">{errors.sku[0]}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">หมวดหมู่ *</Label>
                    <select
                      id="category"
                      name="category"
                      defaultValue={product?.category || ''}
                      required
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-2 focus:ring-primary"
                    >
                      <option value="">เลือกหมวดหมู่</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    {errors.category && <p className="text-sm text-destructive">{errors.category[0]}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">รายละเอียด</Label>
                  <textarea
                    id="description"
                    name="description"
                    defaultValue={product?.description || ''}
                    placeholder="รายละเอียดสินค้า (ไม่บังคับ)"
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Pricing & Stock Section */}
              <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-muted/30 border">
                {hasPermission('PRODUCT_VIEW_COST') && (
                  <div className="space-y-2">
                    <Label htmlFor="costPrice">ราคาทุน (บาท) *</Label>
                    <Input id="costPrice" name="costPrice" type="number" step="0.01" min="0" defaultValue={product?.costPrice} required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="salePrice">ราคาขาย (บาท) *</Label>
                  <Input id="salePrice" name="salePrice" type="number" step="0.01" min="0" defaultValue={product?.salePrice} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">จำนวนในสต็อก *</Label>
                  <Input id="stock" name="stock" defaultValue={product?.stock || 0} disabled={isEdit} required />
                  {isEdit && <StockAdjustmentDialog productId={product.id} currentStock={product.stock} />}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">จุดแจ้งเตือน (Min Stock)</Label>
                  <Input id="minStock" name="minStock" type="number" min="0" defaultValue={product?.minStock || 5} />
                </div>
              </div>

              {/* ERP Section */}
              <div className="space-y-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  ERP & Procurement Settings
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="moq">ยอดสั่งซื้อขั้นต่ำ (MOQ)</Label>
                    <Input id="moq" name="moq" type="number" min="0" defaultValue={product?.moq || ''} placeholder="ระบุ MOQ ถ้ามี" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="packagingQty" className="flex items-center gap-2">
                      จำนวนต่อแพ็ก/กล่อง
                      <span className="text-[10px] text-muted-foreground font-normal">(1 = ไม่มีการแพ็กพิเศษ)</span>
                    </Label>
                    <Input id="packagingQty" name="packagingQty" type="number" min="1" defaultValue={product?.packagingQty || 1} required />
                  </div>
                  <div className="flex flex-col gap-3 justify-center">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="isActive" 
                        checked={isActive} 
                        onChange={(e) => setIsActive(e.target.checked)} 
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="isActive" className="cursor-pointer">เปิดใช้งานสินค้า (Active)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="isSaleable" 
                        checked={isSaleable} 
                        onChange={(e) => setIsSaleable(e.target.checked)} 
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="isSaleable" className="cursor-pointer">พร้อมขาย (Saleable)</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Media & Logistics */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>รูปภาพสินค้า</Label>
                <ProductImageUpload value={images} onChange={setImages} maxImages={5} disabled={isPending} />
              </div>

              <div className="space-y-4 p-4 rounded-lg bg-orange-50/50 border border-orange-100">
                <h3 className="font-semibold text-orange-700 flex items-center gap-2">
                   Logistics & Dimensions
                </h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">น้ำหนัก (kg)</Label>
                    <Input id="weight" name="weight" type="number" step="0.01" defaultValue={metadata.weight || ''} placeholder="0.00" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="width" className="text-xs">กว้าง (cm)</Label>
                      <Input id="width" name="width" type="number" step="0.1" defaultValue={metadata.width || ''} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="height" className="text-xs">สูง (cm)</Label>
                      <Input id="height" name="height" type="number" step="0.1" defaultValue={metadata.height || ''} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="length" className="text-xs">ยาว (cm)</Label>
                      <Input id="length" name="length" type="number" step="0.1" defaultValue={metadata.length || ''} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-6 border-t">
            <Button type="submit" disabled={isPending} className="px-8">
              {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              ยกเลิก
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
