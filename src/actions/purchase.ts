'use server';

import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { PurchaseService } from '@/services';
import { revalidatePath } from 'next/cache';

/**
 * Bulk create draft PRs from suggested reorder items
 */
export async function createPRFromSuggestions(entries: { productId: string, quantity: number, supplierId?: string }[]) {
  const ctx = await requirePermission('PURCHASE_CREATE');
  try {
    const result = await PurchaseService.createBulkDraftPRs(entries, ctx);
    revalidatePath('/purchases');
    revalidatePath('/intelligence');
    return result;
  } catch (error: any) {
    await logger.error('Failed to create PRs from suggestions', error, { entryCount: entries.length });
    throw new Error('ไม่สามารถสร้างใบขอซื้อได้ กรุณาลองใหม่อีกครั้ง');
  }
}
