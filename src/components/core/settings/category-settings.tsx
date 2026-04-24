'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package, Wallet, TrendingUp } from 'lucide-react';
import { CategoryManager } from '@/components/core/lookups/category-manager';

interface LookupValue {
    id: string;
    code: string;
    name: string;
    color: string | null;
    isSystem: boolean;
}

interface CategorySettingsProps {
    productCategories: LookupValue[];
    expenseCategories: LookupValue[];
    incomeCategories: LookupValue[];
}

export function CategorySettings({
    productCategories,
    expenseCategories,
    incomeCategories
}: CategorySettingsProps) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        หมวดหมู่สินค้า
                    </CardTitle>
                    <CardDescription>จัดการหมวดหมู่สำหรับแบ่งกลุ่มสินค้าในระบบคลังและ POS</CardDescription>
                </CardHeader>
                <CardContent>
                    <CategoryManager title="" typeCode="PRODUCT_CATEGORY" values={productCategories} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        หมวดหมู่ค่าใช้จ่าย
                    </CardTitle>
                    <CardDescription>จัดการหมวดหมู่รายจ่ายเพื่อการวิเคราะห์งบประมาณ</CardDescription>
                </CardHeader>
                <CardContent>
                    <CategoryManager title="" typeCode="EXPENSE_CATEGORY" values={expenseCategories} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        หมวดหมู่รายรับ
                    </CardTitle>
                    <CardDescription>จัดการหมวดหมู่รายได้อื่นๆ นอกเหนือจากการขาย</CardDescription>
                </CardHeader>
                <CardContent>
                    <CategoryManager title="" typeCode="INCOME_CATEGORY" values={incomeCategories} />
                </CardContent>
            </Card>
        </div>
    );
}
