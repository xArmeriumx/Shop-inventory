'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import type { ProductFormValues } from '@/schemas/product-form';

export function LogisticsSection() {
    const { register } = useFormContext<ProductFormValues>();

    return (
        <div className="space-y-4 p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
            <h3 className="font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                Logistics & Dimensions
            </h3>
            <div className="grid gap-4">
                <FormField name="metadata.weight" label="น้ำหนัก (kg)">
                    <Input
                        id="metadata.weight"
                        type="number"
                        step="0.01"
                        min="0"
                        {...register('metadata.weight', { valueAsNumber: true })}
                        placeholder="0.00"
                    />
                </FormField>
                <div className="grid grid-cols-3 gap-2">
                    <FormField name="metadata.width" label="กว้าง (cm)">
                        <Input
                            id="metadata.width"
                            type="number"
                            step="0.1"
                            min="0"
                            {...register('metadata.width', { valueAsNumber: true })}
                        />
                    </FormField>
                    <FormField name="metadata.height" label="สูง (cm)">
                        <Input
                            id="metadata.height"
                            type="number"
                            step="0.1"
                            min="0"
                            {...register('metadata.height', { valueAsNumber: true })}
                        />
                    </FormField>
                    <FormField name="metadata.length" label="ยาว (cm)">
                        <Input
                            id="metadata.length"
                            type="number"
                            step="0.1"
                            min="0"
                            {...register('metadata.length', { valueAsNumber: true })}
                        />
                    </FormField>
                </div>
            </div>
        </div>
    );
}
