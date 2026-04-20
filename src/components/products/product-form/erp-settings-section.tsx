'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/form-field';
import type { ProductFormValues } from '@/schemas/product-form';

export function ErpSettingsSection() {
    const { register, watch, setValue } = useFormContext<ProductFormValues>();
    const isActive = watch('isActive');
    const isSaleable = watch('isSaleable');

    return (
        <div className="space-y-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
            <h3 className="font-semibold text-primary flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                ERP & Procurement Settings
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
                <FormField name="moq" label="ยอดสั่งซื้อขั้นต่ำ (MOQ)">
                    <Input
                        id="moq"
                        type="number"
                        min="0"
                        {...register('moq', { valueAsNumber: true })}
                        placeholder="ระบุ MOQ ถ้ามี"
                    />
                </FormField>

                <FormField
                    name="packagingQty"
                    label="จำนวนต่อแพ็ก/กล่อง"
                    hint="1 = ไม่มีการแพ็กพิเศษ"
                >
                    <Input
                        id="packagingQty"
                        type="number"
                        min="1"
                        {...register('packagingQty', { valueAsNumber: true })}
                    />
                </FormField>

                <div className="flex flex-col gap-3 justify-center">
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={isActive}
                            onChange={(e) => setValue('isActive', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="isActive" className="cursor-pointer">เปิดใช้งานสินค้า (Active)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isSaleable"
                            checked={isSaleable}
                            onChange={(e) => setValue('isSaleable', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="isSaleable" className="cursor-pointer">พร้อมขาย (Saleable)</Label>
                    </div>
                </div>
            </div>
        </div>
    );
}
