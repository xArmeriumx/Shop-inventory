'use client';

import { FormProvider } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SafeBoundary } from '@/components/ui/safe-boundary';
import { ProductImageUpload } from '@/components/ui/product-image-upload';

import { useProductForm } from '@/hooks/use-product-form';
import { IdentitySection } from './identity-section';
import { PricingSection } from './pricing-section';
import { LogisticsSection } from './logistics-section';
import { ErpSettingsSection } from './erp-settings-section';
import { StockSection } from './stock-section';

import type { SerializedProduct } from '@/services';
import {
    Package, DollarSign, Warehouse, Settings, ChevronDown, ChevronUp,
    ImageIcon
} from 'lucide-react';

interface Category {
    id: string;
    name: string;
    color?: string | null;
}

interface ProductFormProps {
    product?: SerializedProduct;
    categories: Category[];
    inventoryMode?: string;
    warehouses?: any[];
}

export function ProductForm({ product, categories, inventoryMode = 'SIMPLE', warehouses = [] }: ProductFormProps) {
    const router = useRouter();
    const { methods, onSubmit, isPending, isEdit } = useProductForm(product, warehouses);
    const [showAdvanced, setShowAdvanced] = useState(false);

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

                {/* ═══════════════════════════════════════════════════════ */}
                {/* SECTION 1: ข้อมูลสินค้า (Product Identity)            */}
                {/* ═══════════════════════════════════════════════════════ */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Package className="h-4 w-4 text-primary" />
                            ข้อมูลสินค้า
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-6 lg:grid-cols-3">
                            <div className="lg:col-span-2">
                                <IdentitySection categories={categories} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    รูปภาพสินค้า
                                </Label>
                                <ProductImageUpload
                                    value={images}
                                    onChange={(imgs) => methods.setValue('images', imgs)}
                                    maxImages={5}
                                    disabled={isPending}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* SECTION 2: ราคาและสต็อก (Pricing & Stock) — COMBINED  */}
                {/* ═══════════════════════════════════════════════════════ */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                            ราคาและสต็อก
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PricingSection
                            isEdit={isEdit}
                            product={product}
                            inventoryMode={inventoryMode}
                            warehouses={warehouses}
                        />
                    </CardContent>
                </Card>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* SECTION 3: คลังสินค้า (Warehouse Inventory)           */}
                {/* This is the HERO section — always visible, prominent  */}
                {/* ═══════════════════════════════════════════════════════ */}
                <Card className="border-primary/20 shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Warehouse className="h-4 w-4 text-blue-600" />
                            จัดการคลังสินค้า
                            {!isEdit && warehouses.length > 0 && (
                                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
                                    กรอกยอดเริ่มต้นแยกรายคลัง
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <StockSection />
                    </CardContent>
                </Card>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* SECTION 4: ตั้งค่าขั้นสูง (Advanced — Collapsible)     */}
                {/* ═══════════════════════════════════════════════════════ */}
                <Card>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                            ตั้งค่าขั้นสูง
                            <span className="text-[10px] font-normal text-muted-foreground">
                                (Logistics, MOQ, แพ็ก)
                            </span>
                        </span>
                        {showAdvanced
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                    </button>
                    {showAdvanced && (
                        <CardContent className="pt-0 border-t">
                            <div className="grid gap-6 lg:grid-cols-2 pt-4">
                                <SafeBoundary variant="compact" componentName="Logistics">
                                    <LogisticsSection />
                                </SafeBoundary>
                                <SafeBoundary variant="compact" componentName="ErpSettings">
                                    <ErpSettingsSection />
                                </SafeBoundary>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* ACTION BAR (Sticky)                                   */}
                {/* ═══════════════════════════════════════════════════════ */}
                <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-background/80 backdrop-blur-sm pb-3 z-10">
                    <Button type="submit" disabled={isPending} className="px-8 min-w-[140px]">
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
