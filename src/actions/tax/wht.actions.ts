'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { Security } from '@/services/core/iam/security.service';
import { getSessionContext } from '@/lib/auth-guard';
import { whtCodeSchema, WhtCodeFormValues } from '@/schemas/tax/wht-form.schema';
import { WhtService } from '@/services/tax/wht.service';
import { ExportService } from '@/services/core/intelligence/export.service';
import { ActionResponse } from '@/types/domain';

/**
 * Helper to ensure context or throw
 */
async function getRequiredContext() {
    const ctx = await getSessionContext();
    if (!ctx) throw new Error('Unauthorized');
    return ctx;
}

/**
 * Server Actions for Withholding Tax (WHT)
 */

export async function getWhtCodes() {
    const ctx = await getSessionContext();
    if (!ctx || !ctx.shopId) return [];

    return await (db as any).whtCode.findMany({
        where: { shopId: ctx.shopId },
        orderBy: { rate: 'asc' },
    });
}

export async function upsertWhtCode(data: WhtCodeFormValues, id?: string) {
    const ctx = await getRequiredContext();
    Security.requirePermission(ctx as any, 'TAX_REPORT_POST' as any);

    const validated = whtCodeSchema.parse(data);

    if (id) {
        await (db as any).whtCode.update({
            where: { id, shopId: ctx.shopId },
            data: validated,
        });
    } else {
        await (db as any).whtCode.upsert({
            where: {
                shopId_code: {
                    shopId: ctx.shopId,
                    code: validated.code,
                },
            },
            update: validated,
            create: {
                shopId: ctx.shopId,
                ...validated,
            },
        });
    }

    revalidatePath('/settings/tax');
    return { success: true };
}

export async function toggleWhtCodeStatus(id: string, isActive: boolean) {
    const ctx = await getRequiredContext();
    Security.requirePermission(ctx as any, 'TAX_REPORT_POST' as any);

    await (db as any).whtCode.update({
        where: { id, shopId: ctx.shopId },
        data: { isActive },
    });

    revalidatePath('/settings/tax');
    return { success: true };
}

/**
 * ลบ WHT Code
 */
export async function deleteWhtCodeAction(id: string) {
    const ctx = await getRequiredContext();
    Security.requirePermission(ctx as any, 'TAX_REPORT_POST' as any);

    try {
        await (db as any).whtCode.delete({
            where: { id, shopId: ctx.shopId }
        });
        revalidatePath('/settings/tax');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * ดึงรายการ WHT Ledger
 */
export async function getWhtEntriesAction(params: { year: number; month: number; formType?: string }) {
    const ctx = await getRequiredContext();
    Security.requirePermission(ctx as any, 'TAX_REPORT_VIEW' as any);

    try {
        const result = await WhtService.getReportData(ctx as any, params as any);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)
 */
export async function issueWhtCertificateAction(entryId: string) {
    const ctx = await getRequiredContext();
    Security.requirePermission(ctx as any, 'TAX_REPORT_POST' as any);

    try {
        const certificate = await WhtService.issueCertificate(ctx as any, entryId);
        revalidatePath('/settings/tax');
        return { success: true, data: certificate };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * ยกเลิกหนังสือรับรอง
 */
export async function voidWhtCertificateAction(certId: string) {
    const ctx = await getRequiredContext();
    Security.requirePermission(ctx as any, 'TAX_REPORT_POST' as any);

    try {
        await WhtService.voidCertificate(ctx as any, certId);
        revalidatePath('/settings/tax');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Export WHT entries to CSV
 */
export async function exportWhtEntriesAction(params: { year: number; month: number; formType?: string }): Promise<ActionResponse> {
    try {
        const ctx = await getRequiredContext();
        Security.requirePermission(ctx as any, 'TAX_REPORT_VIEW' as any);

        const result = await WhtService.getReportData(ctx as any, params as any);
        const rows = ExportService.adaptWhtReportToRows(result.data);
        const csv = ExportService.toCSV(rows);

        return { success: true, data: csv };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
