import { Suspense } from 'react';
import { Settings } from 'lucide-react';

import { getUserProfile } from '@/actions/settings';
import { SettingsForm } from '@/components/features/settings/settings-form';
import Loading from '@/app/(dashboard)/loading';

async function SettingsContent() {
  const user = await getUserProfile();

  return (
    <SettingsForm initialData={user} />
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่า</h1>
      </div>
      
      <Suspense fallback={<Loading />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
