'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function updateUserActivity() {
  const session = await auth();
  if (!session?.user?.id) return;

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: new Date() },
    });
  } catch (error) {
    // Fail silently - background task
    logger.error('Failed to update user activity', error as Error, { path: 'updateUserActivity' }).catch(() => {});
  }
}
