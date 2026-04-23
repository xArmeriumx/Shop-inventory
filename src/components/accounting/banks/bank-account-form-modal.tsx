'use client';

import { useState, useTransition } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { createBankAccountAction } from '@/actions/bank';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const bankAccountSchema = z.object({
    name: z.string().min(1, 'กรุณาระบุชื่อเรียกบัญชี'),
    bankName: z.string().min(1, 'กรุณาระบุชื่อธนาคาร'),
    accountNo: z.string().min(5, 'เลขที่บัญชีไม่ถูกต้อง'),
    glAccountId: z.string().min(1, 'กรุณาเลือกผังบัญชีที่เชื่อมโยง'),
    currency: z.string().default('THB')
});

type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

interface BankAccountFormModalProps {
    children: React.ReactNode;
    postableAccounts: any[];
}

export function BankAccountFormModal({ children, postableAccounts }: BankAccountFormModalProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const form = useForm<BankAccountFormValues>({
        resolver: zodResolver(bankAccountSchema),
        defaultValues: {
            name: '',
            bankName: '',
            accountNo: '',
            glAccountId: '',
            currency: 'THB'
        }
    });

    const onSubmit = (values: BankAccountFormValues) => {
        startTransition(async () => {
            try {
                await createBankAccountAction(values);
                toast.success('เพิ่มบัญชีธนาคารสำเร็จ');
                setOpen(false);
                form.reset();
            } catch (error) {
                toast.error('ไม่สามารถเพิ่มบัญชีธนาคารได้');
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>เพิ่มบัญชีธนาคารใหม่</DialogTitle>
                </DialogHeader>
                <FormProvider {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            name="name"
                            label="ชื่อเรียกบัญชี"
                            required
                        >
                            <Input placeholder="เช่น กสิกรไทย (ออมทรัพย์)" {...form.register('name')} />
                        </FormField>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                name="bankName"
                                label="ชื่อธนาคาร"
                                required
                            >
                                <Input placeholder="KBank, SCB, BBL" {...form.register('bankName')} />
                            </FormField>
                            <FormField
                                name="accountNo"
                                label="เลขที่บัญชี"
                                required
                            >
                                <Input placeholder="000-0-00000-0" {...form.register('accountNo')} />
                            </FormField>
                        </div>

                        <FormField
                            name="glAccountId"
                            label="เชื่อมโยงกับผังบัญชี (CoA)"
                            required
                        >
                            <Select onValueChange={(val) => form.setValue('glAccountId', val)} defaultValue={form.getValues('glAccountId')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือกบัญชีในระบบที่ตรงกัน" />
                                </SelectTrigger>
                                <SelectContent>
                                    {postableAccounts.map((acc) => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.code} - {acc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                บันทึก
                            </Button>
                        </DialogFooter>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
}
