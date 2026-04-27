'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { usePermissions } from '@/hooks/use-permissions';
import { StockAdjustmentDialog } from '@/components/inventory/products/stock-adjustment-dialog';
import type { ProductFormValues } from '@/schemas/inventory/product-form.schema';
import type { SerializedProduct } from '@/services';
import { TrendingUp } from 'lucide-react';

export function PricingSection({
    isEdit,
    product,
    inventoryMode = 'SIMPLE',
    warehouses = []
}: {
    isEdit: boolean;
    product?: SerializedProduct;
    inventoryMode?: string;
    warehouses?: any[];
}) {
    const { register, watch } = useFormContext<ProductFormValues>();
    const { hasPermission } = usePermissions();

    const costPrice = watch('costPrice') || 0;
    const salePrice = watch('salePrice') || 0;
    const margin = costPrice > 0 ? Math.round(((salePrice - costPrice) / costPrice) * 100) : 0;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            {/* Margin Indicator */}
            {costPrice > 0 && salePrice > 0 && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-muted/50">
                    <TrendingUp className={`h-3.5 w-3.5 ${margin >= 0 ? 'text-emerald-600' : 'text-destructive'}`} />
                    <span className="text-muted-foreground">กำไรขั้นต้น:</span>
                    <span className={`font-bold font-mono ${margin >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {margin}%
                    </span>
                    <span className="text-muted-foreground ml-1">
                        ({(salePrice - costPrice).toLocaleString('th-TH')} บาท/ชิ้น)
                    </span>
                </div>
            )}

            {/* Quick stock adjustment (Edit mode only) */}
            {isEdit && product && (
                <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">สต็อกคงเหลือรวม: <strong className="text-foreground">{product.stock}</strong></span>
                        <StockAdjustmentDialog
                            productId={product.id}
                            currentStock={product.stock}
                            inventoryMode={inventoryMode}
                            warehouses={warehouses}
                            warehouseStocks={product.warehouseStocks}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
