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
import { CheckCircle2, Circle, ChevronRight, Rocket, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DismissSetupItemButton } from './dismiss-setup-item-button';
import { SetupChecklistClient } from './setup-checklist-client';

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
    [SETUP_ITEM_KEYS.FIRST_SALE]: { label: 'บันทึกการขายครั้งแรก', description: 'ทดสอบ End-to-End Sales Flow', actionLabel: 'สร้างการขาย', actionHref: '/sales/new' },
    [SETUP_ITEM_KEYS.FIRST_PURCHASE]: { label: 'สั่งซื้อครั้งแรก', description: 'ทดสอบ Procurement Cycle', actionLabel: 'สร้างใบสั่งซื้อ', actionHref: '/purchases/new' },
    [SETUP_ITEM_KEYS.FIRST_INVOICE]: { label: 'ออกใบแจ้งหนี้ครั้งแรก', description: 'Billing Cycle ครบวงจร', actionLabel: 'สร้างใบแจ้งหนี้', actionHref: '/sales/invoices/new' },
    [SETUP_ITEM_KEYS.FIRST_PAYMENT]: { label: 'รับชำระเงินครั้งแรก', description: 'บันทึก Payment และเชื่อมกับ Invoice', actionLabel: 'บันทึกชำระ', actionHref: '/accounting/payments/new' },
    [SETUP_ITEM_KEYS.ACCT_PERIOD]: { label: 'เปิดรอบบัญชี', description: 'กำหนดงวดบัญชีและปีภาษี', actionLabel: 'ตั้งรอบบัญชี', actionHref: '/settings/accounting' },
    [SETUP_ITEM_KEYS.BANK_RECONCILE]: { label: 'กระทบยอดธนาคาร', description: 'Upload Bank Statement ครั้งแรก', actionLabel: 'เริ่มกระทบยอด', actionHref: '/accounting/bank' },
    [SETUP_ITEM_KEYS.VAT_SETTINGS]: { label: 'ตั้งค่า VAT Code', description: 'สำหรับใบกำกับภาษีออก/รับ', actionLabel: 'ตั้งค่า VAT', actionHref: '/settings/tax' },
    [SETUP_ITEM_KEYS.WHT_SETTINGS]: { label: 'ตั้งค่า WHT Code', description: 'สำหรับหนังสือรับรองหัก ณ ที่จ่าย', actionLabel: 'ตั้งค่า WHT', actionHref: '/settings/tax' },
};

const LEVEL_LABELS: Record<1 | 2 | 3, { label: string; color: string }> = {
    1: { label: 'จำเป็นก่อน Go-Live', color: 'text-destructive' },
    2: { label: 'ความพร้อมธุรกรรมแรก', color: 'text-warning-foreground' },
    3: { label: 'ความพร้อมทางการเงิน', color: 'text-muted-foreground' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ChecklistItem({ item }: { item: SetupItemStatus }) {
    const meta = ITEM_META[item.key];
    if (!meta || item.isDismissed) return null;

    return (
        <div className={cn(
            'group flex items-start gap-3 rounded-lg p-3 transition-colors',
            item.isDone ? 'opacity-60' : 'hover:bg-muted/40',
        )}>
            {/* Status icon */}
            <div className="mt-0.5 shrink-0">
                {item.isDone
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <Circle className="h-4 w-4 text-muted-foreground/50" />
                }
            </div>

            {/* Label + description */}
            <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', item.isDone && 'line-through')}>
                    {meta.label}
                </p>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>

            {/* Action */}
            {!item.isDone && (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DismissSetupItemButton itemKey={item.key} />
                    <Link
                        href={meta.actionHref}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                        {meta.actionLabel}
                        <ChevronRight className="h-3 w-3" />
                    </Link>
                </div>
            )}
        </div>
    );
}

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

    return (
        <div className={cn(
            'rounded-xl border overflow-hidden',
            hasBlockers ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card',
        )}>
            {/* Card Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {hasBlockers
                        ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        : <Rocket className="h-4 w-4 text-primary shrink-0" />
                    }
                    <div>
                        <p className="text-sm font-semibold">
                            {hasBlockers ? 'จำเป็นต้องดำเนินการก่อน Go-Live' : 'ความพร้อมระบบ'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {report.completedItems} / {report.totalItems} รายการเสร็จสมบูรณ์
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-24 flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-bold">{report.progressPercent}%</span>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all duration-500',
                                report.progressPercent === 100 ? 'bg-success' : hasBlockers ? 'bg-destructive' : 'bg-primary',
                            )}
                            style={{ width: `${report.progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Checklist by level */}
            <SetupChecklistClient
                totalIncomplete={report.totalItems - report.completedItems}
                blockerItems={
                    <div>
                        <p className={cn('text-[10px] font-bold uppercase tracking-wider px-3 pb-1', LEVEL_LABELS[1].color)}>
                            {LEVEL_LABELS[1].label}
                        </p>
                        <div className="space-y-0.5">
                            {report.items.filter((i) => i.level === 1).map((item) => (
                                <ChecklistItem key={item.key} item={item} />
                            ))}
                        </div>
                    </div>
                }
                transactionItems={
                    <div key={2}>
                        <p className={cn('text-[10px] font-bold uppercase tracking-wider px-3 pb-1', LEVEL_LABELS[2].color)}>
                            {LEVEL_LABELS[2].label}
                        </p>
                        <div className="space-y-0.5">
                            {report.items.filter((i) => i.level === 2).map((item) => (
                                <ChecklistItem key={item.key} item={item} />
                            ))}
                        </div>
                    </div>
                }
                financialItems={
                    <div key={3}>
                        <p className={cn('text-[10px] font-bold uppercase tracking-wider px-3 pb-1', LEVEL_LABELS[3].color)}>
                            {LEVEL_LABELS[3].label}
                        </p>
                        <div className="space-y-0.5">
                            {report.items.filter((i) => i.level === 3).map((item) => (
                                <ChecklistItem key={item.key} item={item} />
                            ))}
                        </div>
                    </div>
                }
            />
        </div>
    );
}
