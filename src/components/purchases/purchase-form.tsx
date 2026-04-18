'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useForm, FormProvider, useFormContext, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { FileUpload } from '@/components/ui/file-upload';
import { SupplierCombobox } from '@/components/suppliers/supplier-combobox';
import { ScanPurchaseButton } from '@/components/purchases/scan-purchase-button';
import { QuickAddSupplierDialog } from '@/components/suppliers/quick-add-supplier-dialog';
import { QuickAddProductDialog } from '@/components/products/quick-add-product-dialog';
import { ScanReviewModal } from '@/components/ocr/scan-review-modal';
import { Plus, Trash2 } from 'lucide-react';

import { createPurchase } from '@/actions/purchases';
import { getProductsForPurchase } from '@/actions/products';
import { getSuppliersForSelect } from '@/actions/suppliers';
import { formatCurrency } from '@/lib/formatters';
import { PAYMENT_METHODS } from '@/lib/constants';
import { loadPendingScanResult } from './use-purchase-scanner';
import { purchaseFormSchema, getPurchaseFormDefaults, type PurchaseFormValues } from '@/schemas/purchase-form';

// ============================================================================
// Section: Purchase Info
// ============================================================================

function PurchaseInfoSection({
  supplierRefreshKey,
  onSupplierCreated,
  pendingScanData,
  aiFilled
}: {
  supplierRefreshKey: number,
  onSupplierCreated: (s: any) => void,
  pendingScanData: any,
  aiFilled: Set<string>
}) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<PurchaseFormValues>();
  const isBackdated = watch('isBackdated');
  const supplierId = watch('supplierId');
  const paymentMethod = watch('paymentMethod');

  const aiFieldClass = (field: string, base: string) =>
    aiFilled.has(field) ? `${base} ring-2 ring-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20` : base;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">ข้อมูลการซื้อ</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="isBackdated" {...register('isBackdated')} className="h-4 w-4 rounded border-gray-300" />
            <Label htmlFor="isBackdated" className="font-normal cursor-pointer">บันทึกย้อนหลัง (ระบุวันที่เอง)</Label>
          </div>
          {isBackdated && (
            <div className="animate-in fade-in slide-in-from-top-2 pt-2">
              <Input type="datetime-local" {...register('date')} max={format(new Date(), "yyyy-MM-dd'T'HH:mm")} />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="supplierId">ผู้จำหน่าย</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <SupplierCombobox
                  key={supplierRefreshKey}
                  value={supplierId}
                  onChange={(val) => setValue('supplierId', val, { shouldValidate: true })}
                  error={!!errors.supplierId}
                />
              </div>
              <QuickAddSupplierDialog defaultName={pendingScanData?.vendor || ''} onCreated={onSupplierCreated} />
            </div>
            {errors.supplierId && <p className="text-sm text-destructive">{errors.supplierId.message}</p>}
          </div>

          <FormField name="paymentMethod" label="วิธีชำระเงิน" required>
            <select
              {...register('paymentMethod')}
              className={aiFieldClass('paymentMethod', 'w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm')}
            >
              <option value="">เลือกวิธีชำระเงิน</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField name="notes" label="หมายเหตุ">
          <textarea id="notes" {...register('notes')} placeholder="บันทึกเพิ่มเติม" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </FormField>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Purchase Items
// ============================================================================

function PurchaseItemsSection({
  products,
  onProductCreated,
  pendingScanData
}: {
  products: any[],
  onProductCreated: (p: any, idx: number) => void,
  pendingScanData: any
}) {
  const { control, register, watch, setValue } = useFormContext<PurchaseFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">รายการสินค้า</CardTitle>
          <Button type="button" size="sm" onClick={() => append({ productId: '', quantity: 1, costPrice: 0 })}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่มรายการ
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => {
          const productId = watch(`items.${index}.productId`);
          const quantity = watch(`items.${index}.quantity`);
          const costPrice = watch(`items.${index}.costPrice`);
          const lineTotal = (Number(quantity) || 0) * (Number(costPrice) || 0);

          return (
            <div key={field.id} className="rounded-lg border p-4 space-y-3">
              {/* Row 1: Product selector (full-width on mobile, fills available space) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:items-start">
                {/* Product — col 1-5 */}
                <div className="md:col-span-5 space-y-1.5">
                  <Label>สินค้า *</Label>
                  <select
                    {...register(`items.${index}.productId` as const)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    onChange={(e) => {
                      const p = products.find(x => x.id === e.target.value);
                      setValue(`items.${index}.productId`, e.target.value);
                      if (p) setValue(`items.${index}.costPrice`, p.costPrice);
                    }}
                  >
                    <option value="">เลือกสินค้า</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} {p.sku && `(${p.sku})`} - สต็อก: {p.stock}</option>
                    ))}
                  </select>
                  {/* Quick-add sits below the dropdown — never overlaps adjacent columns */}
                  {!productId && (
                    <QuickAddProductDialog
                      defaultData={{
                        name: pendingScanData?.items?.[index]?.name || '',
                        sku: pendingScanData?.items?.[index]?.code || '',
                        costPrice: Number(costPrice) || pendingScanData?.items?.[index]?.unitPrice || 0,
                      }}
                      onCreated={(p) => onProductCreated(p, index)}
                    />
                  )}
                </div>

                {/* Qty — col 6-7 */}
                <div className="md:col-span-2 space-y-1.5">
                  <Label>จำนวน *</Label>
                  <Input type="number" {...register(`items.${index}.quantity` as const)} min="1" />
                </div>

                {/* Cost — col 8-10 */}
                <div className="md:col-span-3 space-y-1.5">
                  <Label>ต้นทุน/หน่วย *</Label>
                  <Input type="number" step="0.01" {...register(`items.${index}.costPrice` as const)} min="0" />
                </div>

                {/* Total — col 11 */}
                <div className="md:col-span-1 space-y-1.5">
                  <Label>รวม</Label>
                  <div className="text-sm font-medium h-9 flex items-center">
                    {formatCurrency(lineTotal.toString())}
                  </div>
                </div>

                {/* Delete — col 12 */}
                <div className="md:col-span-1 flex md:items-end md:justify-end md:pt-7">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );

        })}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main: PurchaseForm
// ============================================================================

export function PurchaseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierRefreshKey, setSupplierRefreshKey] = useState(0);
  const [pendingScanData, setPendingScanData] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());

  const methods = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: getPurchaseFormDefaults(),
  });

  const { handleSubmit, setValue, watch, control } = methods;

  const refreshProducts = useCallback(async () => {
    const data = await getProductsForPurchase();
    setProducts(data.map((p: any) => ({ ...p, costPrice: Number(p.costPrice) })));
  }, []);

  const populateFromScanResult = useCallback(async (result: any) => {
    await refreshProducts();
    if (result.supplierId) {
      setValue('supplierId', result.supplierId);
      setSupplierRefreshKey(k => k + 1);
    }
    if (result.date) {
      setValue('isBackdated', true);
      setValue('date', result.date + 'T00:00');
    }
    if (result.paymentStatus === 'paid' || result.sourceType === 'payment_slip') {
      setValue('paymentMethod', 'TRANSFER');
      setAiFilled(prev => new Set(prev).add('paymentMethod'));
    }
    if (result.items && result.items.length > 0) {
      const items = result.items.map((it: any) => {
        const p = products.find(x => x.id === it.productId);
        return {
          productId: it.productId,
          quantity: it.quantity || 1,
          costPrice: it.costPrice || p?.costPrice || 0,
        };
      });
      setValue('items', items);
    }
    toast.success('นำเข้าข้อมูลสำเร็จ!');
  }, [refreshProducts, setValue, products]);

  useEffect(() => {
    refreshProducts();
    getSuppliersForSelect().then(data => setSuppliers(data));

    const fromScan = searchParams.get('fromScan');
    if (fromScan === 'true') {
      const pendingResult = loadPendingScanResult();
      if (pendingResult) setTimeout(() => populateFromScanResult(pendingResult), 500);
      router.replace('/purchases/new', { scroll: false });
    }
  }, [searchParams, router, populateFromScanResult, refreshProducts]);

  const items = watch('items');
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0), 0);

  const onSubmit = (data: PurchaseFormValues) => {
    const payload = {
      ...data,
      paymentMethod: data.paymentMethod as any, // Cast to match enum
      date: data.isBackdated ? new Date(data.date!).toISOString() : undefined,
    };
    startTransition(async () => {
      const result = await createPurchase(payload);
      if (result.success) {
        toast.success('บันทึกการซื้อสำเร็จ');
        router.push('/purchases');
        router.refresh();
      } else if (result.errors) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          methods.setError(field as any, { message: (messages as string[])[0] });
        });
      }
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {methods.formState.errors.root && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{methods.formState.errors.root.message}</div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 p-4 rounded-lg border">
          <h2 className="font-semibold">สร้างรายการซื้อใหม่</h2>
          <ScanPurchaseButton onScanComplete={(data) => { setPendingScanData(data); setShowReviewModal(true); }} />
        </div>

        <PurchaseInfoSection
          supplierRefreshKey={supplierRefreshKey}
          onSupplierCreated={(s) => { setValue('supplierId', s.id); setSupplierRefreshKey(k => k + 1); }}
          pendingScanData={pendingScanData}
          aiFilled={aiFilled}
        />

        <PurchaseItemsSection
          products={products}
          onProductCreated={async (p, idx) => {
            await refreshProducts();
            setValue(`items.${idx}.productId`, p.id);
            setValue(`items.${idx}.costPrice`, p.costPrice);
          }}
          pendingScanData={pendingScanData}
        />

        <Card>
          <CardHeader><CardTitle className="text-base">หลักฐานการซื้อ</CardTitle></CardHeader>
          <CardContent><FileUpload value={watch('receiptUrl') || undefined} onChange={(url) => setValue('receiptUrl', url)} folder="purchases" /></CardContent>
        </Card>

        <Card><CardContent className="pt-6 flex justify-between text-lg font-bold"><span>ยอดรวมทั้งหมด</span><span>{formatCurrency(total.toString())}</span></CardContent></Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending || items.some(i => !i.productId)}>{isPending ? 'กำลังบันทึก...' : 'บันทึกการซื้อ'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button>
        </div>

        <ScanReviewModal
          open={showReviewModal}
          onOpenChange={setShowReviewModal}
          scanData={pendingScanData}
          products={products}
          suppliers={suppliers}
          onConfirm={populateFromScanResult}
        />
      </form>
    </FormProvider>
  );
}
