'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { stockTransferSchema, StockTransferFormValues } from '@/schemas/inventory/stock-transfer-form.schema';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormProvider } from 'react-hook-form';
import { createStockTransferAction } from '@/actions/inventory/stock-transfer.actions';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { useTransition } from 'react';
import { Trash2, Plus, ArrowRightLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';

interface StockTransferFormProps {
    warehouses: any[];
    products: any[];
}

export function StockTransferForm({ warehouses, products }: StockTransferFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const methods = useForm<StockTransferFormValues>({
        resolver: zodResolver(stockTransferSchema),
        defaultValues: {
            fromWarehouseId: '',
            toWarehouseId: '',
            notes: '',
            lines: [{ productId: '', quantity: 1 }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: methods.control,
        name: 'lines',
    });

    const fromWarehouseId = methods.watch('fromWarehouseId');
    const toWarehouseId = methods.watch('toWarehouseId');

    const onSubmit = (values: StockTransferFormValues) => {
        // Double check same warehouse on client side just in case
        if (values.fromWarehouseId === values.toWarehouseId) {
            methods.setError('root', { message: 'คลังต้นทางและปลายทางต้องไม่ใชที่เดียวกัน' });
            return;
        }

        startTransition(async () => {
            await runActionWithToast(createStockTransferAction(values), {
                successMessage: 'สร้างใบโอนสินค้าสำเร็จ',
                onSuccess: () => {
                    setTimeout(() => {
                        router.push('/inventory/transfers');
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
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-end gap-4">
                            <div className="lg:col-span-2">
                                <FormField name="fromWarehouseId" label="จากคลังสินค้า (Source)" required>
                                    <Select
                                        onValueChange={(val) => methods.setValue('fromWarehouseId', val)}
                                        value={fromWarehouseId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="เลือกคลังต้นทาง" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses
                                                .filter(w => w.id !== toWarehouseId) // Bug Fix: Filter out destination
                                                .map(w => (
                                                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </FormField>
                            </div>

                            <div className="hidden lg:flex justify-center pb-3">
                                <ArrowRightLeft className="h-5 w-5 text-muted-foreground transition-all duration-500 hover:rotate-180" />
                            </div>

                            <div className="lg:col-span-2">
                                <FormField name="toWarehouseId" label="ไปคลังสินค้า (Destination)" required>
                                    <Select
                                        onValueChange={(val) => methods.setValue('toWarehouseId', val)}
                                        value={toWarehouseId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="เลือกคลังปลายทาง" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses
                                                .filter(w => w.id !== fromWarehouseId) // Bug Fix: Filter out source
                                                .map(w => (
                                                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </FormField>
                            </div>
                        </div>

                        <div className="mt-4">
                            <FormField name="notes" label="หมายเหตุ / เหตุผลการโอน">
                                <Input placeholder="เช่น ย้ายของเข้าหน้าร้าน, ปรับปรุงสต็อก..." />
                            </FormField>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">รายการสินค้า (Line Items)</span>
                    </div>
                    <div className="p-4 space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                <div className="md:col-span-8">
                                    <FormField name={`lines.${index}.productId`} label={index === 0 ? "สินค้า" : ""} required>
                                        <Select
                                            onValueChange={(val) => methods.setValue(`lines.${index}.productId`, val)}
                                            value={methods.watch(`lines.${index}.productId`)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="เลือกสินค้า..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name} (SKU: {p.sku || '-'})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                </div>
                                <div className="md:col-span-3">
                                    <FormField name={`lines.${index}.quantity`} label={index === 0 ? "จำนวน" : ""} required>
                                        <Input type="number" {...methods.register(`lines.${index}.quantity`)} min={1} />
                                    </FormField>
                                </div>
                                <div className={`md:col-span-1 flex justify-center ${index === 0 ? 'pt-8' : 'pt-2'}`}>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => remove(index)}
                                        disabled={fields.length === 1}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full border-dashed"
                            onClick={() => append({ productId: '', quantity: 1 })}
                        >
                            <Plus className="h-4 w-4 mr-2" /> เพิ่มรายการ
                        </Button>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button>
                    <Button type="submit" loading={isPending} className="px-8">สร้างใบโอนสินค้า (Draft)</Button>
                </div>
            </form>
        </FormProvider>
    );
}
