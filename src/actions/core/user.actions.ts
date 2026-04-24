'use server';

import { getSessionContext } from '@/lib/auth-guard';
import { IamService } from '@/services';

export async function updateUserActivity() {
  const ctx = await getSessionContext();
  if (!ctx) return;

  await IamService.updateUserActivity(ctx.userId);
}
