'use client';

import { useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Calculator, Tag, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { usePermissions } from '@/hooks/use-permissions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { createQuotation } from '@/actions/sales/quotations.actions';
import { quotationSchema, computeQuotationTotals, type QuotationInput } from '@/schemas/sales/quotation.schema';

interface QuotationFormProps {
    customers: any[];
    products: any[];
    initialData?: any;
}

export function QuotationForm({ customers, products, initialData }: QuotationFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const methods = useForm<QuotationInput>({
        resolver: zodResolver(quotationSchema),
        defaultValues: initialData || {
            customerId: '',
            items: [{ productId: '', quantity: 1, unitPrice: 0, discount: 0 }],
            currencyCode: 'THB',
            taxMode: 'INCLUSIVE',
            taxRate: 7,
        },
    });

    const { control, handleSubmit, register, setValue, watch, setError } = methods;
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    // Calculate accurate totals via SSOT Engine
    const allValues = useWatch({ control });
    const calculation = computeQuotationTotals(allValues, products);
    const { totals } = calculation;

    async function onSubmit(data: QuotationInput) {
        startTransition(async () => {
            await runActionWithToast(createQuotation(data), {
                successMessage: 'บันทึกใบเสนอราคาสำเร็จ',
                onSuccess: () => {
                    router.push('/quotations');
                    router.refresh();
                },
                onError: (res) => {
                    if (res.errors) mapActionErrorsToForm(methods, res.errors);
                }
            });
        });
    }

    const handleProductChange = (index: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setValue(`items.${index}.unitPrice`, Number(product.salePrice));
            setValue(`items.${index}.description`, product.name);
        }
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>ข้อมูลลูกค้าและเงื่อนไข</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        <FormField name="customerId" label="ลูกค้า" required>
                            <Select onValueChange={(val) => setValue('customerId', val)} defaultValue={watch('customerId')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือกลูกค้า..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>

                        <FormField name="date" label="วันที่เอกสาร">
                            <Input type="date" {...register('date', { valueAsDate: true })} defaultValue={new Date().toISOString().split('T')[0]} />
                        </FormField>

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

                        <FormField name="validUntil" label="ยืนราคาถึงวันที่">
                            <Input type="date" {...register('validUntil', { valueAsDate: true })} />
                        </FormField>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>รายการสินค้า</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1, unitPrice: 0, discount: 0 })}>
                            <Plus className="mr-2 h-4 w-4" /> เพิ่มรายการ
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">สินค้า</TableHead>
                                    <TableHead>รายละเอียด</TableHead>
                                    <TableHead className="w-[100px]">จำนวน</TableHead>
                                    <TableHead className="w-[150px]">ราคา/หน่วย</TableHead>
                                    <TableHead className="w-[120px]">ส่วนลด</TableHead>
                                    <TableHead className="w-[150px] text-right">ยอดรวม</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <Select
                                                onValueChange={(val) => {
                                                    setValue(`items.${index}.productId`, val);
                                                    handleProductChange(index, val);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="เลือกสินค้า..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku || '-'})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input {...register(`items.${index}.description`)} placeholder="รายละเอียด..." />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} min={1} />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} step="0.01" />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" {...register(`items.${index}.discount`, { valueAsNumber: true })} step="0.01" />
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-medium">
                                            {formatCurrency(calculation.lines[index]?.lineNet.toString() || '0')}
                                        </TableCell>
                                        <TableCell>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="flex flex-col items-end gap-4">
                    <Card className="w-full max-w-[400px] border-primary/20 shadow-md">
                        <CardContent className="pt-6 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Plus className="h-3 w-3" /> ยอดรวมสินค้า (Gross)</span>
                                <span className="font-mono font-bold">{formatCurrency(totals.subtotalAmount.toString())}</span>
                            </div>

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
                                <span className="text-3xl font-black tracking-tighter text-primary font-mono">{formatCurrency(totals.netAmount.toString())}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-4">
                        <Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'กำลังบันทึก...' : 'บันทึกใบเสนอราคา'}
                        </Button>
                    </div>
                </div>
            </form>
        </FormProvider>
    );
}
