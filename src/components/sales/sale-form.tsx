'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useForm, FormProvider, useFormContext, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { FileUpload } from '@/components/ui/file-upload';
import { CustomerCombobox } from '@/components/sales/customers/customer-combobox';
import { SaleScannerButton, type SaleScanResult } from './sale-scanner-button';
import { Plus, Trash2, ScanBarcode, Tag, Percent } from 'lucide-react';

import { createSale } from '@/actions/sales/sales.actions';
import { getProductsForSelect } from '@/actions/inventory/products.actions';
import { getCustomersForSelect } from '@/actions/sales/customers.actions';
import { getMyProfile } from '@/actions/core/auth.actions';
import { formatCurrency } from '@/lib/formatters';
import { PAYMENT_METHODS } from '@/lib/constants';
import { usePermissions } from '@/hooks/use-permissions';
import { saleFormSchema, getSaleFormDefaults, type SaleFormValues } from '@/schemas/sales/sale-form.schema';

// ============================================================================
// Section: Sales Info
// ============================================================================

function SalesInfoSection({
  customers,
  aiFilled
}: {
  customers: any[],
  aiFilled: Set<string>
}) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<SaleFormValues>();
  const isBackdated = watch('isBackdated');
  const selectedCustomerId = watch('customerId');
  const isNewCustomer = watch('isNewCustomer');
  const showAddress = watch('showAddress');
  const paymentMethod = watch('paymentMethod');

  const aiFieldClass = (field: string, base: string) =>
    aiFilled.has(field) ? `${base} ring-2 ring-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20` : base;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ข้อมูลการขาย</CardTitle>
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
            <Label>ชื่อลูกค้า (ถ้ามี)</Label>
            <CustomerCombobox
              customers={customers}
              value={selectedCustomerId || undefined}
              onValueChange={(value, isNew) => {
                setValue('customerId', isNew ? null : value);
                setValue('customerName', isNew ? value : null);
                setValue('isNewCustomer', isNew);

                if (value && !isNew) {
                  const customer = customers.find(c => c.id === value);
                  if (customer?.address) {
                    setValue('customerAddress', customer.address);
                    setValue('showAddress', true);
                  }
                }
              }}
              placeholder="เลือกหรือพิมพ์ชื่อลูกค้า..."
            />
            {selectedCustomerId && (
              <div className="space-y-2">
                {isNewCustomer && <p className="text-xs text-muted-foreground">จะสร้างลูกค้าใหม่: {watch('customerName')}</p>}
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="showAddress" {...register('showAddress')} className="h-4 w-4 rounded border-gray-300" />
                  <Label htmlFor="showAddress" className="font-normal cursor-pointer text-sm">ระบุที่อยู่</Label>
                </div>
                {showAddress && (
                  <textarea {...register('customerAddress')} placeholder="ที่อยู่ลูกค้า..." rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2" />
                )}
              </div>
            )}
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
          <textarea {...register('notes')} placeholder="บันทึกเพิ่มเติม (ถ้ามี)" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </FormField>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Sales Items
// ============================================================================

function SalesItemsSection({
  products,
  onScanResult
}: {
  products: any[],
  onScanResult: (res: SaleScanResult) => void
}) {
  const { control, register, watch, setValue } = useFormContext<SaleFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [scanInput, setScanInput] = useState('');

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const sku = scanInput.trim();
      if (!sku) return;

      const product = products.find((p) => p.sku?.toLowerCase() === sku.toLowerCase());
      if (product) {
        const currentItems = watch('items');
        const existingIndex = currentItems.findIndex((item) => item.productId === product.id);

        if (existingIndex >= 0) {
          setValue(`items.${existingIndex}.quantity`, Number(currentItems[existingIndex].quantity) + 1);
        } else {
          if (currentItems.length === 1 && !currentItems[0].productId) {
            setValue('items.0', { productId: product.id, quantity: 1, salePrice: product.salePrice, discountAmount: 0 });
          } else {
            append({ productId: product.id, quantity: 1, salePrice: product.salePrice, discountAmount: 0 });
          }
        }
        setScanInput('');
      } else {
        toast.error('ไม่พบสินค้า SKU: ' + sku);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">รายการสินค้า</CardTitle>
          <div className="flex items-center gap-2">
            <SaleScannerButton onScanResult={onScanResult} variant="outline" size="sm" className="border-purple-200 text-purple-700" />
            <Button type="button" size="sm" onClick={() => append({ productId: '', quantity: 1, salePrice: 0, discountAmount: 0 })}>
              <Plus className="mr-1 h-4 w-4" /> เพิ่มรายการ
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border border-dashed">
          <ScanBarcode className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <Input placeholder="สแกนบาร์โค้ด หรือพิมพ์ SKU แล้วกด Enter..." value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={handleScan} className="bg-background" autoFocus />
          </div>
        </div>

        {fields.map((field, index) => {
          const selectedProductId = watch(`items.${index}.productId`);
          const product = products.find(p => p.id === selectedProductId);
          const quantity = watch(`items.${index}.quantity`);
          const salePrice = watch(`items.${index}.salePrice`);
          const discountAmount = watch(`items.${index}.discountAmount`);
          const lineTotal = (Number(quantity) || 0) * ((Number(salePrice) || 0) - (Number(discountAmount) || 0));

          const isStockInsufficient = product ? (Number(quantity) || 0) > (product.stock - (product.reservedStock || 0)) : false;

          return (
            <div key={field.id} className={cn(
              "grid grid-cols-1 md:grid-cols-12 gap-4 rounded-lg border p-4 items-start transition-colors",
              isStockInsufficient ? "border-red-200 bg-red-50/30" : "bg-card"
            )}>
              <div className="md:col-span-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>สินค้า *</Label>
                  {product && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      isStockInsufficient ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {isStockInsufficient ? 'สต็อกไม่พอ' : 'มีสินค้า'}
                    </span>
                  )}
                </div>
                <select
                  {...register(`items.${index}.productId` as const)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  onChange={(e) => {
                    const p = products.find(x => x.id === e.target.value);
                    setValue(`items.${index}.productId`, e.target.value);
                    if (p) setValue(`items.${index}.salePrice`, p.salePrice);
                  }}
                >
                  <option value="">เลือกสินค้า</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku && `(${p.sku})`} - ว่าง: {p.stock - (p.reservedStock || 0)}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>จำนวน *</Label>
                <Input
                  type="number"
                  {...register(`items.${index}.quantity` as const)}
                  min="1"
                  className={cn(isStockInsufficient && "border-red-500 focus-visible:ring-red-500")}
                />
                {isStockInsufficient && product && (
                  <p className="text-[10px] text-red-600 font-bold animate-pulse">สั่งซื้อได้สูงสุด: {product.stock - (product.reservedStock || 0)}</p>
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>ราคา/หน่วย *</Label>
                <Input type="number" step="0.01" {...register(`items.${index}.salePrice` as const)} min="0" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="flex items-center gap-1"><Tag className="h-3 w-3" /> ส่วนลด</Label>
                <Input type="number" step="0.01" {...register(`items.${index}.discountAmount` as const)} min="0" />
              </div>
              <div className="md:col-span-1 space-y-2">
                <Label>รวม</Label>
                <div className="text-sm font-medium h-9 flex items-center">{formatCurrency(lineTotal.toString())}</div>
              </div>
              <div className="md:col-span-1 flex items-end justify-end pt-6 md:pt-0">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => remove(index)} disabled={fields.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main: SaleForm
// ============================================================================

export function SaleForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = usePermissions();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());

  const methods = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: getSaleFormDefaults(),
  });

  const { handleSubmit, setValue, watch, control } = methods;

  useEffect(() => {
    Promise.all([getProductsForSelect(), getCustomersForSelect(), getMyProfile()]).then(([psRes, csRes]) => {
      if (psRes.success && psRes.data) {
        setProducts(psRes.data.map((p: any) => ({ ...p, salePrice: Number(p.salePrice), costPrice: Number(p.costPrice) })));
      }
      if (csRes.success && csRes.data) {
        setCustomers(csRes.data);
      }
    });
  }, []);

  const items = watch('items');
  const showDiscount = watch('showDiscount');
  const discountType = watch('discountType');
  const discountValue = watch('discountValue');

  // Calculate Summary
  let totalAmount = 0;
  let totalCost = 0;
  items.forEach((item) => {
    const p = products.find(x => x.id === item.productId);
    const quantity = Number(item.quantity) || 0;
    totalAmount += quantity * ((Number(item.salePrice) || 0) - (Number(item.discountAmount) || 0));
    totalCost += quantity * (p?.costPrice || 0);
  });

  let billDiscountAmount = 0;
  const dv = Number(discountValue) || 0;
  if (showDiscount && dv > 0) {
    billDiscountAmount = discountType === 'PERCENT' ? (totalAmount * dv / 100) : dv;
  }
  if (billDiscountAmount > totalAmount) billDiscountAmount = totalAmount;
  const netAmount = totalAmount - billDiscountAmount;
  const profit = netAmount - totalCost;

  const handleScanResult = (result: SaleScanResult) => {
    const filled = new Set<string>();
    if (result.date) {
      setValue('isBackdated', true);
      setValue('date', result.time ? `${result.date}T${result.time}` : `${result.date}T00:00`);
      filled.add('date');
    }
    if (result.senderName) {
      setValue('customerName', result.senderName);
      setValue('isNewCustomer', true);
      filled.add('customer');
    }
    if (result.paymentMethod || result.sourceType === 'payment_slip') {
      setValue('paymentMethod', result.paymentMethod || 'TRANSFER');
      filled.add('paymentMethod');
    }
    if (result.items && result.items.length > 0) {
      const scannedItems = result.items.map(si => {
        const p = products.find(prod => prod.sku?.toLowerCase() === si.sku?.toLowerCase() || prod.name.toLowerCase().includes(si.name.toLowerCase()));
        return {
          productId: p?.id || '',
          quantity: si.quantity,
          salePrice: si.unitPrice || p?.salePrice || 0,
          discountAmount: 0
        };
      });
      setValue('items', scannedItems as any);
      filled.add('items');
    }
    setAiFilled(filled);
  };

  const onSubmit = (data: SaleFormValues) => {
    const payload = {
      ...data,
      customerId: !data.isNewCustomer ? data.customerId : null,
      customerName: data.isNewCustomer ? (data.customerId || data.customerName) : null,
      paymentMethod: data.paymentMethod as any, // Cast to match enum
      date: data.isBackdated ? new Date(data.date!).toISOString() : undefined,
      discountType: (data.showDiscount && (Number(data.discountValue) || 0) > 0) ? (data.discountType as any) : null,
      discountValue: data.showDiscount ? (Number(data.discountValue) || 0) : null,
    };

    // --- Stock Validation (Task 0.3) ---
    const insufficientItems = data.items.filter(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (!p) return false;
      const available = p.stock - (p.reservedStock || 0);
      return (Number(item.quantity) || 0) > available;
    });

    if (insufficientItems.length > 0) {
      toast.error('ไม่สามารถบันทึกได้เนื่องจากสินค้าบางรายการมีสต็อกไม่พอ');
      return;
    }
    // ---------------------------------

    startTransition(async () => {
      const result = await createSale(payload);
      if (result.success) {
        toast.success('บันทึกการขายสำเร็จ');
        router.push('/sales');
        router.refresh();
      } else {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            methods.setError(field as any, { message: (messages as string[])[0] });
          });
        }
      }
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {methods.formState.errors.root && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{methods.formState.errors.root.message}</div>
        )}

        <SalesInfoSection customers={customers} aiFilled={aiFilled} />
        <SalesItemsSection products={products} onScanResult={handleScanResult} />

        <Card>
          <CardHeader><CardTitle className="text-base">หลักฐานการชำระเงิน</CardTitle></CardHeader>
          <CardContent>
            <FileUpload value={watch('receiptUrl') || undefined} onChange={(url) => setValue('receiptUrl', url)} folder="receipts" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">ยอดรวมสินค้า</span><span className="font-medium">{formatCurrency(totalAmount.toString())}</span></div>
            <div className="space-y-2">
              <button type="button" onClick={() => setValue('showDiscount', !showDiscount)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Tag className="h-3.5 w-3.5" /> {showDiscount ? 'ซ่อนส่วนลดบิล' : '▸ เพิ่มส่วนลดบิล'}
              </button>
              {showDiscount && (
                <div className="animate-in fade-in slide-in-from-top-2 flex items-center gap-2 rounded-lg border border-dashed p-3 bg-muted/30">
                  <select {...methods.register('discountType')} className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="FIXED">฿ บาท</option>
                    <option value="PERCENT">% เปอร์เซ็นต์</option>
                  </select>
                  <Input type="number" step="0.01" {...methods.register('discountValue')} placeholder="ราคาหรือเปอรเซ็นต์" className="flex-1" />
                  {discountType === 'PERCENT' && <Percent className="h-4 w-4 text-muted-foreground" />}
                </div>
              )}
            </div>
            {billDiscountAmount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>ส่วนลดบิล {discountType === 'PERCENT' ? `(${discountValue}%)` : ''}</span>
                <span>-{formatCurrency(billDiscountAmount.toString())}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2"><span className="font-semibold">ยอดสุทธิ</span><span className="text-lg font-bold">{formatCurrency(netAmount.toString())}</span></div>
            {hasPermission('SALE_VIEW_PROFIT') && (
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground"><span>ต้นทุน</span><span>{formatCurrency(totalCost.toString())}</span></div>
                <div className="flex justify-between text-sm"><span className="font-medium">กำไร</span><span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(profit.toString())}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending || items.some(i => !i.productId)}>{isPending ? 'กำลังบันทึก...' : 'บันทึกการขาย'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button>
        </div>
      </form>
    </FormProvider>
  );
}
