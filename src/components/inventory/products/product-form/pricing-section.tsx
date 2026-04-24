'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { usePermissions } from '@/hooks/use-permissions';
import { StockAdjustmentDialog } from '@/components/inventory/products/stock-adjustment-dialog';
import type { ProductFormValues } from '@/schemas/inventory/product-form.schema';
import type { SerializedProduct } from '@/services';

export function PricingSection({ isEdit, product }: { isEdit: boolean; product?: SerializedProduct }) {
    const { register } = useFormContext<ProductFormValues>();
    const { hasPermission } = usePermissions();

    return (
        <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-muted/30 border">
            {hasPermission('PRODUCT_VIEW_COST') && (
                <FormField name="costPrice" label="ราคาทุน (บาท)" required>
                    <Input
                        id="costPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        max={999999999}
                        {...register('costPrice', { valueAsNumber: true })}
                    />
                </FormField>
            )}

            <FormField name="salePrice" label="ราคาขาย (บาท)" required>
                <Input
                    id="salePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    max={999999999}
                    {...register('salePrice', { valueAsNumber: true })}
                />
            </FormField>

            <FormField name="stock" label="จำนวนในสต็อก" required>
                <Input
                    id="stock"
                    type="number"
                    min="0"
                    {...register('stock', { valueAsNumber: true })}
                    disabled={isEdit}
                />
                {isEdit && product && (
                    <StockAdjustmentDialog productId={product.id} currentStock={product.stock} />
                )}
            </FormField>

            <FormField name="minStock" label="จุดแจ้งเตือน (Min Stock)">
                <Input
                    id="minStock"
                    type="number"
                    min="0"
                    {...register('minStock', { valueAsNumber: true })}
                />
            </FormField>
        </div>
    );
}
