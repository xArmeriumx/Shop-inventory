'use client';

import { useState, useTransition } from 'react';
import { FormProvider, useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Plus,
    Trash2,
    Loader2,
    Calendar as CalendarIcon,
    AlertCircle
} from 'lucide-react';
import { importStatementAction } from '@/actions/accounting/bank.actions';
import { runActionWithToast } from '@/lib/mutation-utils';

const lineSchema = z.object({
    bookingDate: z.string().min(1, 'ระบุวันที่'),
    description: z.string().min(1, 'ระบุคำอธิบาย'),
    referenceNo: z.string().optional(),
    debitAmount: z.coerce.number().min(0),
    creditAmount: z.coerce.number().min(0)
});

const statementSchema = z.object({
    statementDate: z.string().min(1, 'ระบุวันที่ Statement'),
    openingBalance: z.coerce.number(),
    closingBalance: z.coerce.number(),
    lines: z.array(lineSchema).min(1, 'กรุณาเพิ่มอย่างน้อย 1 รายการ')
});

type StatementFormValues = z.infer<typeof statementSchema>;

interface StatementImportModalProps {
    children: React.ReactNode;
    bankAccountId: string;
}

export function StatementImportModal({ children, bankAccountId }: StatementImportModalProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const form = useForm<StatementFormValues>({
        resolver: zodResolver(statementSchema),
        defaultValues: {
            statementDate: new Date().toISOString().split('T')[0],
            openingBalance: 0,
            closingBalance: 0,
            lines: [{
                bookingDate: new Date().toISOString().split('T')[0],
                description: '',
                referenceNo: '',
                debitAmount: 0,
                creditAmount: 0
            }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'lines'
    });

    const onSubmit = (values: StatementFormValues) => {
        startTransition(async () => {
            await runActionWithToast(importStatementAction({
                bankAccountId,
                statementDate: new Date(values.statementDate),
                openingBalance: values.openingBalance,
                closingBalance: values.closingBalance,
                lines: values.lines.map(l => ({
                    ...l,
                    bookingDate: new Date(l.bookingDate)
                }))
            }), {
                successMessage: 'นำเข้าข้อมูล Statement สำเร็จ',
                onSuccess: () => {
                    setOpen(false);
                    form.reset();
                }
            });
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        นำเข้าข้อมูลรายการธนาคาร (Statement Import)
                    </DialogTitle>
                </DialogHeader>

                <FormProvider {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                                name="statementDate"
                                label="วันที่ของ Statement"
                                required
                            >
                                <Input type="date" {...form.register('statementDate')} />
                            </FormField>
                            <FormField
                                name="openingBalance"
                                label="ยอดยกมา (Opening)"
                                required
                            >
                                <Input type="number" step="0.01" {...form.register('openingBalance')} />
                            </FormField>
                            <FormField
                                name="closingBalance"
                                label="ยอดคงเหลือ (Closing)"
                                required
                            >
                                <Input type="number" step="0.01" {...form.register('closingBalance')} />
                            </FormField>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4" />
                                    รายการเดินบัญชี (Transaction Lines)
                                </h4>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({
                                        bookingDate: new Date().toISOString().split('T')[0],
                                        description: '',
                                        referenceNo: '',
                                        debitAmount: 0,
                                        creditAmount: 0
                                    })}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Line
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-12 gap-2 items-start bg-muted/30 p-3 rounded-lg border border-dashed">
                                        <div className="col-span-2">
                                            <Input
                                                type="date"
                                                className="h-8 text-xs"
                                                {...form.register(`lines.${index}.bookingDate`)}
                                            />
                                        </div>
                                        <div className="col-span-4">
                                            <Input
                                                placeholder="Description"
                                                className="h-8 text-xs"
                                                {...form.register(`lines.${index}.description`)}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Input
                                                type="number"
                                                placeholder="Debit"
                                                className="h-8 text-xs text-red-600 font-bold"
                                                {...form.register(`lines.${index}.debitAmount`)}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Input
                                                type="number"
                                                placeholder="Credit"
                                                className="h-8 text-xs text-green-600 font-bold"
                                                {...form.register(`lines.${index}.creditAmount`)}
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <Input
                                                placeholder="Ref"
                                                className="h-8 text-xs"
                                                {...form.register(`lines.${index}.referenceNo`)}
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => remove(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {fields.length === 0 && (
                            <div className="py-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center opacity-50 space-y-2">
                                <AlertCircle className="h-8 w-8" />
                                <p className="text-sm font-medium">ยังไม่มีรายการ</p>
                            </div>
                        )}

                        <DialogFooter className="pt-6 border-t">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90">
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Import Transactions
                            </Button>
                        </DialogFooter>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
}
