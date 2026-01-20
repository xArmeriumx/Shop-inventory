'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

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
    console.error('Failed the update user activity', error);
  }
}
