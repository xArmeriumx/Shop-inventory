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
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { ServiceError } from '@/types/common';
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

// ============================================================================
// WIZARD: Draft autosave per step
// ============================================================================

export async function saveOnboardingDraft(
  step: number,
  data: Record<string, unknown>,
): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const session = await auth();
    if (!session?.user?.shopId) {
      throw new ServiceError('ไม่พบร้านค้า กรุณาเริ่มต้นใหม่');
    }

    await OnboardingService.saveDraft(session.user.shopId, step, data);
    return null;
  }, { context: { action: 'saveOnboardingDraft', step } });
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
  return handleAction(async () => {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new ServiceError('กรุณาเข้าสู่ระบบก่อนสร้างร้านค้า');
    }

    // Re-validate all steps server-side (SSOT)
    const v1 = genesisStep1Schema.parse(step1);
    const v2 = genesisStep2Schema.parse(step2);
    const v3 = genesisStep3Schema.parse(step3);
    const v4 = genesisStep4Schema.parse(step4);
    const v5 = genesisStep5Schema.parse(step5);

    const shop = await OnboardingService.createShop(
      userId,
      session.user.name,
      v1,
      v2,
      v3,
      v4,
      v5,
    );

    revalidatePath('/');
    return { shopId: shop.id };
  }, { context: { action: 'completeGenesis' } });
}

// ============================================================================
// SETUP PROGRESS: Get derived readiness report
// ============================================================================

export async function getSetupProgress(): Promise<ActionResponse<SetupProgressReport>> {
  return handleAction(async () => {
    const session = await auth();
    if (!session?.user?.shopId) {
      throw new ServiceError('ไม่พบร้านค้า');
    }

    return OnboardingService.getSetupProgress(session.user.shopId);
  }, { context: { action: 'getSetupProgress' } });
}

// ============================================================================
// SETUP PROGRESS: Dismiss a checklist item
// ============================================================================

export async function dismissSetupItem(
  itemKey: SetupItemKey,
): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const session = await auth();
    if (!session?.user?.shopId) {
      throw new ServiceError('ไม่พบร้านค้า');
    }

    await OnboardingService.dismissSetupItem(session.user.shopId, itemKey);
    return null;
  }, { context: { action: 'dismissSetupItem', itemKey } });
}

// ============================================================================
// TUTORIAL: Update tutorial progress
// ============================================================================

export async function updateTutorialProgress(
  track: number,
  step: number,
): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const session = await auth();
    if (!session?.user?.shopId) {
      throw new ServiceError('ไม่พบร้านค้า');
    }

    await OnboardingService.updateTutorialProgress(session.user.shopId, track, step);
    return null;
  }, { context: { action: 'updateTutorialProgress', track, step } });
}

export async function dismissTutorial(): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const session = await auth();
    if (!session?.user?.shopId) {
      throw new ServiceError('ไม่พบร้านค้า');
    }

    await OnboardingService.dismissTutorial(session.user.shopId);
    return null;
  }, { context: { action: 'dismissTutorial' } });
}

/**
 * @deprecated Use completeGenesis() for the new 5-step wizard.
 */
export async function createShop(shopName: string): Promise<ActionResponse<any>> {
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
