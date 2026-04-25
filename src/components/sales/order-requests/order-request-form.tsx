'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { createOrderRequest } from '@/actions/sales/order-requests.actions';
import { orderRequestSchema, type OrderRequestInput } from '@/schemas/sales/order-request.schema';

interface OrderRequestFormProps {
    requesters: any[];
    products: any[];
}

export function OrderRequestForm({ requesters, products }: OrderRequestFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const methods = useForm<OrderRequestInput>({
        resolver: zodResolver(orderRequestSchema),
        defaultValues: {
            requesterId: '',
            items: [{ productId: '', quantity: 1, uom: 'ชิ้น' }],
        },
    });

    const { control, handleSubmit, register, setValue, watch, setError } = methods;
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    async function onSubmit(data: OrderRequestInput) {
        startTransition(async () => {
            await runActionWithToast(createOrderRequest(data), {
                successMessage: 'สร้างคำขอซื้อเรียบร้อยแล้ว',
                onSuccess: () => {
                    setTimeout(() => {
                        router.push('/order-requests');
                        router.refresh();
                    }, 100);
                },
                onError: (result) => mapActionErrorsToForm(methods, result.errors)
            });
        });
    }

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>ข้อมูลผู้ขอซื้อ</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <FormField name="requesterId" label="ผู้ขอซื้อ (Requester)" required>
                            <Select onValueChange={(val) => setValue('requesterId', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือกผู้ขอซื้อ..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {requesters.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.user?.name || '-'}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>

                        <FormField name="notes" label="เหตุผล / หมายเหตุ" className="sm:col-span-2">
                            <textarea
                                {...register('notes')}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                rows={3}
                                placeholder="ระบุเหตุผลในการขอซื้อ..."
                            />
                        </FormField>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>รายการที่ต้องการสั่งซื้อ</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1, uom: 'ชิ้น' })}>
                            <Plus className="mr-2 h-4 w-4" /> เพิ่มรายการ
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[350px]">สินค้า (ระบุหรือไม่ก็ได้)</TableHead>
                                    <TableHead>รายละเอียด / ชื่อสินค้ากรณีไม่มีในระบบ</TableHead>
                                    <TableHead className="w-[120px]">จำนวน</TableHead>
                                    <TableHead className="w-[100px]">หน่วย</TableHead>
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
                                                    const p = products.find(prod => prod.id === val);
                                                    if (p) setValue(`items.${index}.description`, p.name);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="เลือกสินค้าจากคลัง..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku || '-'})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input {...register(`items.${index}.description`)} placeholder="ชื่อสินค้าหรือสเปกเพิ่มเติม..." />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} min={1} />
                                        </TableCell>
                                        <TableCell>
                                            <Input {...register(`items.${index}.uom`)} placeholder="ชิ้น, ลัง, ม้วน..." />
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

                <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button>
                    <Button type="submit" disabled={isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
                        {isPending ? 'กำลังบันทึก...' : 'บันทึกคำขอซื้อ'}
                    </Button>
                </div>
            </form>
        </FormProvider>
    );
}
