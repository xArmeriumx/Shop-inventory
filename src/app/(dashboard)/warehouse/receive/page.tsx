'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MobileReceivePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/purchases/receiving');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground animate-pulse">กำลังสลับไปยังศูนย์การรับสินค้าแบบใหม่...</p>
      </div>
    </div>
  );
}
