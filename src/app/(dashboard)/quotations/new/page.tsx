import { Metadata } from 'next';
import { getCustomersForSelect } from '@/actions/customers';
import { getProductsForSelect } from '@/actions/products';
import { QuotationForm } from '@/components/quotations/quotation-form';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';

export const metadata: Metadata = {
    title: 'ออกใบเสนอราคาใหม่ | ERP System',
};

export default async function NewQuotationPage() {
    const [customers, products] = await Promise.all([
        getCustomersForSelect(),
        getProductsForSelect(),
    ]);

    return (
        <div className="p-6 space-y-6">
            <BackPageHeader
                backHref="/quotations"
                title="ออกใบเสนอราคาใหม่"
                description="สร้างใบเสนอราคาใหม่เพื่อส่งให้ลูกค้าพิจารณา"
            />

            <div className="max-w-5xl mx-auto">
                <QuotationForm
                    customers={customers}
                    products={products}
                />
            </div>
        </div>
    );
}
