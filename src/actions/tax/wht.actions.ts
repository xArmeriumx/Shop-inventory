'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { groq, DEFAULT_MODEL } from '@/lib/ai/client';
import { Security } from '@/services/core/iam/security.service';
import { getSessionContext } from '@/lib/auth-guard';
import { whtCodeSchema, WhtCodeFormValues } from '@/schemas/tax/wht-form.schema';
import { WhtService } from '@/services/tax/wht.service';
import { ExportService } from '@/services/core/intelligence/export.service';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { requirePermission } from '@/lib/auth-guard';
import { revalidateTag } from 'next/cache';
import { TAX_TAGS } from '@/config/cache-tags';

/**
 * Server Actions for Withholding Tax (WHT)
 */

export async function getWhtCodes(): Promise<ActionResponse<any[]>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_SETTINGS_VIEW');
            return await db.whtCode.findMany({
                where: { shopId: ctx.shopId },
                orderBy: { rate: 'asc' },
            });
        }, 'tax:getWhtCodes');
    }, { context: { action: 'getWhtCodes' } });
}

export async function upsertWhtCode(data: WhtCodeFormValues, id?: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_SETTINGS_MANAGE');
            const validated = whtCodeSchema.parse(data);

            if (id) {
                await db.whtCode.update({
                    where: { id, shopId: ctx.shopId },
                    data: validated as any,
                });
            } else {
                await db.whtCode.upsert({
                    where: {
                        shopId_code: {
                            shopId: ctx.shopId,
                            code: validated.code,
                        },
                    },
                    update: validated as any,
                    create: {
                        shopId: ctx.shopId,
                        ...validated,
                    } as any,
                });
            }

            revalidateTag(TAX_TAGS.SETTINGS);
            return null;
        }, 'tax:upsertWhtCode');
    }, { context: { action: 'upsertWhtCode' } });
}

export async function toggleWhtCodeStatus(id: string, isActive: boolean): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_SETTINGS_MANAGE');
            await db.whtCode.update({
                where: { id, shopId: ctx.shopId },
                data: { isActive },
            });
            revalidateTag(TAX_TAGS.SETTINGS);
            return null;
        }, 'tax:toggleWhtCodeStatus');
    }, { context: { action: 'toggleWhtCodeStatus', id } });
}

export async function deleteWhtCodeAction(id: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_SETTINGS_MANAGE');
            await db.whtCode.delete({
                where: { id, shopId: ctx.shopId }
            });
            revalidateTag(TAX_TAGS.SETTINGS);
            return null;
        }, 'tax:deleteWhtCode');
    }, { context: { action: 'deleteWhtCode', id } });
}

export async function getWhtEntriesAction(params: { year: number; month: number; formType?: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_REPORT_VIEW');
            return await WhtService.getReportData(ctx, params as any);
        }, 'tax:getWhtEntries');
    }, { context: { action: 'getWhtEntries' } });
}

export async function issueWhtCertificateAction(entryId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_REPORT_POST');
            const result = await WhtService.issueCertificate(ctx, entryId);
            revalidateTag(TAX_TAGS.WHT.LIST);
            revalidateTag(TAX_TAGS.WHT.DETAIL(entryId));
            return result.data;
        }, 'tax:issueWhtCertificate');
    }, { context: { action: 'issueWhtCertificate', entryId } });
}

export async function voidWhtCertificateAction(certId: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_REPORT_POST');
            const result = await WhtService.voidCertificate(ctx, certId);
            revalidateTag(TAX_TAGS.WHT.LIST);
            return result.data;
        }, 'tax:voidWhtCertificate');
    }, { context: { action: 'voidWhtCertificate', certId } });
}

export async function exportWhtEntriesAction(params: { year: number; month: number; formType?: string }): Promise<ActionResponse<string>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_REPORT_VIEW');
            const result = await WhtService.getReportData(ctx, params as any);
            const rows = ExportService.adaptWhtReportToRows(result.data);
            const csv = ExportService.toCSV(rows);
            return csv;
        }, 'tax:exportWhtEntries');
    }, { context: { action: 'exportWhtEntries' } });
}
