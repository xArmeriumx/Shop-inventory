import { Suspense } from 'react';
import { getShop } from '@/actions/core/shop.actions';
import { ShopSettings } from '@/components/core/settings/shop-settings';
import Loading from '@/app/(dashboard)/loading';

export default async function ShopSettingsPage() {
    const result = await getShop();

    if (!result.success) {
        return (
            <div className="p-8 text-center bg-muted/20 rounded-lg border border-dashed">
                <p className="text-muted-foreground">{result.message || 'ไม่สามารถโหลดข้อมูลร้านค้าได้'}</p>
            </div>
        );
    }

    const shop = result.data;

    return (
        <Suspense fallback={<Loading />}>
            <ShopSettings shopData={shop} />
        </Suspense>
    );
}
