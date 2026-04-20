'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import type { ProductFormValues } from '@/schemas/product-form';

interface Category {
    id: string;
    name: string;
    color?: string | null;
}

export function IdentitySection({ categories }: { categories: Category[] }) {
    const { register } = useFormContext<ProductFormValues>();

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="name" label="ชื่อสินค้า" required className="sm:col-span-2">
                    <Input
                        id="name"
                        {...register('name')}
                        placeholder="ระบุชื่อสินค้า"
                        maxLength={200}
                    />
                </FormField>

                <FormField name="sku" label="รหัสสินค้า (SKU)" hint="เช่น ITEM-001">
                    <Input
                        id="sku"
                        {...register('sku')}
                        placeholder="เช่น ITEM-001"
                        maxLength={50}
                    />
                </FormField>

                <FormField name="category" label="หมวดหมู่" required>
                    <select
                        id="category"
                        {...register('category')}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-2 focus:ring-primary"
                    >
                        <option value="">เลือกหมวดหมู่</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                </FormField>
            </div>

            <FormField name="description" label="รายละเอียด">
                <textarea
                    id="description"
                    {...register('description')}
                    placeholder="รายละเอียดสินค้า (ไม่บังคับ)"
                    rows={4}
                    maxLength={1000}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                />
            </FormField>
        </div>
    );
}
