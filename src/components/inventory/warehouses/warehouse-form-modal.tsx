'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { warehouseSchema, WarehouseFormValues } from '@/schemas/inventory/warehouse-form.schema';
import { Modal } from '@/components/ui';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormProvider } from 'react-hook-form';
import { createWarehouseAction } from '@/actions/inventory/warehouse.actions';
import { toast } from 'sonner';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { useTransition } from 'react';

interface WarehouseFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: any;
}

export function WarehouseFormModal({ isOpen, onClose, initialData }: WarehouseFormModalProps) {
    const [isPending, startTransition] = useTransition();

    const methods = useForm<WarehouseFormValues>({
        resolver: zodResolver(warehouseSchema),
        defaultValues: initialData || {
            name: '',
            code: '',
            address: '',
            isDefault: false,
            isActive: true,
        },
    });

    const onSubmit = (values: WarehouseFormValues) => {
        startTransition(async () => {
            await runActionWithToast(createWarehouseAction(values), {
                successMessage: 'บันทึกข้อมูลคลังสินค้าสำเร็จ',
                onSuccess: () => {
                    onClose();
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'แก้ไขคลังสินค้า' : 'เพิ่มคลังสินค้าใหม่'}
        >
            <FormProvider {...methods}>
                <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField name="code" label="รหัสคลัง (Code)" required>
                            <Input placeholder="WH001" disabled={!!initialData} />
                        </FormField>
                        <FormField name="name" label="ชื่อคลัง (Warehouse Name)" required>
                            <Input placeholder="คลังกลาง / หน้าร้าน" />
                        </FormField>
                    </div>

                    <FormField name="address" label="ที่อยู่ / รายละเอียด">
                        <Input placeholder="ระบุตำแหน่งหรือที่ตั้ง" />
                    </FormField>

                    <div className="flex flex-col gap-3 pt-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="isDefault"
                                checked={methods.watch('isDefault')}
                                onCheckedChange={(checked) => methods.setValue('isDefault', !!checked)}
                            />
                            <label htmlFor="isDefault" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                ตั้งเป็นคลังสินค้าหลัก (Default Warehouse)
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="isActive"
                                checked={methods.watch('isActive')}
                                onCheckedChange={(checked) => methods.setValue('isActive', !!checked)}
                            />
                            <label htmlFor="isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                เปิดใช้งาน
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                        <Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button>
                        <Button type="submit" loading={isPending}>
                            {initialData ? 'บันทึกการแก้ไข' : 'สร้างคลังสินค้า'}
                        </Button>
                    </div>
                </form>
            </FormProvider>
        </Modal>
    );
}
