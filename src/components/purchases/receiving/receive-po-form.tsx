'use client';

import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { purchaseReceiptSchema, type PurchaseReceiptInput } from '@/schemas/purchases/purchase-receipt-form';
import { createPurchaseReceipt } from '@/actions/purchases/purchase-receipt.actions';
import { runActionWithToast } from '@/lib/mutation-utils';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Truck, Package, Save, ArrowLeft, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReceivePOFormProps {
  purchase: any;
  warehouses: any[];
}

export function ReceivePOForm({ purchase, warehouses }: ReceivePOFormProps) {
  const router = useRouter();
  const defaultWarehouseId = warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || '';

  const form = useForm<PurchaseReceiptInput>({
    resolver: zodResolver(purchaseReceiptSchema),
    defaultValues: {
      purchaseId: purchase.id,
      receivedDate: new Date(),
      notes: '',
      lineItems: purchase.items
        .filter((item: any) => item.quantity > item.receivedQuantity)
        .map((item: any) => ({
          purchaseItemId: item.id,
          productId: item.productId,
          receivedQuantity: item.quantity - item.receivedQuantity,
          warehouseId: defaultWarehouseId,
        })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'lineItems',
  });

  const onSubmit = async (data: PurchaseReceiptInput) => {
    // Filter out items with 0 received quantity if any
    const filteredData = {
      ...data,
      lineItems: data.lineItems.filter(item => item.receivedQuantity > 0)
    };

    if (filteredData.lineItems.length === 0) {
      alert('กรุณากรอกจำนวนที่รับอย่างน้อย 1 รายการ');
      return;
    }

    await runActionWithToast(
      createPurchaseReceipt(filteredData),
      {
        loadingMessage: 'กำลังบันทึกการรับสินค้า...',
        successMessage: 'บันทึกการรับสินค้าเรียบร้อยแล้ว',
        onSuccess: () => router.push('/purchases/receiving'),
      }
    );
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">
        
        {/* Header Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-primary/10 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/30">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <Truck className="w-6 h-6 text-primary" />
                    รายละเอียดการรับสินค้า
                  </CardTitle>
                  <CardDescription className="mt-1">
                    จากผู้จำหน่าย: <span className="font-semibold text-foreground">{purchase.supplier?.name || purchase.supplierName}</span>
                  </CardDescription>
                </div>
                <Badge variant="outline" className="px-3 py-1 bg-background">
                  {purchase.purchaseNumber}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField name="receivedDate" label="วันที่รับสินค้า">
                  <Input 
                    type="date" 
                    {...form.register('receivedDate', {
                      setValueAs: (v) => new Date(v)
                    })}
                    defaultValue={form.getValues('receivedDate') instanceof Date ? form.getValues('receivedDate').toISOString().split('T')[0] : ''}
                  />
                </FormField>
              </div>
              <FormField name="notes" label="บันทึกเพิ่มเติม">
                <Textarea placeholder="เช่น หมายเลขใบส่งของของผู้จำหน่าย หรือสภาพสินค้า" {...form.register('notes')} />
              </FormField>
            </CardContent>
          </Card>

          <Card className="border-primary/10 shadow-lg bg-primary/5 dark:bg-primary/10 flex flex-col justify-center items-center p-6 text-center">
            <div className="bg-primary/20 p-4 rounded-full mb-4">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <h4 className="text-lg font-bold">สถานะใบสั่งซื้อ</h4>
            <p className="text-sm text-muted-foreground mb-4">
              รายการสินค้าทั้งหมด {purchase.items.length} รายการ
            </p>
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs">
                <span>ความคืบหน้าการรับ</span>
                <span>{Math.round((purchase.items.filter((i:any) => i.receivedQuantity >= i.quantity).length / purchase.items.length) * 100)}%</span>
              </div>
              <Progress value={(purchase.items.filter((i:any) => i.receivedQuantity >= i.quantity).length / purchase.items.length) * 100} className="h-2" />
            </div>
          </Card>
        </div>

        {/* Line Items Table */}
        <Card className="shadow-xl border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>รายการสินค้าที่ต้องรับ</CardTitle>
            <CardDescription>กรอกจำนวนสินค้าที่ได้รับจริงและเลือกคลังสินค้าที่ต้องการเก็บ</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">สินค้า</th>
                    <th className="px-4 py-3 text-center font-semibold w-32">จำนวนสั่ง</th>
                    <th className="px-4 py-3 text-center font-semibold w-32">รับแล้ว</th>
                    <th className="px-4 py-3 text-center font-semibold w-32">ค้างส่ง</th>
                    <th className="px-4 py-3 text-center font-semibold w-40">จำนวนที่รับ</th>
                    <th className="px-4 py-3 text-left font-semibold">คลังปลางทาง</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fields.map((field, index) => {
                    const purchaseItem = purchase.items.find((it: any) => it.id === field.purchaseItemId);
                    const remaining = (purchaseItem?.quantity || 0) - (purchaseItem?.receivedQuantity || 0);

                    return (
                      <tr key={field.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="font-bold">{purchaseItem?.product?.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{purchaseItem?.product?.sku}</div>
                        </td>
                        <td className="px-4 py-4 text-center text-base font-semibold">{purchaseItem?.quantity}</td>
                        <td className="px-4 py-4 text-center text-muted-foreground">{purchaseItem?.receivedQuantity || 0}</td>
                        <td className="px-4 py-4 text-center">
                          <Badge variant="outline" className="border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30">
                            {remaining}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Input
                            type="number"
                            step="0.01"
                            className="text-center font-bold border-primary/30 focus-visible:ring-primary"
                            max={remaining}
                            {...form.register(`lineItems.${index}.receivedQuantity`, {
                              valueAsNumber: true
                            })}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <Select
                            onValueChange={(val) => form.setValue(`lineItems.${index}.warehouseId`, val)}
                            defaultValue={form.getValues(`lineItems.${index}.warehouseId`)}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="เลือกคลังสินค้า" />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                  <div className="flex items-center gap-2">
                                    <Warehouse className="w-3 h-3 opacity-50" />
                                    {w.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="fixed bottom-6 right-6 flex gap-4 z-50">
           <Button
            type="button"
            variant="outline"
            className="bg-background shadow-lg px-6"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ย้อนกลับ
          </Button>
          <Button
            type="submit"
            size="lg"
            className="shadow-2xl px-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            disabled={form.formState.isSubmitting}
          >
            <Save className="w-5 h-5 mr-3" />
            {form.formState.isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการรับสินค้า'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
