/**
 * ============================================================================
 * SetupProgressCard — Dashboard Readiness Widget (Phase OB1)
 * ============================================================================
 * Server Component: fetches setup progress from DB and renders a tiered checklist.
 * Progress is DERIVED from real system counts — never stored as flags.
 *
 * Mount this in the dashboard layout or home page for new shops.
 * Automatically hides when isGoLiveReady AND all Level 2+ items are done.
 */
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { OnboardingService } from '@/services/core/system/onboarding.service';
import { SETUP_ITEM_KEYS } from '@/types/onboarding.types';
import type { SetupItemStatus } from '@/types/onboarding.types';
import { cn } from '@/lib/utils';
import { SetupProgressBanner } from './setup-progress-banner';

// ── Item display meta ─────────────────────────────────────────────────────────

const ITEM_META: Record<string, {
    label: string;
    description: string;
    actionLabel: string;
    actionHref: string;
}> = {
    [SETUP_ITEM_KEYS.TAX_PROFILE]: { label: 'ตั้งค่าภาษีและบริษัท', description: 'สำหรับออกใบกำกับภาษีและ VAT', actionLabel: 'ตั้งค่าภาษี', actionHref: '/settings/tax' },
    [SETUP_ITEM_KEYS.BANK_ACCOUNT]: { label: 'เพิ่มบัญชีธนาคาร', description: 'สำหรับกระทบยอดและบันทึกรับชำระ', actionLabel: 'เพิ่มบัญชี', actionHref: '/settings/accounting' },
    [SETUP_ITEM_KEYS.CHART_OF_ACCTS]: { label: 'ผังบัญชี (Chart of Accounts)', description: 'รากฐานของระบบบัญชี', actionLabel: 'ดูผังบัญชี', actionHref: '/settings/accounting' },
    [SETUP_ITEM_KEYS.HAS_PRODUCT]: { label: 'สินค้าในระบบ', description: 'เพิ่มสินค้าอย่างน้อย 1 รายการ', actionLabel: 'เพิ่มสินค้า', actionHref: '/products/new' },
    [SETUP_ITEM_KEYS.HAS_CUSTOMER]: { label: 'ลูกค้าในระบบ', description: 'เพิ่มลูกค้าอย่างน้อย 1 ราย', actionLabel: 'เพิ่มลูกค้า', actionHref: '/customers/new' },
    [SETUP_ITEM_KEYS.HAS_SUPPLIER]: { label: 'ผู้จัดจำหน่าย', description: 'เพิ่ม Supplier อย่างน้อย 1 ราย', actionLabel: 'เพิ่ม Supplier', actionHref: '/suppliers/new' },
    [SETUP_ITEM_KEYS.SIGNATORY]: { label: 'ผู้มีอำนาจลงนาม', description: 'จำเป็นสำหรับ WHT และ 50ทวิ', actionLabel: 'ตั้งค่าร้าน', actionHref: '/settings' },
    [SETUP_ITEM_KEYS.INVENTORY_MODE]: { label: 'ตั้งค่าโหมดคลังสินค้า', description: 'เลือกรูปแบบการจัดการสต็อกที่เหมาะสม', actionLabel: 'ตั้งค่าโหมด', actionHref: '/settings/shop' },
    [SETUP_ITEM_KEYS.WAREHOUSE_SETUP]: { label: 'จัดการสาขาคลังสินค้า', description: 'สำหรับธุรกิจที่มีแหล่งเก็บของหลายที่', actionLabel: 'จัดการคลัง', actionHref: '/inventory/warehouses' },
    [SETUP_ITEM_KEYS.FIRST_SALE]: { label: 'บันทึกการขายครั้งแรก', description: 'ทดสอบ End-to-End Sales Flow', actionLabel: 'สร้างการขาย', actionHref: '/sales/new' },
    [SETUP_ITEM_KEYS.FIRST_PURCHASE]: { label: 'สั่งซื้อครั้งแรก', description: 'ทดสอบ Procurement Cycle', actionLabel: 'สร้างใบสั่งซื้อ', actionHref: '/purchases/new' },
    [SETUP_ITEM_KEYS.FIRST_INVOICE]: { label: 'ออกใบแจ้งหนี้ครั้งแรก', description: 'Billing Cycle ครบวงจร', actionLabel: 'สร้างใบแจ้งหนี้', actionHref: '/sales/invoices/new' },
    [SETUP_ITEM_KEYS.FIRST_PAYMENT]: { label: 'รับชำระเงินครั้งแรก', description: 'บันทึก Payment และเชื่อมกับ Invoice', actionLabel: 'บันทึกชำระ', actionHref: '/accounting/payments/new' },
    [SETUP_ITEM_KEYS.ACCT_PERIOD]: { label: 'เปิดรอบบัญชี', description: 'กำหนดงวดบัญชีและปีภาษี', actionLabel: 'ตั้งรอบบัญชี', actionHref: '/settings/accounting' },
    [SETUP_ITEM_KEYS.BANK_RECONCILE]: { label: 'กระทบยอดธนาคาร', description: 'Upload Bank Statement ครั้งแรก', actionLabel: 'เริ่มกระทบยอด', actionHref: '/accounting/bank' },
    [SETUP_ITEM_KEYS.VAT_SETTINGS]: { label: 'ตั้งค่า VAT Code', description: 'สำหรับใบกำกับภาษีออก/รับ', actionLabel: 'ตั้งค่า VAT', actionHref: '/settings/tax' },
    [SETUP_ITEM_KEYS.WHT_SETTINGS]: { label: 'ตั้งค่า WHT Code', description: 'สำหรับหนังสือรับรองหัก ณ ที่จ่าย', actionLabel: 'ตั้งค่า WHT', actionHref: '/settings/tax' },
};

// ── Main Component ────────────────────────────────────────────────────────────

export async function SetupProgressCard() {
    const session = await auth();
    const shopId = session?.user?.shopId;

    if (!shopId) return null;

    let report;
    try {
        report = await OnboardingService.getSetupProgress(shopId);
    } catch {
        return null;
    }

    // Hide card entirely once all level-1 and level-2 items are done
    const blockerItems = report.items.filter((i) => i.level === 1);
    const transactionItems = report.items.filter((i) => i.level === 2);
    const financialItems = report.items.filter((i) => i.level === 3);
    const allL1L2Done = blockerItems.every((i) => i.isDone) && transactionItems.every((i) => i.isDone);

    if (allL1L2Done && financialItems.every((i) => i.isDone)) return null;

    const hasBlockers = blockerItems.some((i) => !i.isDone);

    // Find the first incomplete item to suggest as the "Next Step"
    const nextItem = report.items.find(i => !i.isDone && !i.isDismissed);
    const nextMeta = nextItem ? ITEM_META[nextItem.key] : null;

    return (
        <SetupProgressBanner
            progressPercent={report.progressPercent}
            completedItems={report.completedItems}
            totalItems={report.totalItems}
            nextStepLabel={nextMeta?.label}
            nextStepHref={nextMeta?.actionHref}
        />
    );
}
