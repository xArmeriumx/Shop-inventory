import { Metadata } from 'next';
import { getTeamMembers } from '@/actions/team';
import { getProductsForSelect } from '@/actions/products';
import { OrderRequestForm } from '@/components/order-requests/order-request-form';
import { BackPageHeader } from '@/components/ui/back-page-header';

export const metadata: Metadata = {
    title: 'สร้างคำขอซื้อใหม่ | ERP System',
};

export default async function NewOrderRequestPage() {
    const [requesters, products] = await Promise.all([
        getTeamMembers(),
        getProductsForSelect(),
    ]);

    return (
        <div className="p-6 space-y-6">
            <BackPageHeader
                backHref="/order-requests"
                title="สร้างคำขอซื้อใหม่"
                description="ระบุรายการสินค้าที่ต้องการสั่งซื้อเพื่อให้ฝ่ายจัดซื้อดำเนินการต่อ"
            />

            <div className="max-w-5xl mx-auto">
                <OrderRequestForm
                    requesters={requesters}
                    products={products}
                />
            </div>
        </div>
    );
}
