import { Suspense } from 'react';
import { getUserProfile } from '@/actions/core/settings.actions';
import { ProfileSettings } from '@/components/core/settings/profile-settings';
import Loading from '@/app/(dashboard)/loading';

export default async function ProfileSettingsPage() {
    const result = await getUserProfile();

    if (!result.success) {
        return (
            <div className="p-8 text-center bg-muted/20 rounded-lg border border-dashed">
                <p className="text-muted-foreground">{result.message || 'ไม่พบข้อมูลผู้ใช้งาน'}</p>
            </div>
        );
    }

    const user = result.data;

    return (
        <Suspense fallback={<Loading />}>
            <ProfileSettings initialData={user} />
        </Suspense>
    );
}
