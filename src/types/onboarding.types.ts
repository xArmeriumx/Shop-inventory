/**
 * ============================================================================
 * Onboarding Domain Types — SSOT (Phase OB1)
 * ============================================================================
 * All enums, constants, and interfaces for the Genesis Wizard and Setup
 * Progress system live here. Import from this file only.
 *
 * Design rules:
 * - IndustryType, OnboardingMode are string unions (not Prisma enums) for flexibility
 * - SetupChecklistItem keys are the ONLY source of truth for checklist structure
 * - Readiness is DERIVED from system counts — this file defines the derivation contract
 */

// ============================================================================
// Enums (as const objects — same pattern as core.types.ts)
// ============================================================================

export const IndustryType = {
    RETAIL: 'RETAIL',      // ร้านค้าปลีก
    WHOLESALE: 'WHOLESALE',   // ค้าส่ง
    MANUFACTURE: 'MANUFACTURE', // ผู้ผลิต
    FOOD: 'FOOD',        // อาหารและเครื่องดื่ม
    SERVICE: 'SERVICE',     // ธุรกิจบริการ
    OTHER: 'OTHER',       // อื่นๆ
} as const;

export type IndustryType = (typeof IndustryType)[keyof typeof IndustryType];

export const OnboardingMode = {
    DEMO: 'DEMO',   // โหลดข้อมูลทดสอบ
    IMPORT: 'IMPORT', // นำเข้าจาก CSV/Excel
    EMPTY: 'EMPTY',  // เริ่มว่างเปล่า
} as const;

export type OnboardingMode = (typeof OnboardingMode)[keyof typeof OnboardingMode];

export const RoleTemplate = {
    SOLO: 'SOLO',   // เจ้าของคนเดียว
    TEAM: 'TEAM',   // SME Team (ผู้จัดการ + พนักงาน)
    SKIP: 'SKIP',   // ข้ามไปตั้งค่าเองในภายหลัง
} as const;

export type RoleTemplate = (typeof RoleTemplate)[keyof typeof RoleTemplate];

// ============================================================================
// Genesis Wizard (5 Steps)
// ============================================================================

export interface GenesisWizardState {
    currentStep: number; // 1–5
    completedSteps: number[];
    draft: Partial<GenesisDraft>;
}

/** Full draft shape — stored as JSON in OnboardingProgress.wizardDraft */
export interface GenesisDraft {
    step1: GenesisStep1Data;
    step2: GenesisStep2Data;
    step3: GenesisStep3Data;
    step4: GenesisStep4Data;
    step5: GenesisStep5Data;
}

export interface GenesisStep1Data {
    name: string;
    industryType: IndustryType;
    phone: string;
    logo?: string | null;
}

export interface GenesisStep2Data {
    isVatRegistered: boolean;
    taxId?: string | null;
    branchCode?: string | null;   // '00000' = สำนักงานใหญ่
    address?: string | null;
    legalEntityName?: string | null;
}

export interface GenesisStep3Data {
    defaultCurrency: string;
    invoicePrefix: string;
    paymentMethods: string[];       // ['CASH', 'TRANSFER', 'CREDIT']
    fiscalYearStart: number;        // 1–12
    promptPayId?: string | null;
    // Default bank/cash account (name only — BankAccount record created by service)
    defaultAccountName?: string | null;
    defaultAccountType: 'CASH' | 'BANK';
    defaultBankName?: string | null;
}

export interface GenesisStep4Data {
    roleTemplate: RoleTemplate;
    inviteEmail?: string | null;    // Optional: invite first member immediately
}

export interface GenesisStep5Data {
    onboardingMode: OnboardingMode;
    importFileUrl?: string | null;  // For IMPORT mode
}

// ============================================================================
// Setup Progress Checklist
// ============================================================================

/**
 * All checklist item keys.
 * These keys are used in OnboardingProgress.dismissedSetupItems[].
 * Readiness is COMPUTED from system state — never stored as boolean.
 */
export const SETUP_ITEM_KEYS = {
    // Level 1: Go-Live Blockers
    TAX_PROFILE: 'tax_profile',       // companyTaxProfile != null
    BANK_ACCOUNT: 'bank_account',      // BankAccount.count > 0
    CHART_OF_ACCTS: 'chart_of_accounts', // Account.count > 5
    HAS_PRODUCT: 'has_product',       // Product.count > 0
    HAS_CUSTOMER: 'has_customer',      // Customer.count > 0
    HAS_SUPPLIER: 'has_supplier',      // Supplier.count > 0
    SIGNATORY: 'signatory',         // Shop.signatoryName != null

    // Level 2: First Transaction Readiness
    FIRST_SALE: 'first_sale',        // Sale.count > 0
    FIRST_PURCHASE: 'first_purchase',    // Purchase.count > 0
    FIRST_INVOICE: 'first_invoice',     // Invoice.count > 0
    FIRST_PAYMENT: 'first_payment',     // Payment.count > 0

    // Level 3: Financial Readiness
    ACCT_PERIOD: 'acct_period',       // AccountingPeriod.count > 0
    BANK_RECONCILE: 'bank_reconcile',    // BankStatement.count > 0
    VAT_SETTINGS: 'vat_settings',      // TaxCode.count > 0
    WHT_SETTINGS: 'wht_settings',      // WhtCode.count > 0
} as const;

export type SetupItemKey = (typeof SETUP_ITEM_KEYS)[keyof typeof SETUP_ITEM_KEYS];

export const SETUP_ITEM_LEVELS: Record<SetupItemKey, 1 | 2 | 3> = {
    [SETUP_ITEM_KEYS.TAX_PROFILE]: 1,
    [SETUP_ITEM_KEYS.BANK_ACCOUNT]: 1,
    [SETUP_ITEM_KEYS.CHART_OF_ACCTS]: 1,
    [SETUP_ITEM_KEYS.HAS_PRODUCT]: 1,
    [SETUP_ITEM_KEYS.HAS_CUSTOMER]: 1,
    [SETUP_ITEM_KEYS.HAS_SUPPLIER]: 1,
    [SETUP_ITEM_KEYS.SIGNATORY]: 1,
    [SETUP_ITEM_KEYS.FIRST_SALE]: 2,
    [SETUP_ITEM_KEYS.FIRST_PURCHASE]: 2,
    [SETUP_ITEM_KEYS.FIRST_INVOICE]: 2,
    [SETUP_ITEM_KEYS.FIRST_PAYMENT]: 2,
    [SETUP_ITEM_KEYS.ACCT_PERIOD]: 3,
    [SETUP_ITEM_KEYS.BANK_RECONCILE]: 3,
    [SETUP_ITEM_KEYS.VAT_SETTINGS]: 3,
    [SETUP_ITEM_KEYS.WHT_SETTINGS]: 3,
};

/** Derived readiness status for a single item */
export interface SetupItemStatus {
    key: SetupItemKey;
    level: 1 | 2 | 3;
    isDone: boolean;       // Derived from DB count / record existence
    isDismissed: boolean;  // User chose to ignore this item
}

/** Full setup progress report (returned from OnboardingService.getSetupProgress) */
export interface SetupProgressReport {
    items: SetupItemStatus[];
    totalItems: number;
    completedItems: number;
    progressPercent: number;
    isGoLiveReady: boolean;   // All level-1 items done
    isFullyReady: boolean;    // All items done
}

// ============================================================================
// Industry Presets
// ============================================================================

/** What each industry type pre-configures automatically on genesis */
export const INDUSTRY_PRESETS: Record<IndustryType, {
    label: string;
    description: string;
    defaultCategories: string[];
    suggestWarehouse: boolean;
}> = {
    RETAIL: { label: 'ร้านค้าปลีก', description: 'สินค้าทั่วไป, เครื่องใช้', defaultCategories: ['สินค้าทั่วไป', 'เครื่องใช้ในบ้าน', 'อุปกรณ์'], suggestWarehouse: false },
    WHOLESALE: { label: 'ค้าส่ง', description: 'ซื้อขายส่ง, ราคาลอต', defaultCategories: ['สินค้า Grade A', 'สินค้า Grade B', 'บรรจุภัณฑ์'], suggestWarehouse: true },
    MANUFACTURE: { label: 'ผู้ผลิต', description: 'วัตถุดิบ, กระบวนการผลิต', defaultCategories: ['วัตถุดิบ', 'งานระหว่างผลิต (WIP)', 'สินค้าสำเร็จรูป'], suggestWarehouse: true },
    FOOD: { label: 'อาหารและเครื่องดื่ม', description: 'ร้านอาหาร, ครัว, Delivery', defaultCategories: ['อาหารสด', 'อาหารแห้ง', 'เครื่องดื่ม', 'บรรจุภัณฑ์'], suggestWarehouse: false },
    SERVICE: { label: 'ธุรกิจบริการ', description: 'ให้บริการ, ค่าแรง, อุปกรณ์', defaultCategories: ['อุปกรณ์', 'ชิ้นส่วน', 'วัสดุสิ้นเปลือง'], suggestWarehouse: false },
    OTHER: { label: 'อื่นๆ', description: 'กำหนดเองทั้งหมด', defaultCategories: ['หมวดหมู่ที่ 1', 'หมวดหมู่ที่ 2'], suggestWarehouse: false },
};
