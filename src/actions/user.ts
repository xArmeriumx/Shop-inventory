'use server';

import { auth } from '@/lib/auth';
import { IamService } from '@/services';

export async function updateUserActivity() {
  const session = await auth();
  if (!session?.user?.id) return;

  await IamService.updateUserActivity(session.user.id);
}
