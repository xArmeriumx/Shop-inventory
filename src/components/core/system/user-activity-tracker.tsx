'use client';

import { useEffect } from 'react';
import { updateUserActivity } from '@/actions/core/user.actions';
import { useSession } from 'next-auth/react';

export function UserActivityTracker() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return;

    // Initial update
    updateUserActivity();

    // Update every 2 minutes (threshold is 5 mins)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateUserActivity();
      }
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session]);

  return null;
}
