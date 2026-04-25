'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, FormProvider, useFormContext, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, RotateCcw, Plus, Minus, Trash2 } from 'lucide-react';

import { getReturnableSaleItems, createReturn } from '@/actions/sales/returns.actions';
import { getSales } from '@/actions/sales/sales.actions';
import { formatCurrency } from '@/lib/formatters';
import { returnFormSchema, getReturnFormDefaults, type ReturnFormValues } from '@/schemas/sales/return-form.schema';

// ============================================================================
// Section: Sale Selection
// ============================================================================

function SaleSelectionSection({
  onSaleSelected,
  selectedInvoice
}: {
  onSaleSelected: (id: string, inv: string) => void,
  selectedInvoice: string
}) {
  const { watch, setValue } = useFormContext<ReturnFormValues>();
  const [saleSearch, setSaleSearch] = useState('');
  const [saleResults, setSaleResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const selectedSaleId = watch('saleId');

  const handleSearch = async () => {
    if (!saleSearch.trim()) return;
    setIsSearching(true);
    try {
      const resp = await getSales({ page: 1, limit: 10, search: saleSearch.trim() });
      if (resp.success) {
        setSaleResults(resp.data.filter((s: any) => s.status !== 'CANCELLED'));
      } else {
        toast.error(resp.message);
      }
    } finally {
      setIsSearching(false);
    }
  };

  if (selectedSaleId) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">1. เลือกบิลขาย</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">บิล: {selectedInvoice || selectedSaleId}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setValue('saleId', ''); onSaleSelected('', ''); }}>เปลี่ยนบิล</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">1. เลือกบิลขาย</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="ค้นหาด้วยเลขบิล หรือชื่อลูกค้า..." value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <Button onClick={handleSearch} disabled={isSearching}><Search className="h-4 w-4 mr-1" /> ค้นหา</Button>
        </div>
        {saleResults.length > 0 && (
          <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
            {saleResults.map((sale) => (
              <button key={sale.id} className="w-full text-left px-4 py-3 hover:bg-muted" onClick={() => onSaleSelected(sale.id, sale.invoiceNumber)}>
                <div className="flex justify-between"><span className="font-medium">{sale.invoiceNumber}</span><span>{formatCurrency(sale.netAmount || sale.totalAmount)}</span></div>
                <p className="text-sm text-muted-foreground">{sale.customerName || sale.customer?.name || 'ลูกค้าทั่วไป'}</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Return Items
// ============================================================================

function ReturnItemsSection() {
  const { control, register, watch, setValue } = useFormContext<ReturnFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [returnablePool, setReturnablePool] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const saleId = watch('saleId');

  useEffect(() => {
    if (saleId) {
      setIsLoading(true);
      getReturnableSaleItems(saleId)
        .then(res => {
          if (res.success) {
            setReturnablePool(res.data || []);
          } else {
            toast.error(res.message);
            setReturnablePool([]);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setReturnablePool([]);
    }
  }, [saleId]);

  if (!saleId) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">2. เลือกสินค้าที่จะคืน</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <p className="text-muted-foreground">กำลังโหลด...</p> : (
          <>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">สินค้าที่คืนได้</Label>
              <div className="border rounded-lg divide-y">
                {returnablePool.filter(p => !fields.find(f => f.saleItemId === p.saleItemId)).map(item => (
                  <div key={item.saleItemId} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">คืนได้: {item.maxReturnable} ชิ้น | ราคา: {formatCurrency(item.netPerUnit)}/ชิ้น</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => append({ saleItemId: item.saleItemId, productId: item.productId, productName: item.productName, quantity: 1, refundPerUnit: item.netPerUnit, maxReturnable: item.maxReturnable })}>
                      <Plus className="h-3 w-3 mr-1" /> เลือก
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {fields.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">สินค้าที่จะคืน ({fields.length})</Label>
                <div className="border rounded-lg divide-y">
                  {fields.map((field, index) => {
                    const qty = watch(`items.${index}.quantity`);
                    const refund = watch(`items.${index}.refundPerUnit`);
                    return (
                      <div key={field.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{field.productName}</p>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">จำนวน</Label>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setValue(`items.${index}.quantity`, Math.max(1, qty - 1))} disabled={qty <= 1}><Minus className="h-3 w-3" /></Button>
                            <Input type="number" {...register(`items.${index}.quantity` as const)} className="w-16 h-7 text-center text-sm" />
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setValue(`items.${index}.quantity`, Math.min(fields[index].maxReturnable, qty + 1))} disabled={qty >= fields[index].maxReturnable}><Plus className="h-3 w-3" /></Button>
                            <span className="text-xs text-muted-foreground">/ {fields[index].maxReturnable}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">คืน/ชิ้น</Label>
                            <Input type="number" step="0.01" {...register(`items.${index}.refundPerUnit` as const)} className="w-24 h-7 text-sm" />
                          </div>
                          <Badge variant="secondary" className="text-xs">= {formatCurrency((qty * refund).toString())}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main: ReturnForm
// ============================================================================

export function ReturnForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedInvoice, setSelectedInvoice] = useState('');

  const methods = useForm<ReturnFormValues>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: getReturnFormDefaults(searchParams.get('saleId') || ''),
  });

  const { handleSubmit, watch, setValue, formState: { errors } } = methods;
  const items = watch('items');
  const totalRefund = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.refundPerUnit) || 0), 0);

  const onSubmit = (data: ReturnFormValues) => {
    startTransition(async () => {
      await runActionWithToast(createReturn({
        ...data,
        refundMethod: data.refundMethod as any,
      } as any), {
        successMessage: 'บันทึกการคืนสินค้าสำเร็จ',
        onSuccess: () => {
          setTimeout(() => {
            router.push('/returns');
            router.refresh();
          }, 100);
        },
        onError: (result) => {
          mapActionErrorsToForm(methods, result.errors);
          if (result.message && !result.errors) {
            methods.setError('root', { message: result.message });
          }
        }
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild><Link href="/returns"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold tracking-tight">คืนสินค้า</h1>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {errors.root && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errors.root.message}</div>}

          <SaleSelectionSection onSaleSelected={(id, inv) => { setValue('saleId', id); setSelectedInvoice(inv); setValue('items', []); }} selectedInvoice={selectedInvoice} />

          <ReturnItemsSection />

          {items.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">3. รายละเอียดการคืน</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField name="reason" label="เหตุผลการคืน" required>
                  <Textarea {...methods.register('reason')} placeholder="ระบุเหตุผลการคืนสินค้า..." rows={3} />
                </FormField>

                <FormField name="refundMethod" label="วิธีคืนเงิน" required>
                  <Select value={watch('refundMethod')} onValueChange={v => setValue('refundMethod', v as any)}>
                    <SelectTrigger><SelectValue placeholder="เลือกวิธีคืนเงิน" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">เงินสด</SelectItem>
                      <SelectItem value="TRANSFER">เงินโอน</SelectItem>
                      <SelectItem value="CREDIT">เครดิต (หักยอดครั้งหน้า)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">จำนวนสินค้าที่คืน</span><span>{items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)} ชิ้น</span></div>
                  <div className="flex justify-between border-t pt-2"><span className="font-semibold">ยอดคืนเงินทั้งหมด</span><span className="font-bold text-lg text-green-600">{formatCurrency(totalRefund.toString())}</span></div>
                </div>

                <Button type="submit" disabled={isPending} className="w-full" size="lg">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {isPending ? 'กำลังดำเนินการ...' : `ยืนยันคืนสินค้า (${formatCurrency(totalRefund.toString())})`}
                </Button>
              </CardContent>
            </Card>
          )}
        </form>
      </FormProvider>
    </div>
  );
}
