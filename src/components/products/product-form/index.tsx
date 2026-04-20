'use client';

import { FormProvider } from 'react-hook-form';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SafeBoundary } from '@/components/ui/safe-boundary';
import { ProductImageUpload } from '@/components/ui/product-image-upload';

import { useProductForm } from '@/hooks/use-product-form';
import { IdentitySection } from './identity-section';
import { PricingSection } from './pricing-section';
import { LogisticsSection } from './logistics-section';
import { ErpSettingsSection } from './erp-settings-section';

import type { SerializedProduct } from '@/services';

interface Category {
    id: string;
    name: string;
    color?: string | null;
}

interface ProductFormProps {
    product?: SerializedProduct;
    categories: Category[];
}

export function ProductForm({ product, categories }: ProductFormProps) {
    const router = useRouter();
    const { methods, onSubmit, isPending, isEdit } = useProductForm(product);

    const images = methods.watch('images');

    return (
        <FormProvider {...methods}>
            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={onSubmit} className="space-y-8">
                        {/* Form-level errors */}
                        {methods.formState.errors.root && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                {methods.formState.errors.root.message}
                            </div>
                        )}

                        <div className="grid gap-8 lg:grid-cols-3">
                            {/* Left Column: Main Content */}
                            <div className="lg:col-span-2 space-y-6">
                                <IdentitySection categories={categories} />
                                <PricingSection isEdit={isEdit} product={product} />
                                <SafeBoundary variant="compact" componentName="ErpSettings">
                                    <ErpSettingsSection />
                                </SafeBoundary>
                            </div>

                            {/* Right Column: Media & Logistics */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label>รูปภาพสินค้า</Label>
                                    <ProductImageUpload
                                        value={images}
                                        onChange={(imgs) => methods.setValue('images', imgs)}
                                        maxImages={5}
                                        disabled={isPending}
                                    />
                                </div>
                                <SafeBoundary variant="compact" componentName="Logistics">
                                    <LogisticsSection />
                                </SafeBoundary>
                            </div>
                        </div>

                        {/* Sticky Action Bar (mobile-friendly) */}
                        <div className="flex gap-2 pt-6 border-t sticky bottom-0 bg-card pb-2">
                            <Button type="submit" disabled={isPending} className="px-8">
                                {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => router.back()}>
                                ยกเลิก
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </FormProvider>
    );
}
