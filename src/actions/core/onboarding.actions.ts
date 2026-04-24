'use server';

/**
 * ============================================================================
 * Onboarding Server Actions — Phase OB1
 * ============================================================================
 * These actions are called by the Genesis Wizard UI.
 *
 * Each step action:
 * 1. Re-validates input via Zod schema (SSOT — same schema as client)
 * 2. Delegates to OnboardingService (no business logic here)
 * 3. Returns ActionResponse<T>
 *
 * Security: All actions use the server-side session (auth()) — no client-passed userId
 */
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import type { ActionResponse } from '@/types/common';
import { OnboardingService } from '@/services/core/system/onboarding.service';
import {
  genesisStep1Schema,
  genesisStep2Schema,
  genesisStep3Schema,
  genesisStep4Schema,
  genesisStep5Schema,
  type GenesisStep1Input,
  type GenesisStep2Input,
  type GenesisStep3Input,
  type GenesisStep4Input,
  type GenesisStep5Input,
} from '@/schemas/core/onboarding.schema';
import type { SetupItemKey, SetupProgressReport } from '@/types/onboarding.types';

// ============================================================================
// WIZARD: Draft autosave per step
// ============================================================================

export async function saveOnboardingDraft(
  step: number,
  data: Record<string, unknown>,
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.shopId) {
      return { success: false, message: 'ไม่พบร้านค้า กรุณาเริ่มต้นใหม่' };
    }

    await OnboardingService.saveDraft(session.user.shopId, step, data);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    await logger.error('saveOnboardingDraft error', err, { step });
    return { success: false, message: err.message };
  }
}

// ============================================================================
// GENESIS: Complete wizard — create shop with all 5 steps
// ============================================================================

export async function completeGenesis(
  step1: GenesisStep1Input,
  step2: GenesisStep2Input,
  step3: GenesisStep3Input,
  step4: GenesisStep4Input,
  step5: GenesisStep5Input,
): Promise<ActionResponse<{ shopId: string }>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบก่อนสร้างร้านค้า' };
    }

    // Re-validate all steps server-side (SSOT — never trust client alone)
    const v1 = genesisStep1Schema.safeParse(step1);
    const v2 = genesisStep2Schema.safeParse(step2);
    const v3 = genesisStep3Schema.safeParse(step3);
    const v4 = genesisStep4Schema.safeParse(step4);
    const v5 = genesisStep5Schema.safeParse(step5);

    const failures = [v1, v2, v3, v4, v5]
      .map((r, i) => (!r.success ? `Step ${i + 1}: ${r.error.issues[0]?.message}` : null))
      .filter(Boolean);

    if (failures.length > 0) {
      return {
        success: false,
        message: failures.join(' | '),
        errors: Object.fromEntries(failures.map((f, i) => [`step${i + 1}`, [f!]])),
      };
    }

    const shop = await OnboardingService.createShop(
      userId,
      session.user.name,
      v1.data!,
      v2.data!,
      v3.data!,
      v4.data!,
      v5.data!,
    );

    revalidatePath('/');
    return { success: true, message: 'สร้างร้านค้าสำเร็จ', data: { shopId: shop.id } };
  } catch (error) {
    const err = error as Error;
    await logger.error('completeGenesis error', err, { path: 'completeGenesis' });
    return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการสร้างร้านค้า' };
  }
}

// ============================================================================
// SETUP PROGRESS: Get derived readiness report
// ============================================================================

export async function getSetupProgress(): Promise<ActionResponse<SetupProgressReport>> {
  try {
    const session = await auth();
    if (!session?.user?.shopId) {
      return { success: false, message: 'ไม่พบร้านค้า' };
    }

    const report = await OnboardingService.getSetupProgress(session.user.shopId);
    return { success: true, data: report };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message };
  }
}

// ============================================================================
// SETUP PROGRESS: Dismiss a checklist item
// ============================================================================

export async function dismissSetupItem(
  itemKey: SetupItemKey,
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.shopId) {
      return { success: false, message: 'ไม่พบร้านค้า' };
    }

    await OnboardingService.dismissSetupItem(session.user.shopId, itemKey);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message };
  }
}

// ============================================================================
// TUTORIAL: Update tutorial progress
// ============================================================================

export async function updateTutorialProgress(
  track: number,
  step: number,
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.shopId) {
      return { success: false, message: 'ไม่พบร้านค้า' };
    }

    await OnboardingService.updateTutorialProgress(session.user.shopId, track, step);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message };
  }
}

export async function dismissTutorial(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.shopId) {
      return { success: false, message: 'ไม่พบร้านค้า' };
    }

    await OnboardingService.dismissTutorial(session.user.shopId);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message };
  }
}

/**
 * @deprecated Use completeGenesis() for the new 5-step wizard.
 * Legacy: Backward compatibility shim for old onboarding/page.tsx
 * Accepts only shopName — uses all other fields as minimal defaults.
 * TODO: Remove after new GenesisWizard UI is deployed.
 */
export async function createShop(shopName: string): Promise<ActionResponse> {
  return completeGenesis(
    // Step 1: Identity
    { name: shopName, industryType: 'RETAIL', phone: '', logo: null },
    // Step 2: Legal (no VAT)
    { isVatRegistered: false, taxId: null, branchCode: null, address: null, legalEntityName: null },
    // Step 3: Financial defaults
    { defaultCurrency: 'THB', invoicePrefix: 'INV', paymentMethods: ['CASH', 'TRANSFER'], fiscalYearStart: 1, promptPayId: null, defaultAccountName: 'เงินสด', defaultAccountType: 'CASH', defaultBankName: null },
    // Step 4: Team
    { roleTemplate: 'SKIP', inviteEmail: null },
    // Step 5: Starting data
    { onboardingMode: 'EMPTY', importFileUrl: null },
  );
}
