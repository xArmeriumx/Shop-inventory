'use client';

import { useState, useEffect } from 'react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { PAYMENT_METHODS } from '@/constants/erp/accounting.constants';
import { recordPaymentAction } from '@/actions/accounting/payments.actions';
import { getPaymentPostingPreviewAction } from '@/actions/accounting/journal.actions';
import { PostingPreview } from '@/components/accounting/posting-preview';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { paymentSchema, PaymentFormValues, getDefaultPaymentValues } from '@/schemas/accounting/payment-form.schema';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleId?: string;
    invoiceId?: string;
    residualAmount: number;
    parentTitle: string;
}

export function PaymentModal({
    isOpen,
    onClose,
    saleId,
    invoiceId,
    residualAmount,
    parentTitle
}: PaymentModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);

    const methods = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema),
        defaultValues: getDefaultPaymentValues(residualAmount),
    });

    // Reset values when modal opens or residual changes
    useEffect(() => {
        if (isOpen) {
            methods.reset(getDefaultPaymentValues(residualAmount));
            setPreviewData(null);
        }
    }, [isOpen, residualAmount, methods]);

    // Watch amount for Impact Preview
    const currentAmount = useWatch({ control: methods.control, name: 'amount' }) || 0;
    const nextResidual = Math.max(0, residualAmount - currentAmount);

    // Reactive Preview Fetching
    useEffect(() => {
        const fetchPreview = async () => {
            if (!isOpen || currentAmount <= 0) {
                setPreviewData(null);
                return;
            }
            const res = await getPaymentPostingPreviewAction({
                amount: currentAmount,
                paymentNo: 'NEW-PYM'
            });
            if (res.success) setPreviewData(res.data);
        };

        const timer = setTimeout(fetchPreview, 300);
        return () => clearTimeout(timer);
    }, [currentAmount, isOpen]);

    const onSubmit = async (values: PaymentFormValues) => {
        if (values.amount > residualAmount) {
            toast.error('ยอดชำระเกินยอดคงเหลือ');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await recordPaymentAction({
                saleId,
                invoiceId,
                amount: values.amount,
                paymentMethodCode: values.paymentMethodCode,
                paymentDate: values.paymentDate ? new Date(values.paymentDate) : undefined,
                referenceId: values.referenceId,
                note: values.note,
            });

            if (result.success) {
                toast.success('บันทึกการชำระเงินสำเร็จ');
                onClose();
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setIsSubmitting(false);
        }
    };

    const paymentMethodOptions = Object.values(PAYMENT_METHODS);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        รับชำระเงิน
                    </DialogTitle>
                    <DialogDescription>
                        บันทึกการชำระเงินสำหรับ {parentTitle}
                    </DialogDescription>
                </DialogHeader>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-4 my-4">
                    <div className="bg-muted p-3 rounded-lg border text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">ยอดค้างปัจจุบัน</p>
                        <p className="text-lg font-bold">{formatCurrency(residualAmount)}</p>
                    </div>
                    <div className={`p-3 rounded-lg border text-center transition-colors ${nextResidual === 0 ? 'bg-green-50 border-green-200' : 'bg-primary/5 border-primary/20'}`}>
                        <p className={`text-[10px] uppercase font-bold mb-1 ${nextResidual === 0 ? 'text-green-600' : 'text-muted-foreground'}`}>หลังชำระ</p>
                        <p className={`text-lg font-bold ${nextResidual === 0 ? 'text-green-600' : 'text-primary'}`}>
                            {formatCurrency(nextResidual)}
                        </p>
                    </div>
                </div>

                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            name="amount"
                            label="จำนวนเงินที่ชำระ"
                            required
                        >
                            <div className="relative">
                                <input
                                    {...methods.register('amount')}
                                    type="number"
                                    step="0.01"
                                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-lg font-bold ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="0.00"
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-1.5 h-8 text-xs h-8 px-2 hover:bg-primary/10"
                                    onClick={() => methods.setValue('amount', residualAmount)}
                                >
                                    จ่ายเต็ม
                                </Button>
                            </div>
                        </FormField>

                        <FormField
                            name="paymentMethodCode"
                            label="วิธีการชำระเงิน"
                            required
                        >
                            <select
                                {...methods.register('paymentMethodCode')}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {paymentMethodOptions.map((method) => (
                                    <option key={method.code} value={method.code}>
                                        {method.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>

                        {/* Impact Preview */}
                        {previewData && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <PostingPreview preview={previewData} title="พรีวิวกระทบยอดบัญชี (Payment Impact)" />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                name="paymentDate"
                                label="วันที่ชำระ"
                            >
                                <input
                                    {...methods.register('paymentDate')}
                                    type="date"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                            </FormField>
                            <FormField
                                name="referenceId"
                                label="เลขที่อ้างอิง"
                            >
                                <input
                                    {...methods.register('referenceId')}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    placeholder="เช่น เลขที่สลิป"
                                />
                            </FormField>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                                ยกเลิก
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="min-w-[140px] h-11">
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        ยืนยัน {formatCurrency(currentAmount)}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
}
