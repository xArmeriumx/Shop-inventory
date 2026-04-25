'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/ui/form-field';
import {
    accountSchema,
    AccountInput,
    getDefaultAccountValues,
} from '@/schemas/accounting/account.schema';
import { createAccountAction } from '@/actions/accounting/accounting.actions';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { useTransition } from 'react';

interface AccountFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: any[];
}

export function AccountFormModal({ isOpen, onClose, accounts }: AccountFormModalProps) {
    const [isPending, startTransition] = useTransition();

    const methods = useForm<AccountInput>({
        resolver: zodResolver(accountSchema),
        defaultValues: getDefaultAccountValues(),
    });

    const onSubmit = (values: AccountInput) => {
        startTransition(async () => {
            await runActionWithToast(createAccountAction(values), {
                successMessage: 'เพิ่มผังบัญชีเรียบร้อยแล้ว',
                onSuccess: () => {
                    methods.reset();
                    onClose();
                },
                onError: (result) => {
                    if (result.errors) {
                        mapActionErrorsToForm(methods, result.errors);
                    }
                }
            });
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>เพิ่มผังบัญชีใหม่ (Add Account)</DialogTitle>
                    <DialogDescription>
                        กำหนดรหัสและประเภทบัญชีให้ถูกต้องตามหลักการบัญชี
                    </DialogDescription>
                </DialogHeader>

                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField name="code" label="รหัสบัญชี" required hint="เช่น 1101-00">
                                <Input {...methods.register('code')} placeholder="1000-00" />
                            </FormField>
                            <FormField name="name" label="ชื่อบัญชี" required>
                                <Input {...methods.register('name')} placeholder="เช่น เงินฝากธนาคาร" />
                            </FormField>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField name="category" label="หมวดหมู่บัญชี" required>
                                <Select
                                    value={methods.watch('category')}
                                    onValueChange={(v) => methods.setValue('category', v as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกหมวดหมู่" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ASSET">สินทรัพย์ (Assets)</SelectItem>
                                        <SelectItem value="LIABILITY">หนี้สิน (Liabilities)</SelectItem>
                                        <SelectItem value="EQUITY">ส่วนของเจ้าของ (Equity)</SelectItem>
                                        <SelectItem value="REVENUE">รายได้ (Revenue)</SelectItem>
                                        <SelectItem value="EXPENSE">ค่าใช้จ่าย (Expenses)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <FormField name="normalBalance" label="ทิศทางบัญชีปกติ" required>
                                <Select
                                    value={methods.watch('normalBalance')}
                                    onValueChange={(v) => methods.setValue('normalBalance', v as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกทิศทาง" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DEBIT">เดบิต (Debit)</SelectItem>
                                        <SelectItem value="CREDIT">เครดิต (Credit)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                        </div>

                        <FormField name="parentId" label="บัญชีคุม (Parent Account)">
                            <Select
                                value={methods.watch('parentId') || 'none'}
                                onValueChange={(v) => methods.setValue('parentId', v === 'none' ? null : v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือกบัญชีคุม (ถ้ามี)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- ไม่มี (บัญชีระดับสูงสุด) --</SelectItem>
                                    {accounts
                                        .filter(acc => !acc.isPostable)
                                        .map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                {acc.code} - {acc.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </FormField>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2 border p-3 rounded-lg bg-muted/20">
                                <Switch
                                    id="isPostable"
                                    checked={methods.watch('isPostable')}
                                    onCheckedChange={(v) => methods.setValue('isPostable', v)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label htmlFor="isPostable" className="text-sm font-medium">บันทึกรายการได้ (Postable)</label>
                                    <p className="text-xs text-muted-foreground text-[10px]">บัญชีย่อยสำหรับลงรายการ</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 border p-3 rounded-lg bg-muted/20">
                                <Switch
                                    id="isActive"
                                    checked={methods.watch('isActive')}
                                    onCheckedChange={(v) => methods.setValue('isActive', v)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label htmlFor="isActive" className="text-sm font-medium">เปิดใช้งาน (Active)</label>
                                    <p className="text-xs text-muted-foreground text-[10px]">สถานะการใช้งานปัจจุบัน</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'กำลังบันทึก...' : 'บันทึกผังบัญชี'}
                            </Button>
                        </div>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
}
