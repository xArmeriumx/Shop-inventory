'use server';

import { PurchaseTaxService } from '@/services/purchase-tax.service';
import { TaxSettingsService } from '@/services/tax-settings.service';
import { requirePermission } from '@/lib/auth-guard';
import { ActionResponse } from '@/types/domain';
import { revalidatePath } from 'next/cache';

/**
 * Register a Purchase Order as a Tax Document (Draft)
 */
export async function registerPurchaseTax(purchaseId: string): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_POST' as any);
        const doc = await PurchaseTaxService.registerFromPurchase(purchaseId, ctx);

        revalidatePath(`/purchases/${purchaseId}`);
        revalidatePath('/tax/purchase-tax');

        return {
            success: true,
            message: 'สร้างเอกสารภาษีซื้อร่างสำเร็จ',
            data: doc
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'เกิดข้อผิดพลาดในการสร้างเอกสารภาษีซื้อ'
        };
    }
}

/**
 * Post a Purchase Tax Document
 */
export async function postPurchaseTax(docId: string, input: any): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_POST' as any);
        await PurchaseTaxService.post(docId, input, ctx);

        revalidatePath(`/tax/purchase-tax/${docId}`);
        revalidatePath('/tax/purchase-tax');

        return {
            success: true,
            message: 'ลงบัญชีภาษีซื้อสำเร็จ'
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'เกิดข้อผิดพลาดในการลงบัญชี'
        };
    }
}

/**
 * Void a Purchase Tax Document
 */
export async function voidPurchaseTax(docId: string): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_POST' as any);
        await PurchaseTaxService.void(docId, ctx);

        revalidatePath(`/tax/purchase-tax/${docId}`);
        revalidatePath('/tax/purchase-tax');

        return {
            success: true,
            message: 'ยกเลิกเอกสารภาษีซื้อสำเร็จ'
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'เกิดข้อผิดพลาดในการยกเลิกเอกสาร'
        };
    }
}

/**
 * Get list of Purchase Tax Documents
 */
export async function getPurchaseTaxes(params: any = {}): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_VIEW' as any);
        const result = await PurchaseTaxService.getList(params, ctx);
        return {
            success: true,
            data: result
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล'
        };
    }
}

/**
 * Get single Purchase Tax Document
 */
export async function getPurchaseTax(id: string): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_VIEW' as any);
        const doc = await PurchaseTaxService.getById(id, ctx);
        return {
            success: true,
            data: doc
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'ไม่พบข้อมูลเอกสาร'
        };
    }
}

// ==================== Tax Settings Actions ====================

export async function getCompanyTaxProfile(): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_VIEW' as any);
        const profile = await TaxSettingsService.getCompanyTaxProfile(ctx);
        return { success: true, data: profile };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function upsertCompanyTaxProfile(input: any): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_POST' as any);
        const profile = await TaxSettingsService.upsertCompanyTaxProfile(input, ctx);
        revalidatePath('/settings/tax');
        return { success: true, data: profile, message: 'บันทึกข้อมูลภาษีบริษัทสำเร็จ' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function listTaxCodes(): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_VIEW' as any);
        const codes = await TaxSettingsService.listTaxCodes(ctx);
        return { success: true, data: codes };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function createTaxCode(input: any): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_POST' as any);
        const code = await TaxSettingsService.createTaxCode(input, ctx);
        revalidatePath('/settings/tax');
        return { success: true, data: code, message: 'สร้างรหัสภาษีสำเร็จ' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateTaxCode(code: string, input: any): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_POST' as any);
        const updated = await TaxSettingsService.updateTaxCode(code, input, ctx);
        revalidatePath('/settings/tax');
        return { success: true, data: updated, message: 'แก้ไขรหัสภาษีสำเร็จ' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function toggleTaxCode(code: string, isActive: boolean): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_POST' as any);
        await TaxSettingsService.toggleTaxCode(code, isActive, ctx);
        revalidatePath('/settings/tax');
        return { success: true, message: isActive ? 'เปิดใช้งานสำเร็จ' : 'ปิดใช้งานสำเร็จ' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// ==================== Statutory Reporting Actions ====================

export async function getVatReport(month: number, year: number): Promise<ActionResponse> {
    try {
        const ctx = await requirePermission('TAX_REPORT_VIEW' as any);
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
            success: true,
            data: {
                summary,
                salesEntries: salesReport.entries,
                purchaseEntries: purchaseReport.entries,
            }
        };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
