'use server';

import { PurchaseTaxService } from '@/services/tax/purchase-tax.service';
import { TaxSettingsService } from '@/services/tax/tax-settings.service';
import { ExportService } from '@/services/core/intelligence/export.service';
import { AuditService } from '@/services/core/system/audit.service';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { revalidatePath } from 'next/cache';
import { Permission } from '@prisma/client';
import {
    taxCodeSchema,
    updateTaxCodeSchema
} from '@/schemas/tax/tax-code.schema';
import {
    upsertCompanyTaxProfileSchema
} from '@/schemas/tax/company-tax-profile.schema';

/**
 * Register a Purchase Order as a Tax Document (Draft)
 */
export async function registerPurchaseTax(purchaseId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_POST);
        const doc = await PurchaseTaxService.registerFromPurchase(purchaseId, ctx);

        revalidatePath(`/purchases/${purchaseId}`);
        revalidatePath('/tax/purchase-tax');

        return doc;
    }, { context: { action: 'registerPurchaseTax', purchaseId } });
}

/**
 * Post a Purchase Tax Document
 */
export async function postPurchaseTax(docId: string, input: any): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_POST);
        
        // 1. Before Snapshot
        const before = await PurchaseTaxService.getById(docId, ctx);
        if (!before) throw new Error('ไม่พบเอกสารภาษีซื้อที่ต้องการจัดเก็บ');

        // 2. Perform Mutation
        const result = await PurchaseTaxService.post(docId, input, ctx);

        // 3. After Snapshot (From result or re-fetch)
        const after = await PurchaseTaxService.getById(docId, ctx);

        // 4. Record Deep Audit
        AuditService.record({
            action: 'PURCHASE_TAX_POST',
            targetType: 'PurchaseTaxDocument',
            targetId: docId,
            note: `ลงบัญชีภาษีซื้อ: ${before.internalDocNo}`,
            before,
            after,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] PURCHASE_TAX_POST log failed', err));

        revalidatePath(`/tax/purchase-tax/${docId}`);
        revalidatePath('/tax/purchase-tax');

        return null;
    }, { context: { action: 'postPurchaseTax', docId } });
}

/**
 * Void a Purchase Tax Document
 */
export async function voidPurchaseTax(docId: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_POST);
        
        // 1. Before Snapshot
        const before = await PurchaseTaxService.getById(docId, ctx);
        if (!before) throw new Error('ไม่พบเอกสารภาษีซื้อที่ต้องการยกเลิก');

        // 2. Perform Mutation
        await PurchaseTaxService.void(docId, ctx);

        // 3. After Snapshot
        const after = await PurchaseTaxService.getById(docId, ctx);

        // 4. Record Deep Audit
        AuditService.record({
            action: 'PURCHASE_TAX_VOID',
            targetType: 'PurchaseTaxDocument',
            targetId: docId,
            note: `ยกเลิกเอกสารภาษีซื้อ: ${before.internalDocNo}`,
            before,
            after,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] PURCHASE_TAX_VOID log failed', err));

        revalidatePath(`/tax/purchase-tax/${docId}`);
        revalidatePath('/tax/purchase-tax');

        return null;
    }, { context: { action: 'voidPurchaseTax', docId } });
}

/**
 * Get list of Purchase Tax Documents
 */
export async function getPurchaseTaxes(params: any = {}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_VIEW);
        return await PurchaseTaxService.getList(params, ctx);
    }, { context: { action: 'getPurchaseTaxes' } });
}

/**
 * Get single Purchase Tax Document
 */
export async function getPurchaseTax(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_VIEW);
        return await PurchaseTaxService.getById(id, ctx);
    }, { context: { action: 'getPurchaseTax', id } });
}

// ==================== Tax Settings Actions ====================

export async function getCompanyTaxProfile(): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_VIEW);
        return await TaxSettingsService.getCompanyTaxProfile(ctx);
    }, { context: { action: 'getCompanyTaxProfile' } });
}

export async function upsertCompanyTaxProfile(input: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_POST);
        const validated = upsertCompanyTaxProfileSchema.parse(input);
        const profile = await TaxSettingsService.upsertCompanyTaxProfile(validated, ctx);

        // Audit (Non-blocking)
        AuditService.record({
            action: 'UPDATE_COMPANY_TAX_PROFILE',
            targetType: 'CompanyTaxProfile',
            targetId: ctx.shopId,
            note: 'Updated company tax profile',
            after: profile,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] UPDATE_COMPANY_TAX_PROFILE log failed', err));

        revalidatePath('/settings/tax');
        return profile;
    }, { context: { action: 'upsertCompanyTaxProfile' } });
}

export async function listTaxCodes(): Promise<ActionResponse<any[]>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_VIEW);
        return await TaxSettingsService.listTaxCodes(ctx);
    }, { context: { action: 'listTaxCodes' } });
}

export async function createTaxCode(input: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_POST);
        const validated = taxCodeSchema.parse(input);
        const code = await TaxSettingsService.createTaxCode(validated, ctx);
        
        // Audit logging (Non-blocking)
        AuditService.record({
            action: 'CREATE_TAX_CODE',
            targetType: 'TaxCode',
            targetId: code.code,
            note: `Created tax code: ${code.name}`,
            after: code,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] CREATE_TAX_CODE log failed', err));

        revalidatePath('/settings/tax');
        return code;
    }, { context: { action: 'createTaxCode' } });
}

export async function updateTaxCode(code: string, input: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_POST);
        
        // Efficient Before Snapshot
        const before = await TaxSettingsService.getTaxCodeByCode(code, ctx);
        if (!before) {
            throw new Error('ไม่พบรหัสภาษีที่ต้องการแก้ไข');
        }
        
        const validated = updateTaxCodeSchema.parse(input);
        const updated = await TaxSettingsService.updateTaxCode(code, validated, ctx);
        
        // Audit logging (Non-blocking)
        AuditService.record({
            action: 'UPDATE_TAX_CODE',
            targetType: 'TaxCode',
            targetId: code,
            note: `Updated tax code: ${code}`,
            before: before,
            after: updated,
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] UPDATE_TAX_CODE log failed', err));

        revalidatePath('/settings/tax');
        return updated;
    }, { context: { action: 'updateTaxCode', code } });
}

export async function toggleTaxCode(code: string, isActive: boolean): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_POST);
        
        // Snapshot for audit
        const before = await TaxSettingsService.getTaxCodeByCode(code, ctx);
        
        await TaxSettingsService.toggleTaxCode(code, isActive, ctx);
        
        // Audit
        AuditService.record({
            action: 'TOGGLE_TAX_CODE',
            targetType: 'TaxCode',
            targetId: code,
            note: `${isActive ? 'Enabled' : 'Disabled'} tax code: ${code}`,
            before: before,
            after: { ...before, isActive },
            actorId: ctx.userId,
            shopId: ctx.shopId
        }).catch(err => logger.error('[Audit] TOGGLE_TAX_CODE log failed', err));

        revalidatePath('/settings/tax');
        return null;
    }, { context: { action: 'toggleTaxCode', code, isActive } });
}

// ==================== Statutory Reporting Actions ====================

export async function getVatReport(month: number, year: number): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_VIEW);
        const salesReport = await TaxSettingsService.getSalesTaxReport(month, year, ctx);
        const purchaseReport = await TaxSettingsService.getPurchaseTaxReport(month, year, ctx);

        const summary = {
            month,
            year,
            sales: {
                taxableBase: salesReport.totalTaxableBase,
                taxAmount: salesReport.totalTaxAmount,
            },
            purchases: {
                taxableBase: purchaseReport.totalTaxableBase,
                taxAmount: purchaseReport.totalTaxAmount,
                claimableAmount: purchaseReport.claimableAmount,
            },
            netVat: salesReport.totalTaxAmount - purchaseReport.claimableAmount,
        };

        return {
            summary,
            salesEntries: salesReport.entries,
            purchaseEntries: purchaseReport.entries,
        };
    }, { context: { action: 'getVatReport', month, year } });
}

/**
 * Export VAT Report (Sales + Purchases) to CSV
 */
export async function exportVatReportAction(params: { month: number, year: number }): Promise<ActionResponse<string>> {
    return handleAction(async () => {
        const ctx = await requirePermission(Permission.TAX_REPORT_VIEW);
        const salesReport = await TaxSettingsService.getSalesTaxReport(params.month, params.year, ctx);
        const purchaseReport = await TaxSettingsService.getPurchaseTaxReport(params.month, params.year, ctx);

        const salesRows = ExportService.adaptVatReportToRows(salesReport.entries);
        const purchaseRows = ExportService.adaptVatReportToRows(purchaseReport.entries);

        const rows = [
            { Date: 'SALES TAX REPORT' },
            ...salesRows,
            {},
            { Date: 'PURCHASE TAX REPORT' },
            ...purchaseRows
        ];

        return ExportService.toCSV(rows);
    }, { context: { action: 'exportVatReportAction', params } });
}
