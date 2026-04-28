'use server';

import { revalidateTag } from 'next/cache';
import { WhtService } from '@/services/tax/wht.service';
import { ExportService } from '@/services/core/intelligence/export.service';
import { whtCodeSchema, WhtCodeFormValues } from '@/schemas/tax/wht-form.schema';
import { requirePermission } from '@/lib/auth-guard';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { TAX_TAGS } from '@/config/cache-tags';

/** ดึงรหัสภาษีหัก ณ ที่จ่ายทั้งหมด */
export async function getWhtCodes(): Promise<ActionResponse<any[]>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_SETTINGS_VIEW');
            return await WhtService.getCodesAll(ctx);
        }, 'tax:getWhtCodes');
    }, { context: { action: 'getWhtCodes' } });
}

/** สร้าง/อัปเดตรหัสภาษีหัก ณ ที่จ่าย */
export async function upsertWhtCode(data: WhtCodeFormValues, id?: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_SETTINGS_MANAGE');
            const validated = whtCodeSchema.parse(data);
            await WhtService.upsertCode(ctx, validated, id);
            revalidateTag(TAX_TAGS.SETTINGS);
            return null;
        }, 'tax:upsertWhtCode');
    }, { context: { action: 'upsertWhtCode' } });
}

/** เปิด/ปิดรหัสภาษี */
export async function toggleWhtCodeStatus(id: string, isActive: boolean): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_SETTINGS_MANAGE');
            await WhtService.toggleCode(ctx, id, isActive);
            revalidateTag(TAX_TAGS.SETTINGS);
            return null;
        }, 'tax:toggleWhtCodeStatus');
    }, { context: { action: 'toggleWhtCodeStatus', id } });
}

/** ลบรหัสภาษี */
export async function deleteWhtCodeAction(id: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_SETTINGS_MANAGE');
            await WhtService.deleteCode(ctx, id);
            revalidateTag(TAX_TAGS.SETTINGS);
            return null;
        }, 'tax:deleteWhtCode');
    }, { context: { action: 'deleteWhtCode', id } });
}

/** ดึงรายงาน WHT ตามเดือน/ปี */
export async function getWhtEntriesAction(params: { year: number; month: number; formType?: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_REPORT_VIEW');
            return await WhtService.getReportData(ctx, params as any);
        }, 'tax:getWhtEntries');
    }, { context: { action: 'getWhtEntries' } });
}

/** ออกหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) */
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

/** ยกเลิกหนังสือรับรอง */
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

/** Export WHT เป็น CSV */
export async function exportWhtEntriesAction(params: { year: number; month: number; formType?: string }): Promise<ActionResponse<string>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('TAX_REPORT_VIEW');
            const result = await WhtService.getReportData(ctx, params as any);
            const rows = ExportService.adaptWhtReportToRows(result.data);
            return ExportService.toCSV(rows);
        }, 'tax:exportWhtEntries');
    }, { context: { action: 'exportWhtEntries' } });
}
