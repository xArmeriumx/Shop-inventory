'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useForm, FormProvider, useFormContext, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { cn } from '@/lib/utils';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';

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
import { getShop } from '@/actions/core/shop.actions';
import { getWarehousesAction } from '@/actions/inventory/warehouse.actions';
import { getQuotationDetail } from '@/actions/sales/quotations.actions';
import { formatCurrency } from '@/lib/formatters';
import { PAYMENT_METHODS } from '@/lib/constants';
import { usePermissions } from '@/hooks/use-permissions';
import { saleFormSchema, getSaleFormDefaults, computeSaleTotals, type SaleFormValues } from '@/schemas/sales/sale-form.schema';

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

          <FormField name="taxMode" label="รูปแบบภาษี (VAT Mode)">
            <select
              {...register('taxMode')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-bold"
            >
              <option value="INCLUSIVE">ราคารวม VAT แล้ว (Inclusive)</option>
              <option value="EXCLUSIVE">ราคาแยก VAT ต่างหาก (Exclusive)</option>
              <option value="NO_VAT">ไม่มีภาษีมูลค่าเพิ่ม (No VAT)</option>
            </select>
          </FormField>

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
  warehouses,
  inventoryMode,
  onScanResult
}: {
  products: any[],
  warehouses: any[],
  inventoryMode: string,
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
        // Just log or handle silently, standard runActionWithToast is for Server Actions
        console.error('ไม่พบสินค้า SKU: ' + sku);
      }
    }
  };

  // SINGLE mode: auto-preselect the first active warehouse for all items
  const fieldsLength = fields.length;
  useEffect(() => {
    if (inventoryMode === 'SINGLE' && warehouses.length > 0) {
      const defaultWh = warehouses.find(w => w.isActive) ?? warehouses[0];
      fields.forEach((_, idx) => {
        const current = watch(`items.${idx}.warehouseId`);
        if (!current) setValue(`items.${idx}.warehouseId`, defaultWh.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryMode, warehouses, fieldsLength]);

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
          const selectedWarehouseId = watch(`items.${index}.warehouseId`);
          const product = products.find(p => p.id === selectedProductId);
          const quantity = watch(`items.${index}.quantity`);
          const salePrice = watch(`items.${index}.salePrice`);
          const discountAmount = watch(`items.${index}.discountAmount`);
          const lineTotal = (Number(quantity) || 0) * ((Number(salePrice) || 0) - (Number(discountAmount) || 0));

          // SSOT: Calculate availability based on SELECTED warehouse if in MULTI mode
          let availableStock = 0;
          if (product) {
            if (inventoryMode === 'MULTI_WAREHOUSE' && selectedWarehouseId) {
              const whStock = product.warehouseStocks?.find((ws: any) => ws.warehouseId === selectedWarehouseId);
              availableStock = whStock ? Number(whStock.quantity) : 0;
            } else {
              availableStock = product.stock - (product.reservedStock || 0);
            }
          }

          const isStockInsufficient = product ? (Number(quantity) || 0) > availableStock : false;

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
                    if (p) {
                      setValue(`items.${index}.salePrice`, p.salePrice);

                      // Auto-assignment (Phase 7.5): Pick warehouse with most stock
                      if (inventoryMode === 'MULTI' && p.warehouseStocks?.length > 0) {
                        const bestWh = [...p.warehouseStocks].sort((a, b) => Number(b.quantity) - Number(a.quantity))[0];
                        if (bestWh && bestWh.quantity > 0) {
                          setValue(`items.${index}.warehouseId`, bestWh.warehouseId);
                        }
                      }
                    }
                  }}
                >
                  <option value="">เลือกสินค้า</option>
                  {products.map((p) => {
                    // คงเหลือในคลัง: show per-warehouse stock when in MULTI and warehouse is selected
                    const selectedWhId = watch(`items.${index}.warehouseId`);
                    let stockDisplay = p.stock - (p.reservedStock || 0);
                    if ((inventoryMode === 'MULTI' || inventoryMode === 'SINGLE') && selectedWhId) {
                      const ws = p.warehouseStocks?.find((s: any) => s.warehouseId === selectedWhId);
                      stockDisplay = ws ? Number(ws.quantity) : 0;
                    }
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku && `(${p.sku})`} - คงเหลือในคลัง: {stockDisplay}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* MULTI: user selects per item | SINGLE: preselect + read-only */}
              {(inventoryMode === 'MULTI' || inventoryMode === 'SINGLE') && (
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>คลังสินค้า {inventoryMode === 'MULTI' ? '*' : ''}</Label>
                    {inventoryMode === 'MULTI' && product && (
                      <button
                        type="button"
                        title="แนะนำคลังที่มีของมากที่สุด"
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => {
                          const bestWh = [...product.warehouseStocks].sort((a, b) => Number(b.quantity) - Number(a.quantity))[0];
                          if (bestWh) setValue(`items.${index}.warehouseId`, bestWh.warehouseId);
                        }}
                      >
                        Auto-pick
                      </button>
                    )}
                  </div>
                  <select
                    {...register(`items.${index}.warehouseId` as const)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium"
                    disabled={inventoryMode === 'SINGLE'}
                    required={inventoryMode === 'MULTI'}
                  >
                    <option value="">เลือกคลัง...</option>
                    {warehouses.filter(w => w.isActive).map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={cn(
                (inventoryMode === 'MULTI' || inventoryMode === 'SINGLE') ? "md:col-span-1" : "md:col-span-2",
                "space-y-2"
              )}>
                <Label>จำนวน *</Label>
                <Input
                  type="number"
                  {...register(`items.${index}.quantity` as const)}
                  min="1"
                  className={cn(isStockInsufficient && "border-red-500 focus-visible:ring-red-500")}
                />
                {isStockInsufficient && product && (
                  <p className="text-[10px] text-red-600 font-bold animate-pulse">คงเหลือในคลังนี้: {availableStock}</p>
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
  const searchParams = useSearchParams();
  const quotationId = searchParams.get('quotationId');

  const [isPending, startTransition] = useTransition();
  const { hasPermission } = usePermissions();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [inventoryMode, setInventoryMode] = useState<string>('SIMPLE');
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());

  const methods = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: getSaleFormDefaults(),
  });

  const { handleSubmit, setValue, watch, control } = methods;

  useEffect(() => {
    Promise.all([
      getProductsForSelect(),
      getCustomersForSelect(),
      getMyProfile(),
      getShop(),
      getWarehousesAction()
    ]).then(([psRes, csRes, profRes, shopRes, whRes]) => {
      if (psRes.success && psRes.data) {
        setProducts(psRes.data.map((p: any) => ({ ...p, salePrice: Number(p.salePrice), costPrice: Number(p.costPrice) })));
      }
      if (csRes.success && csRes.data) {
        setCustomers(csRes.data);
      }
      if (shopRes.success && shopRes.data) {
        setInventoryMode(shopRes.data.inventoryMode || 'SIMPLE');
      }
      if (whRes.success && whRes.data) {
        setWarehouses(whRes.data);
      }
    });
  }, []);

  // Pre-fill from quotation
  useEffect(() => {
    if (quotationId && products.length > 0 && customers.length > 0) {
      getQuotationDetail(quotationId).then((res) => {
        if (res.success && res.data) {
          const q = res.data;

          // 1. Set Customer
          if (q.customerId) {
            setValue('customerId', q.customerId);
            setValue('customerName', q.customer?.name || null);
            if (q.customer?.address) {
              setValue('customerAddress', q.customer.address);
              setValue('showAddress', true);
            }
          }

          // 2. Set Items
          if (q.items && q.items.length > 0) {
            const saleItems = q.items.map((qi: any) => ({
              productId: qi.productId,
              quantity: Number(qi.quantity),
              salePrice: Number(qi.unitPrice),
              discountAmount: Number(qi.discount) || 0
            }));
            setValue('items', saleItems);
          }

          // Silent success for data retrieval pre-fill
        }
      });
    }
  }, [quotationId, products.length, customers.length, setValue]);

  const items = watch('items');
  const showDiscount = watch('showDiscount');
  const discountType = watch('discountType');
  const discountValue = watch('discountValue');

  const allValues = watch();
  const calculation = computeSaleTotals(allValues, products);
  const { totals } = calculation;

  const totalAmount = totals.subtotalAmount;
  const billDiscountAmount = totals.billDiscountAmount;
  const netAmount = totals.netAmount;
  const totalCost = totals.totalCost;
  const profit = totals.totalProfit;

  // --- Stock Validation (Task 0.3): Reactive calculation for UI ---
  const stockShortageItems = items.filter(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (!p) return false;

    let available = 0;
    if (inventoryMode === 'MULTI' && item.warehouseId) {
      const whStock = p.warehouseStocks?.find((ws: any) => ws.warehouseId === item.warehouseId);
      available = whStock ? Number(whStock.quantity) : 0;
    } else {
      available = p.stock - (p.reservedStock || 0);
    }

    return (Number(item.quantity) || 0) > available;
  });

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

    startTransition(async () => {
      await runActionWithToast(createSale(payload), {
        successMessage: 'บันทึกใบสั่งขายสำเร็จ',
        onSuccess: () => {
          // Fix Race Condition: Small delay before navigation to let Toast render
          setTimeout(() => {
            router.push('/sales');
            router.refresh();
          }, 100);
        },
        onError: (result) => {
          if (result.errors) {
            mapActionErrorsToForm(methods, result.errors);
          }
        }
      });
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {methods.formState.errors.root && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{methods.formState.errors.root.message}</div>
        )}

        <SalesInfoSection customers={customers} aiFilled={aiFilled} />
        <SalesItemsSection
          products={products}
          warehouses={warehouses}
          inventoryMode={inventoryMode}
          onScanResult={handleScanResult}
        />

        <Card>
          <CardHeader><CardTitle className="text-base">หลักฐานการชำระเงิน</CardTitle></CardHeader>
          <CardContent>
            <FileUpload value={watch('receiptUrl') || undefined} onChange={(url) => setValue('receiptUrl', url)} folder="receipts" />
          </CardContent>
        </Card>

        <Card className="border-primary/20 shadow-md">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><Plus className="h-3 w-3" /> ยอดรวมสินค้า (ก่อนหักส่วนลดบิล)</span>
              <span className="font-mono font-bold">{formatCurrency(totalAmount.toString())}</span>
            </div>

            <div className="space-y-2">
              <button type="button" onClick={() => setValue('showDiscount', !showDiscount)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
                <Tag className="h-3 w-3" /> {showDiscount ? 'ยกเลิกส่วนลดท้ายบิล' : '▸ เพิ่มส่วนลดท้ายบิล'}
              </button>

              {showDiscount && (
                <div className="animate-in slide-in-from-top-2 flex items-center gap-2 rounded-xl border border-dashed p-3 bg-primary/5">
                  <select {...methods.register('discountType')} className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-sm font-bold">
                    <option value="FIXED">฿ บาท</option>
                    <option value="PERCENT">% เปอร์เซ็นต์</option>
                  </select>
                  <Input type="number" step="0.01" {...methods.register('discountValue')} placeholder="ระบุจำนวนเงินหรือ %" className="flex-1 font-bold" />
                  {discountType === 'PERCENT' && <Percent className="h-4 w-4 text-primary" />}
                </div>
              )}
            </div>

            {billDiscountAmount > 0 && (
              <div className="flex justify-between text-sm text-orange-600 font-bold border-t border-dashed pt-2">
                <span>ส่วนลดท้ายบิล {discountType === 'PERCENT' ? `(${discountValue}%)` : ''}</span>
                <span>-{formatCurrency(billDiscountAmount.toString())}</span>
              </div>
            )}

            <div className="pt-2 border-t border-dashed space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ฐานภาษี (Taxable Base)</span>
                <span className="font-mono">{formatCurrency(totals.taxableBaseAmount.toString())}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ภาษีมูลค่าเพิ่ม (VAT {allValues.taxRate}%) - {allValues.taxMode === 'INCLUSIVE' ? 'รวมในราคาแล้ว' : allValues.taxMode === 'EXCLUSIVE' ? 'แยกนอก' : 'ไม่มี'}</span>
                <span className="font-mono">{formatCurrency(totals.taxAmount.toString())}</span>
              </div>
            </div>

            <div className="flex justify-between border-t pt-3 items-baseline">
              <span className="font-bold text-sm uppercase tracking-tighter opacity-70">ยอดรวมสุทธิ (Net Total)</span>
              <span className="text-3xl font-black tracking-tighter text-primary font-mono">{formatCurrency(netAmount.toString())}</span>
            </div>

            {hasPermission('SALE_VIEW_PROFIT') && (
              <div className="mt-4 p-3 rounded-2xl bg-muted/40 space-y-1.5 border border-border/50">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <span>ต้นทุนรวม (Total Cost)</span>
                  <span className="font-mono">{formatCurrency(totalCost.toString())}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border/50 border-dashed">
                  <span className="text-xs font-black uppercase tracking-tighter">กำไรขั้นต้น (GP)</span>
                  <span className={cn(
                    "text-lg font-black font-mono tracking-tight",
                    profit >= 0 ? "text-emerald-600" : "text-destructive"
                  )}>
                    {formatCurrency(profit.toString())}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={
              isPending ||
              items.some(i => !i.productId) ||
              (inventoryMode === 'MULTI' && items.some(i => !i.warehouseId)) ||
              stockShortageItems.length > 0
            }
          >
            {isPending ? 'กำลังบันทึก...' : 'บันทึกการขาย'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button>
        </div>
      </form>
    </FormProvider>
  );
}
