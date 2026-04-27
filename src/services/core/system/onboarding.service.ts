/**
 * ============================================================================
 * OnboardingService — Phase OB1 (Fixed)
 * ============================================================================
 * Orchestrates the Genesis Wizard and Setup Progress system.
 */
import { db, runInTransaction } from '@/lib/db';
import { ServiceError } from '@/types/common';
import { AuditService } from './audit.service';
import { WarehouseService } from '../../inventory/warehouse.service';
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

const CURRENT_WIZARD_VERSION = 1;

export const OnboardingService = {
  async hasShop(userId: string): Promise<boolean> {
    const membership = await db.shopMember.findFirst({ where: { userId } });
    return !!membership;
  },

  async saveDraft(shopId: string, step: number, data: Record<string, unknown>): Promise<void> {
    const existing = await (db as any).onboardingProgress.findUnique({ where: { shopId } });
    const draftState = (existing?.wizardDraft as any) ?? { v: CURRENT_WIZARD_VERSION };
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

  async getDraft(shopId: string): Promise<Record<string, unknown>> {
    const progress = await (db as any).onboardingProgress.findUnique({ where: { shopId } });
    const draftState = (progress?.wizardDraft as any);
    if (!draftState || draftState.v !== CURRENT_WIZARD_VERSION) return {};
    return (draftState.steps as Record<string, unknown>) ?? {};
  },

  async createShop(
    userId: string,
    userName: string | null | undefined,
    step1: GenesisStep1Input,
    step2: GenesisStep2Input,
    step3: GenesisStep3Input,
    step4: GenesisStep4Input,
    step5: GenesisStep5Input,
  ) {
    const existingMembership = await db.shopMember.findFirst({ where: { userId } });
    if (existingMembership) throw new ServiceError('คุณมีร้านค้าอยู่แล้ว');

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

          const defaultWarehouse = await tx.warehouse.create({
            data: {
              name: 'คลังสินค้าหลัก',
              code: 'WH-MAIN',
              isDefault: true,
              isActive: true,
              shopId: shop.id,
            }
          });

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

          await tx.shopMember.create({
            data: {
              userId, shopId: shop.id, roleId: ownerRole.id, isOwner: true,
            },
          });

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

          if (step4.roleTemplate === RoleTemplate.TEAM) {
            await tx.role.createMany({
              data: [
                {
                  name: 'ผู้จัดการ',
                  description: 'จัดการยอดขาย สต็อก และรายงาน',
                  permissions: ['SALE_VIEW', 'SALE_CREATE', 'PRODUCT_VIEW', 'STOCK_VIEW_HISTORY', 'REPORT_VIEW_SALES', 'REPORT_EXPORT', 'CUSTOMER_VIEW'],
                  isSystem: false, isDefault: false, shopId: shop.id,
                },
                {
                  name: 'พนักงานขาย',
                  description: 'บันทึกการขายและดูสต็อก',
                  permissions: ['SALE_VIEW', 'SALE_CREATE', 'PRODUCT_VIEW', 'CUSTOMER_VIEW', 'CUSTOMER_CREATE'],
                  isSystem: false, isDefault: true, shopId: shop.id,
                },
                {
                  name: 'พนักงานสต็อก',
                  description: 'จัดการสินค้าและสต็อก',
                  permissions: ['PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'STOCK_VIEW_HISTORY', 'STOCK_ADJUST'],
                  isSystem: false, isDefault: false, shopId: shop.id,
                },
              ],
            });
          }

          const preset = INDUSTRY_PRESETS[step1.industryType as IndustryType];
          if (preset?.defaultCategories?.length) {
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

          if (step5.onboardingMode === OnboardingMode.DEMO) {
            await OnboardingService._seedDemoData(shop.id, userId, tx, defaultWarehouse.id);
          }

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
      warehouseCount,
      progress,
    ] = await Promise.all([
      (db as any).companyTaxProfile.count({ where: { shopId } }),
      db.bankAccount.count({ where: { shopId } }),
      (db as any).account.count({ where: { shopId } }),
      db.product.count({ where: { shopId, deletedAt: null } }),
      db.customer.count({ where: { shopId, deletedAt: null } }),
      db.supplier.count({ where: { shopId, deletedAt: null } }),
      db.shop.findUnique({ where: { id: shopId }, select: { signatoryName: true, inventoryMode: true } as any }),
      db.sale.count({ where: { shopId, status: { not: 'CANCELLED' } } }),
      db.purchase.count({ where: { shopId, status: { not: 'CANCELLED' } } }),
      (db as any).invoice.count({ where: { shopId } }),
      (db as any).payment.count({ where: { shopId } }),
      (db as any).accountingPeriod.count({ where: { shopId } }),
      db.bankStatement.count({ where: { bankAccount: { shopId } } }),
      (db as any).taxCode.count({ where: { shopId } }),
      (db as any).whtCode.count({ where: { shopId } }),
      db.warehouse.count({ where: { shopId, isActive: true } }),
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
      [SETUP_ITEM_KEYS.INVENTORY_MODE]: (shop as any)?.inventoryMode !== 'SIMPLE',
      [SETUP_ITEM_KEYS.WAREHOUSE_SETUP]: warehouseCount > 1 || (shop as any)?.inventoryMode !== 'MULTI',
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

  async _seedDemoData(shopId: string, userId: string, tx: any, defaultWarehouseId?: string): Promise<void> {
    await tx.customer.create({
      data: {
        shopId, userId,
        name: '[DEMO] ลูกค้าตัวอย่าง',
        phone: '0801234567',
        email: 'demo@example.com',
      },
    });

    await tx.supplier.create({
      data: {
        shopId, userId,
        name: '[DEMO] ผู้จัดจำหน่ายตัวอย่าง',
        phone: '0891234567',
      },
    });

    const demoProducts = [
      { name: '[DEMO] สินค้า A', sku: 'DEMO-001', costPrice: 100, salePrice: 150, stock: 50, shopId, userId, category: 'สินค้าทดสอบ' },
      { name: '[DEMO] สินค้า B', sku: 'DEMO-002', costPrice: 200, salePrice: 280, stock: 30, shopId, userId, category: 'สินค้าทดสอบ' },
      { name: '[DEMO] สินค้า C', sku: 'DEMO-003', costPrice: 50, salePrice: 80, stock: 100, shopId, userId, category: 'สินค้าทดสอบ' },
      { name: '[DEMO] สินค้า D', sku: 'DEMO-004', costPrice: 500, salePrice: 650, stock: 20, shopId, userId, category: 'สินค้าทดสอบ' },
      { name: '[DEMO] สินค้า E', sku: 'DEMO-005', costPrice: 30, salePrice: 45, stock: 200, shopId, userId, category: 'สินค้าทดสอบ' },
    ];

    const ctx: RequestContext = { shopId, userId, permissions: [], isOwner: true };
    for (const p of demoProducts) {
      const { stock, ...productData } = p;
      const product = await tx.product.create({ data: { ...productData, stock: 0 } });
      if (defaultWarehouseId && stock > 0) {
        await WarehouseService.adjustWarehouseStock(ctx, {
          warehouseId: defaultWarehouseId,
          productId: product.id,
          delta: stock
        }, tx);
      }
    }
  },

  async getTutorialState(shopId: string) {
    return (db as any).onboardingProgress.findUnique({
      where: { shopId },
      select: { tutorialTrack: true, tutorialStep: true, tutorialDismissed: true },
    });
  },
};
