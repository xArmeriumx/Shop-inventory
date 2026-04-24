'use client';

import { useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2, Calculator } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { createQuotation } from '@/actions/sales/quotations.actions';
import { quotationSchema, type QuotationInput } from '@/schemas/sales/quotation.schema';

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
        },
    });

    const { control, handleSubmit, register, setValue, watch, setError } = methods;
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    // Watch items for total calculation
    const items = useWatch({
        control,
        name: 'items',
    });

    const totalAmount = items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const disc = Number(item.discount) || 0;
        return sum + (qty * price - disc);
    }, 0);

    async function onSubmit(data: QuotationInput) {
        startTransition(async () => {
            const result = await createQuotation(data);
            if (result.success) {
                toast.success(result.message);
                router.push('/quotations');
                router.refresh();
            } else {
                if (result.errors && typeof result.errors === 'object') {
                    Object.entries(result.errors).forEach(([field, messages]) => {
                        setError(field as any, { message: (messages as string[])[0] });
                    });
                } else {
                    toast.error(result.message);
                }
            }
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
                                        <TableCell className="text-right font-medium">
                                            {new Intl.NumberFormat('th-TH').format(
                                                (watch(`items.${index}.quantity`) || 0) * (watch(`items.${index}.unitPrice`) || 0) - (watch(`items.${index}.discount`) || 0)
                                            )}
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
                    <Card className="w-full max-w-[400px]">
                        <CardContent className="pt-6 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>ราคารวม (Subtotal)</span>
                                <span>{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(totalAmount)}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between font-bold text-lg">
                                <span>ยอดรวมสุทธิ</span>
                                <span className="text-primary">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(totalAmount)}</span>
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
