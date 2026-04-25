/**
 * ============================================================================
 * OnboardingService — Phase OB1 (Fixed)
 * ============================================================================
 * Orchestrates the Genesis Wizard and Setup Progress system.
 *
 * Design principles:
 * - Setup readiness is DERIVED from real system counts (never stored as flags)
 * - Wizard draft is autosaved in OnboardingProgress.wizardDraft (JSON)
 * - All multi-step creation runs inside a single DB transaction
 * - Industry presets auto-seed product categories on genesis completion
 * - isDemo flag on seed data prevents accounting/tax contamination
 *
 * Fix Notes (v1.1):
 * - BankAccount requires glAccountId (FK to Account) — skipped at genesis,
 *   user creates it properly from Settings > Accounting after wizard
 * - LookupType.code is a Prisma enum (LookupTypeCode), not a plain string
 * - promptPayId / inviteEmail empty strings coerced to null
 * - Added wizardDraftVersion support (v1)
 */
import { db, runInTransaction } from '@/lib/db';
import { ServiceError } from '@/types/common';
import { AuditService } from './audit.service';
import { LookupTypeCode } from '@prisma/client';
import type { RequestContext } from '@/types/common';
import {
  IndustryType,
  OnboardingMode,
  RoleTemplate,
  SETUP_ITEM_KEYS,
  SETUP_ITEM_LEVELS,
  INDUSTRY_PRESETS,
  type SetupItemKey,
  type SetupItemStatus,
  type SetupProgressReport,
} from '@/types/onboarding.types';
import type {
  GenesisStep1Input,
  GenesisStep2Input,
  GenesisStep3Input,
  GenesisStep4Input,
  GenesisStep5Input,
} from '@/schemas/core/onboarding.schema';
import type { Permission } from '@prisma/client';

// ============================================================================
// RBAC: Permissions for Owner role (auto-assigned at genesis)
// Only use Permission values that exist in the Prisma enum
// ============================================================================

const OWNER_PERMISSIONS: Permission[] = [
  'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW_COST',
  'STOCK_VIEW_HISTORY', 'STOCK_ADJUST', 'STOCK_TAKE_APPROVE', 'WAREHOUSE_MANAGE',
  'SALE_VIEW', 'SALE_CREATE', 'SALE_UPDATE', 'SALE_CANCEL', 'SALE_VIEW_PROFIT', 'SALE_EDIT_LOCKED',
  'INVOICE_VIEW', 'INVOICE_CREATE', 'INVOICE_POST', 'INVOICE_CANCEL', 'INVOICE_MANAGE',
  'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_UPDATE', 'PURCHASE_VOID',
  'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
  'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_DELETE',
  'RETURN_VIEW', 'RETURN_CREATE',
  'FINANCE_VIEW_LEDGER', 'FINANCE_PAYMENT_VOID', 'FINANCE_MANAGE_CREDIT',
  'SETTINGS_SHOP', 'SETTINGS_ROLES', 'AUDIT_VIEW',
  'REPORT_VIEW_SALES', 'REPORT_EXPORT',
  'POS_ACCESS',
  'SHIPMENT_VIEW', 'SHIPMENT_CREATE', 'SHIPMENT_EDIT', 'SHIPMENT_CANCEL',
  'QUOTATION_VIEW', 'QUOTATION_CREATE', 'QUOTATION_EDIT', 'QUOTATION_CONFIRM',
  'ORDER_REQUEST_VIEW', 'ORDER_REQUEST_CREATE', 'ORDER_REQUEST_SUBMIT',
  'APPROVAL_VIEW', 'APPROVAL_ACTION',
  'DELIVERY_VIEW', 'DELIVERY_VALIDATE',
  'TAX_SETTINGS_VIEW', 'TAX_SETTINGS_MANAGE', 'TAX_REPORT_VIEW', 'TAX_REPORT_POST',
];

// ============================================================================
// Service
// ============================================================================

const CURRENT_WIZARD_VERSION = 1;

export const OnboardingService = {

  // --------------------------------------------------------------------------
  // CHECK: Has the user already created a shop?
  // --------------------------------------------------------------------------
  async hasShop(userId: string): Promise<boolean> {
    const membership = await db.shopMember.findFirst({ where: { userId } });
    return !!membership;
  },

  // --------------------------------------------------------------------------
  // WIZARD: Save a partial draft step (autosave pattern)
  // --------------------------------------------------------------------------
  async saveDraft(shopId: string, step: number, data: Record<string, unknown>): Promise<void> {
    const existing = await (db as any).onboardingProgress.findUnique({ where: { shopId } });
    const draftState = (existing?.wizardDraft as any) ?? { v: CURRENT_WIZARD_VERSION };

    // Version Check: If draft is from an old schema version, reset to current version
    const currentDraft = draftState.v === CURRENT_WIZARD_VERSION ? (draftState.steps ?? {}) : {};

    const updatedDraft = {
      v: CURRENT_WIZARD_VERSION,
      steps: { ...currentDraft, [`step${step}`]: data }
    };

    await (db as any).onboardingProgress.upsert({
      where: { shopId },
      create: {
        shopId,
        wizardDraft: updatedDraft,
        dismissedSetupItems: []
      },
      update: { wizardDraft: updatedDraft },
    });

    await db.shop.update({
      where: { id: shopId },
      data: { genesisStep: Math.max(step, 1) } as any,
    });
  },

  // --------------------------------------------------------------------------
  // WIZARD: Get current draft (for resume)
  // --------------------------------------------------------------------------
  async getDraft(shopId: string): Promise<Record<string, unknown>> {
    const progress = await (db as any).onboardingProgress.findUnique({ where: { shopId } });
    const draftState = (progress?.wizardDraft as any);

    if (!draftState || draftState.v !== CURRENT_WIZARD_VERSION) {
      return {};
    }

    return (draftState.steps as Record<string, unknown>) ?? {};
  },

  // --------------------------------------------------------------------------
  // GENESIS: Create shop + all genesis data in one atomic transaction
  // --------------------------------------------------------------------------
  async createShop(
    userId: string,
    userName: string | null | undefined,
    step1: GenesisStep1Input,
    step2: GenesisStep2Input,
    step3: GenesisStep3Input,
    step4: GenesisStep4Input,
    step5: GenesisStep5Input,
  ) {
    // Guard: prevent duplicate shop creation
    const existingMembership = await db.shopMember.findFirst({ where: { userId } });
    if (existingMembership) {
      throw new ServiceError('คุณมีร้านค้าอยู่แล้ว');
    }

    // Coerce empty strings to null before persisting
    const promptPay = step3.promptPayId?.trim() || null;
    const inviteEmail = step4.inviteEmail?.trim() || null;

    const auditCtx: RequestContext = {
      userId,
      shopId: '',
      permissions: OWNER_PERMISSIONS,
      isOwner: true,
    };

    return AuditService.runWithAudit(
      auditCtx,
      {
        action: 'IAM_SHOP_GENESIS',
        targetType: 'Shop',
        targetId: 'NEW',
        note: `สร้างร้านค้าใหม่: ${step1.name} (${step1.industryType})`,
      },
      async () => {
        return runInTransaction(undefined, async (tx) => {

      // ── Step A: Create the Shop ──────────────────────────────────────────
      const shop = await tx.shop.create({
        data: {
          userId,
          name: step1.name,
          phone: step1.phone,
          logo: step1.logo ?? null,
          taxId: step2.taxId ?? null,
          address: step2.address ?? null,
          invoicePrefix: step3.invoicePrefix,
          promptPayId: promptPay,
          defaultCurrency: step3.defaultCurrency,
          fiscalYearStart: step3.fiscalYearStart,
          industryType: step1.industryType,
          onboardingMode: step5.onboardingMode,
          legalEntityName: step2.legalEntityName ?? null,
          onboardingCompletedAt: new Date(),
          genesisStep: 5,
        } as any,
      });

      // ── Step B: Create Owner Role ──────────────────────────────────────────
      const ownerRole = await tx.role.create({
        data: {
          name: 'Owner',
          description: 'เจ้าของร้าน — มีสิทธิ์ทั้งหมด',
          permissions: OWNER_PERMISSIONS,
          isSystem: true,
          isDefault: false,
          shopId: shop.id,
        },
      });

      // ── Step C: Create Owner Membership ───────────────────────────────────
      await tx.shopMember.create({
        data: {
          userId,
          shopId: shop.id,
          roleId: ownerRole.id,
          isOwner: true,
        },
      });

      // ── Step D: CompanyTaxProfile (if VAT registered) ─────────────────────
      if (step2.isVatRegistered && step2.taxId) {
        await (tx as any).companyTaxProfile.create({
          data: {
            shopId: shop.id,
            isVatRegistered: true,
            taxPayerId: step2.taxId,
            branchCode: step2.branchCode ?? '00000',
            registeredAddress: step2.address ?? '',
            legalName: step2.legalEntityName ?? step1.name,
          },
        });
      }

      // ── Step E: BankAccount ─────────────────────────────────────────────
      // NOTE: BankAccount requires glAccountId (FK to Account/Chart of Accounts).
      // A GL Account doesn't exist yet at genesis — user configures this post-wizard
      // from Settings > Accounting. Skipping here intentionally.
      // The setup checklist item BANK_ACCOUNT will prompt them to complete this.

      // ── Step F: Pre-seed Role Templates (if TEAM selected) ────────────────
      if (step4.roleTemplate === RoleTemplate.TEAM) {
        await tx.role.createMany({
          data: [
            {
              name: 'ผู้จัดการ',
              description: 'จัดการยอดขาย สต็อก และรายงาน',
              permissions: ['SALE_VIEW', 'SALE_CREATE', 'PRODUCT_VIEW', 'STOCK_VIEW_HISTORY', 'REPORT_VIEW_SALES', 'REPORT_EXPORT', 'CUSTOMER_VIEW'],
              isSystem: false,
              isDefault: false,
              shopId: shop.id,
            },
            {
              name: 'พนักงานขาย',
              description: 'บันทึกการขายและดูสต็อก',
              permissions: ['SALE_VIEW', 'SALE_CREATE', 'PRODUCT_VIEW', 'CUSTOMER_VIEW', 'CUSTOMER_CREATE'],
              isSystem: false,
              isDefault: true,
              shopId: shop.id,
            },
            {
              name: 'พนักงานสต็อก',
              description: 'จัดการสินค้าและสต็อก',
              permissions: ['PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'STOCK_VIEW_HISTORY', 'STOCK_ADJUST'],
              isSystem: false,
              isDefault: false,
              shopId: shop.id,
            },
          ],
        });
      }

      // ── Step G: Industry preset — seed product categories ─────────────────
      const preset = INDUSTRY_PRESETS[step1.industryType as IndustryType];
      if (preset?.defaultCategories?.length) {
        // LookupType.code is a Prisma enum (LookupTypeCode) — use the enum value directly
        const lookupType = await tx.lookupType.findUnique({
          where: { code: LookupTypeCode.PRODUCT_CATEGORY },
        });

        if (lookupType) {
          await tx.lookupValue.createMany({
            data: preset.defaultCategories.map((name, idx) => ({
              lookupTypeId: lookupType.id,
              shopId: shop.id,
              userId,
              code: `CAT_${idx + 1}`,
              name,
              order: idx,
              isActive: true,
            })),
            skipDuplicates: true,
          });
        }
      }

      // ── Step H: Demo data seeding ─────────────────────────────────────────
      if (step5.onboardingMode === OnboardingMode.DEMO) {
        await OnboardingService._seedDemoData(shop.id, userId, tx);
      }

      // ── Step I: Initialize OnboardingProgress ─────────────────────────────
      await (tx as any).onboardingProgress.create({
        data: {
          shopId: shop.id,
          wizardDraft: null,
          tutorialTrack: 0,
          tutorialStep: 0,
          dismissedSetupItems: [],
        },
      });

        return shop;
      });
    });
  },

  // --------------------------------------------------------------------------
  // SETUP PROGRESS: Derive readiness from real system state (never stored)
  // --------------------------------------------------------------------------
  async getSetupProgress(shopId: string): Promise<SetupProgressReport> {
    const [
      taxProfileCount,
      bankAccountCount,
      accountCount,
      productCount,
      customerCount,
      supplierCount,
      shop,
      saleCount,
      purchaseCount,
      invoiceCount,
      paymentCount,
      periodCount,
      bankStatementCount,
      taxCodeCount,
      whtCodeCount,
      progress,
    ] = await Promise.all([
      (db as any).companyTaxProfile.count({ where: { shopId } }),
      db.bankAccount.count({ where: { shopId } }),
      (db as any).account.count({ where: { shopId } }),
      db.product.count({ where: { shopId, deletedAt: null } }),
      db.customer.count({ where: { shopId, deletedAt: null } }),
      db.supplier.count({ where: { shopId, deletedAt: null } }),
      db.shop.findUnique({ where: { id: shopId }, select: { signatoryName: true } as any }),
      db.sale.count({ where: { shopId, status: { not: 'CANCELLED' } } }),
      db.purchase.count({ where: { shopId, status: { not: 'CANCELLED' } } }),
      (db as any).invoice.count({ where: { shopId } }),
      (db as any).payment.count({ where: { shopId } }),
      (db as any).accountingPeriod.count({ where: { shopId } }),
      db.bankStatement.count({ where: { bankAccount: { shopId } } }),
      (db as any).taxCode.count({ where: { shopId } }),
      (db as any).whtCode.count({ where: { shopId } }),
      (db as any).onboardingProgress.findUnique({ where: { shopId } }),
    ]);

    const dismissedItems: string[] = progress?.dismissedSetupItems ?? [];

    const derivedStatus: Record<SetupItemKey, boolean> = {
      [SETUP_ITEM_KEYS.TAX_PROFILE]: taxProfileCount > 0,
      [SETUP_ITEM_KEYS.BANK_ACCOUNT]: bankAccountCount > 0,
      [SETUP_ITEM_KEYS.CHART_OF_ACCTS]: accountCount > 5,
      [SETUP_ITEM_KEYS.HAS_PRODUCT]: productCount > 0,
      [SETUP_ITEM_KEYS.HAS_CUSTOMER]: customerCount > 0,
      [SETUP_ITEM_KEYS.HAS_SUPPLIER]: supplierCount > 0,
      [SETUP_ITEM_KEYS.SIGNATORY]: !!(shop as any)?.signatoryName,
      [SETUP_ITEM_KEYS.FIRST_SALE]: saleCount > 0,
      [SETUP_ITEM_KEYS.FIRST_PURCHASE]: purchaseCount > 0,
      [SETUP_ITEM_KEYS.FIRST_INVOICE]: invoiceCount > 0,
      [SETUP_ITEM_KEYS.FIRST_PAYMENT]: paymentCount > 0,
      [SETUP_ITEM_KEYS.ACCT_PERIOD]: periodCount > 0,
      [SETUP_ITEM_KEYS.BANK_RECONCILE]: bankStatementCount > 0,
      [SETUP_ITEM_KEYS.VAT_SETTINGS]: taxCodeCount > 0,
      [SETUP_ITEM_KEYS.WHT_SETTINGS]: whtCodeCount > 0,
    };

    const items: SetupItemStatus[] = (Object.keys(SETUP_ITEM_KEYS) as Array<keyof typeof SETUP_ITEM_KEYS>).map((k) => {
      const key = SETUP_ITEM_KEYS[k];
      return {
        key,
        level: SETUP_ITEM_LEVELS[key],
        isDone: derivedStatus[key],
        isDismissed: dismissedItems.includes(key),
      };
    });

    const completedItems = items.filter((i) => i.isDone).length;
    const level1Items = items.filter((i) => i.level === 1);
    const isGoLiveReady = level1Items.every((i) => i.isDone);
    const isFullyReady = items.every((i) => i.isDone);

    return {
      items,
      totalItems: items.length,
      completedItems,
      progressPercent: Math.round((completedItems / items.length) * 100),
      isGoLiveReady,
      isFullyReady,
    };
  },

  // --------------------------------------------------------------------------
  // SETUP PROGRESS: Dismiss a checklist item
  // --------------------------------------------------------------------------
  async dismissSetupItem(shopId: string, itemKey: SetupItemKey): Promise<void> {
    const progress = await (db as any).onboardingProgress.findUnique({ where: { shopId } });
    const current: string[] = progress?.dismissedSetupItems ?? [];

    if (!current.includes(itemKey)) {
      await (db as any).onboardingProgress.update({
        where: { shopId },
        data: { dismissedSetupItems: [...current, itemKey] },
      });
    }
  },

  // --------------------------------------------------------------------------
  // TUTORIAL: Update tutorial progress
  // --------------------------------------------------------------------------
  async updateTutorialProgress(shopId: string, track: number, step: number): Promise<void> {
    await (db as any).onboardingProgress.upsert({
      where: { shopId },
      create: { shopId, tutorialTrack: track, tutorialStep: step, dismissedSetupItems: [] },
      update: { tutorialTrack: track, tutorialStep: step },
    });
  },

  async dismissTutorial(shopId: string): Promise<void> {
    await (db as any).onboardingProgress.upsert({
      where: { shopId },
      create: { shopId, tutorialDismissed: true, dismissedSetupItems: [] },
      update: { tutorialDismissed: true },
    });
  },

  // --------------------------------------------------------------------------
  // PRIVATE: Seed demo data (tagged with [DEMO] prefix)
  // --------------------------------------------------------------------------
  async _seedDemoData(shopId: string, userId: string, tx: any): Promise<void> {
    // Demo Customer
    await tx.customer.create({
      data: {
        shopId, userId,
        name: '[DEMO] ลูกค้าตัวอย่าง',
        phone: '0801234567',
        email: 'demo@example.com',
      },
    });

    // Demo Supplier
    await tx.supplier.create({
      data: {
        shopId, userId,
        name: '[DEMO] ผู้จัดจำหน่ายตัวอย่าง',
        phone: '0891234567',
      },
    });

    // Demo Products (5 items)
    await tx.product.createMany({
      data: [
        { name: '[DEMO] สินค้า A', sku: 'DEMO-001', costPrice: 100, salePrice: 150, stock: 50, shopId, userId, category: 'สินค้าทดสอบ' },
        { name: '[DEMO] สินค้า B', sku: 'DEMO-002', costPrice: 200, salePrice: 280, stock: 30, shopId, userId, category: 'สินค้าทดสอบ' },
        { name: '[DEMO] สินค้า C', sku: 'DEMO-003', costPrice: 50, salePrice: 80, stock: 100, shopId, userId, category: 'สินค้าทดสอบ' },
        { name: '[DEMO] สินค้า D', sku: 'DEMO-004', costPrice: 500, salePrice: 650, stock: 20, shopId, userId, category: 'สินค้าทดสอบ' },
        { name: '[DEMO] สินค้า E', sku: 'DEMO-005', costPrice: 30, salePrice: 45, stock: 200, shopId, userId, category: 'สินค้าทดสอบ' },
      ],
    });
  },

  async getTutorialState(shopId: string) {
    return (db as any).onboardingProgress.findUnique({
      where: { shopId },
      select: { tutorialTrack: true, tutorialStep: true, tutorialDismissed: true },
    });
  },
};
