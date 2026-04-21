'use client';

import { FormProvider } from 'react-hook-form';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
            <form onSubmit={onSubmit} className="space-y-6">
                {/* Form-level errors */}
                {methods.formState.errors.root && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {methods.formState.errors.root.message}
                    </div>
                )}

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 lg:w-[450px]">
                        <TabsTrigger value="general">ข้อมูลทั่วไป</TabsTrigger>
                        <TabsTrigger value="pricing">ราคาและการขาย</TabsTrigger>
                        <TabsTrigger value="inventory">คลังสินค้าและขนส่ง</TabsTrigger>
                    </TabsList>

                    <div className="mt-6">
                        <Card>
                            <CardContent className="pt-6">
                                {/* TAB 1: GENERAL */}
                                <TabsContent value="general" className="mt-0 outline-none space-y-8">
                                    <div className="grid gap-8 lg:grid-cols-3">
                                        <div className="lg:col-span-2">
                                            <IdentitySection categories={categories} />
                                        </div>
                                        <div className="space-y-4">
                                            <Label className="text-sm font-medium text-muted-foreground">รูปภาพสินค้า</Label>
                                            <ProductImageUpload
                                                value={images}
                                                onChange={(imgs) => methods.setValue('images', imgs)}
                                                maxImages={5}
                                                disabled={isPending}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* TAB 2: PRICING & SALES */}
                                <TabsContent value="pricing" className="mt-0 outline-none space-y-6">
                                    <div className="grid gap-8 lg:grid-cols-2">
                                        <PricingSection isEdit={isEdit} product={product} />
                                        <SafeBoundary variant="compact" componentName="ErpSettings">
                                            <ErpSettingsSection />
                                        </SafeBoundary>
                                    </div>
                                </TabsContent>

                                {/* TAB 3: INVENTORY & LOGISTICS */}
                                <TabsContent value="inventory" className="mt-0 outline-none space-y-6">
                                    <div className="grid gap-8 lg:grid-cols-2">
                                        <SafeBoundary variant="compact" componentName="Logistics">
                                            <LogisticsSection />
                                        </SafeBoundary>
                                        <div className="space-y-4">
                                            <div className="text-sm font-medium text-muted-foreground border-b pb-1 mb-4">
                                                ข้อมูลสต็อก (Inventory Control)
                                            </div>
                                            <p className="text-xs text-muted-foreground bg-muted/30 p-4 rounded-lg border border-dashed text-center">
                                                ส่วนนี้จะขยายผลในโมดูล **Multi-Warehouse** (Layer 3)
                                                เพื่อจัดการจุดเก็บสินค้าและจุดสั่งซื้อซ้ำอัตโนมัติ
                                            </p>
                                        </div>
                                    </div>
                                </TabsContent>
                            </CardContent>
                        </Card>
                    </div>
                </Tabs>

                {/* Sticky Action Bar (mobile-friendly) */}
                <div className="flex gap-2 pt-6 border-t sticky bottom-0 bg-card/80 backdrop-blur-sm pb-2 z-10">
                    <Button type="submit" disabled={isPending} className="px-8 min-w-[120px]">
                        {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        ยกเลิก
                    </Button>
                </div>
            </form>
        </FormProvider>
    );
}
