'use client';

import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { paymentVoucherSchema, PaymentVoucherInput, getPaymentVoucherDefaultValues } from '@/schemas/accounting/voucher.schema';
import { createPaymentVoucherAction } from '@/actions/accounting/voucher.actions';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { VoucherAllocationTable } from './voucher-allocation-table';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Save, X, Truck, Calendar, CreditCard, FileText, Loader2 } from 'lucide-react';
import { SafeBoundary } from '@/components/ui/safe-boundary';
import { cn } from '@/lib/utils';

interface PaymentVoucherFormProps {
    suppliers: Array<{ id: string; name: string }>;
}

export const PaymentVoucherForm: React.FC<PaymentVoucherFormProps> = ({ suppliers }) => {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const methods = useForm<PaymentVoucherInput>({
        resolver: zodResolver(paymentVoucherSchema),
        defaultValues: getPaymentVoucherDefaultValues(),
    });

    const { handleSubmit, watch, setValue, formState: { errors } } = methods;
    const supplierId = watch('supplierId');
    const totalAmount = watch('totalAmount');

    const onSubmit = async (data: PaymentVoucherInput) => {
        setIsSubmitting(true);
        try {
            const res = await createPaymentVoucherAction(data);
            if (res.success) {
                toast.success(res.message);
                router.push('/accounting/payments');
            } else {
                toast.error(res.message || 'บันทึกไม่สำเร็จ');
            }
        } catch (error: any) {
            toast.error(error.message || 'เกิดข้อผิดพลาด');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-20">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">บันทึกใบสำคัญจ่ายเงิน</h1>
                        <p className="text-sm text-muted-foreground">บันทึกการจ่ายเงินให้เจ้าหนี้และตัดยอดใบสั่งซื้อ/ค่าใช้จ่าย</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Header Info */}
                    <Card className="lg:col-span-1 shadow-sm border-muted/60">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                ข้อมูลทั่วไป
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField name="supplierId" label="ผู้จำหน่าย" required>
                                <Select
                                    onValueChange={(val) => setValue('supplierId', val)}
                                    defaultValue={methods.getValues('supplierId')}
                                >
                                    <SelectTrigger className="h-10 bg-muted/20">
                                        <SelectValue placeholder="เลือกผู้จำหน่าย..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <FormField name="paymentDate" label="วันที่จ่ายเงิน" required>
                                <Input
                                    type="date"
                                    className="h-10 bg-muted/20"
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setValue('paymentDate', new Date(e.target.value))}
                                />
                            </FormField>

                            <FormField name="paymentMethodCode" label="ช่องทางจ่ายเงิน" required>
                                <Select
                                    onValueChange={(val) => setValue('paymentMethodCode', val)}
                                    defaultValue={methods.getValues('paymentMethodCode')}
                                >
                                    <SelectTrigger className="h-10 bg-muted/20">
                                        <SelectValue placeholder="เลือกช่องทาง..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TRANSFER">โอนเงินธนาคาร</SelectItem>
                                        <SelectItem value="CASH">เงินสด</SelectItem>
                                        <SelectItem value="CHEQUE">เช็ค</SelectItem>
                                        <SelectItem value="CREDIT_CARD">บัตรเครดิต</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <FormField name="totalAmount" label="ยอดจ่ายเงินรวม" required hint="ระบุยอดเงินทั้งหมดที่จ่ายจริง">
                                <Input
                                    type="number"
                                    step="0.01"
                                    className="h-12 text-lg font-bold bg-primary/5 border-primary/20"
                                    {...methods.register('totalAmount', { valueAsNumber: true })}
                                />
                            </FormField>

                            <FormField name="referenceId" label="เลขที่อ้างอิง">
                                <Input {...methods.register('referenceId')} placeholder="เช่น เลขที่เช็ค/โอน" className="h-10 bg-muted/20" />
                            </FormField>

                            <FormField name="note" label="หมายเหตุ">
                                <Textarea {...methods.register('note')} rows={3} className="bg-muted/20" />
                            </FormField>
                        </CardContent>
                    </Card>

                    {/* Allocations Table */}
                    <Card className="lg:col-span-2 shadow-sm border-muted/60">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Truck className="w-4 h-4 text-primary" />
                                รายการสั่งซื้อที่มียอดค้างชำระ
                            </CardTitle>
                            <CardDescription>เลือกรายการที่ต้องการตัดจ่ายจากตารางด้านล่าง</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SafeBoundary>
                                <VoucherAllocationTable
                                    type="PAYMENT"
                                    partnerId={supplierId}
                                    totalAmountToAllocate={totalAmount}
                                    onAllocationChange={(allocs) => setValue('allocations', allocs)}
                                />
                            </SafeBoundary>
                        </CardContent>
                    </Card>
                </div>

                {/* Sticky Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t p-4 flex items-center justify-between sm:left-64 transition-all duration-300">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total Payment</span>
                        <span className="text-xl font-black text-primary">
                            {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(totalAmount)}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            className="rounded-full px-6"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-full px-8 bg-black hover:bg-zinc-800 text-white gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            บันทึกใบสำคัญ
                        </Button>
                    </div>
                </div>
            </form>
        </FormProvider>
    );
};
