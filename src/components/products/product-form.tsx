'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { StockAdjustmentDialog } from '@/components/products/stock-adjustment-dialog';
import { ProductImageUpload } from '@/components/ui/product-image-upload';
import { SafeBoundary } from '@/components/ui/safe-boundary';
import { usePermissions } from '@/hooks/use-permissions';
import { VERSION_CONFLICT_ERROR } from '@/lib/optimistic-lock';

import { createProduct, updateProduct } from '@/actions/products';
import { productFormSchema, getProductFormDefaults } from '@/schemas/product-form';
import type { ProductFormValues } from '@/schemas/product-form';
import type { SerializedProduct } from '@/services';

// ============================================================================
// Types
// ============================================================================

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface ProductFormProps {
  product?: SerializedProduct;
  categories: Category[];
}

// ============================================================================
// Section: Product Identity (Name, SKU, Category, Description)
// ============================================================================

function ProductIdentitySection({ categories }: { categories: Category[] }) {
  const { register } = useFormContext<ProductFormValues>();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="name" label="ชื่อสินค้า" required className="sm:col-span-2">
          <Input
            id="name"
            {...register('name')}
            placeholder="ระบุชื่อสินค้า"
            maxLength={200}
          />
        </FormField>

        <FormField name="sku" label="รหัสสินค้า (SKU)" hint="เช่น ITEM-001">
          <Input
            id="sku"
            {...register('sku')}
            placeholder="เช่น ITEM-001"
            maxLength={50}
          />
        </FormField>

        <FormField name="category" label="หมวดหมู่" required>
          <select
            id="category"
            {...register('category')}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-2 focus:ring-primary"
          >
            <option value="">เลือกหมวดหมู่</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField name="description" label="รายละเอียด">
        <textarea
          id="description"
          {...register('description')}
          placeholder="รายละเอียดสินค้า (ไม่บังคับ)"
          rows={4}
          maxLength={1000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
        />
      </FormField>
    </div>
  );
}

// ============================================================================
// Section: Pricing & Stock
// ============================================================================

function PricingStockSection({ isEdit, product }: { isEdit: boolean; product?: SerializedProduct }) {
  const { register } = useFormContext<ProductFormValues>();
  const { hasPermission } = usePermissions();

  return (
    <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-muted/30 border">
      {hasPermission('PRODUCT_VIEW_COST') && (
        <FormField name="costPrice" label="ราคาทุน (บาท)" required>
          <Input
            id="costPrice"
            type="number"
            step="0.01"
            min="0"
            max={999999999}
            {...register('costPrice', { valueAsNumber: true })}
          />
        </FormField>
      )}

      <FormField name="salePrice" label="ราคาขาย (บาท)" required>
        <Input
          id="salePrice"
          type="number"
          step="0.01"
          min="0"
          max={999999999}
          {...register('salePrice', { valueAsNumber: true })}
        />
      </FormField>

      <FormField name="stock" label="จำนวนในสต็อก" required>
        <Input
          id="stock"
          type="number"
          min="0"
          {...register('stock', { valueAsNumber: true })}
          disabled={isEdit}
        />
        {isEdit && product && (
          <StockAdjustmentDialog productId={product.id} currentStock={product.stock} />
        )}
      </FormField>

      <FormField name="minStock" label="จุดแจ้งเตือน (Min Stock)">
        <Input
          id="minStock"
          type="number"
          min="0"
          {...register('minStock', { valueAsNumber: true })}
        />
      </FormField>
    </div>
  );
}

// ============================================================================
// Section: ERP & Procurement Settings
// ============================================================================

function ErpSettingsSection() {
  const { register, watch, setValue } = useFormContext<ProductFormValues>();
  const isActive = watch('isActive');
  const isSaleable = watch('isSaleable');

  return (
    <div className="space-y-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
      <h3 className="font-semibold text-primary flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary" />
        ERP & Procurement Settings
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField name="moq" label="ยอดสั่งซื้อขั้นต่ำ (MOQ)">
          <Input
            id="moq"
            type="number"
            min="0"
            {...register('moq', { valueAsNumber: true })}
            placeholder="ระบุ MOQ ถ้ามี"
          />
        </FormField>

        <FormField
          name="packagingQty"
          label="จำนวนต่อแพ็ก/กล่อง"
          hint="1 = ไม่มีการแพ็กพิเศษ"
        >
          <Input
            id="packagingQty"
            type="number"
            min="1"
            {...register('packagingQty', { valueAsNumber: true })}
          />
        </FormField>

        <div className="flex flex-col gap-3 justify-center">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setValue('isActive', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isActive" className="cursor-pointer">เปิดใช้งานสินค้า (Active)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isSaleable"
              checked={isSaleable}
              onChange={(e) => setValue('isSaleable', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isSaleable" className="cursor-pointer">พร้อมขาย (Saleable)</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Section: Logistics & Dimensions
// ============================================================================

function LogisticsSection() {
  const { register } = useFormContext<ProductFormValues>();

  return (
    <div className="space-y-4 p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
      <h3 className="font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
        Logistics & Dimensions
      </h3>
      <div className="grid gap-4">
        <FormField name="metadata.weight" label="น้ำหนัก (kg)">
          <Input
            id="metadata.weight"
            type="number"
            step="0.01"
            min="0"
            {...register('metadata.weight', { valueAsNumber: true })}
            placeholder="0.00"
          />
        </FormField>
        <div className="grid grid-cols-3 gap-2">
          <FormField name="metadata.width" label="กว้าง (cm)">
            <Input
              id="metadata.width"
              type="number"
              step="0.1"
              min="0"
              {...register('metadata.width', { valueAsNumber: true })}
            />
          </FormField>
          <FormField name="metadata.height" label="สูง (cm)">
            <Input
              id="metadata.height"
              type="number"
              step="0.1"
              min="0"
              {...register('metadata.height', { valueAsNumber: true })}
            />
          </FormField>
          <FormField name="metadata.length" label="ยาว (cm)">
            <Input
              id="metadata.length"
              type="number"
              step="0.1"
              min="0"
              {...register('metadata.length', { valueAsNumber: true })}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main: ProductForm
// ============================================================================

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!product;

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getProductFormDefaults(product),
  });

  const { handleSubmit, setError, watch, setValue } = methods;
  const images = watch('images');

  function onSubmit(data: ProductFormValues) {
    // Map form values to the shape the Server Action expects
    const payload = {
      ...data,
      // Coerce optional empties to null for backend schema
      description: data.description || null,
      sku: data.sku || null,
      moq: data.moq || null,
      // Strip stock from update payload — stock is managed via StockAdjustmentDialog
      ...(isEdit ? { stock: undefined } : {}),
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateProduct(product.id, {
          ...payload,
          version: (product as any).version,
        })
        : await createProduct(payload as any);

      if (!result.success) {
        // Handle version conflict (optimistic locking)
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
              onClick: () => router.refresh(),
            },
            duration: 10000,
          });
          return;
        }

        // Map server errors back to form fields
        if (result.errors && typeof result.errors === 'object') {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (field === '_form') {
              setError('root', { message: (messages as string[]).join(', ') });
            } else {
              setError(field as any, { message: (messages as string[])[0] });
            }
          });
        } else if (result.message) {
          setError('root', { message: result.message });
        }
      } else {
        toast.success(isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มสินค้าสำเร็จ');
        router.push('/products');
        router.refresh();
      }
    });
  }

  return (
    <FormProvider {...methods}>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Form-level errors */}
            {methods.formState.errors.root && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {methods.formState.errors.root.message}
              </div>
            )}

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Left Column: Main Content */}
              <div className="lg:col-span-2 space-y-6">
                <ProductIdentitySection categories={categories} />
                <PricingStockSection isEdit={isEdit} product={product} />
                <SafeBoundary variant="compact" componentName="ErpSettings">
                  <ErpSettingsSection />
                </SafeBoundary>
              </div>

              {/* Right Column: Media & Logistics */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>รูปภาพสินค้า</Label>
                  <ProductImageUpload
                    value={images}
                    onChange={(imgs) => setValue('images', imgs)}
                    maxImages={5}
                    disabled={isPending}
                  />
                </div>
                <SafeBoundary variant="compact" componentName="Logistics">
                  <LogisticsSection />
                </SafeBoundary>
              </div>
            </div>

            {/* Sticky Action Bar (mobile-friendly) */}
            <div className="flex gap-2 pt-6 border-t sticky bottom-0 bg-card pb-2">
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
    </FormProvider>
  );
}
