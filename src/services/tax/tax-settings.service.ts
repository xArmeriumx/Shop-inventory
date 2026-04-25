/**
 * TaxSettingsService — CRUD สำหรับ Tax Master Data
 *
 * ครอบคลุม:
 * - CompanyTaxProfile (ตัวตนภาษีของบริษัท)
 * - TaxCode management (เพิ่ม/แก้ไข/ปิดใช้)
 * - PartnerTaxProfile (profile ภาษีของลูกค้า/ซัพพลายเออร์)
 * - ProductTaxProfile (profile ภาษีของสินค้า)
 */

import { db } from '@/lib/db';
import type { RequestContext } from '@/types/domain';

// ==================== Company Tax Profile ====================

export interface UpsertCompanyTaxProfileInput {
    isVatRegistered: boolean;
    legalName: string;
    taxPayerId?: string | null;
    branchCode?: string | null;
    registeredAddress?: string | null;
    vatRegistrationDate?: Date | null;
    vatThreshold?: number | null;
    defaultSalesTaxCode?: string | null;
    defaultPurchaseTaxCode?: string | null;
    taxInvoicePrefix?: string | null;
    creditNotePrefix?: string | null;
    debitNotePrefix?: string | null;
    isTaxInvoiceFull?: boolean | null;
    authorizedPerson?: string | null;
    authorizedPosition?: string | null;
}

async function getCompanyTaxProfile(ctx: RequestContext) {
    return (db as any).companyTaxProfile.findUnique({
        where: { shopId: ctx.shopId },
    });
}

async function upsertCompanyTaxProfile(
    input: UpsertCompanyTaxProfileInput,
    ctx: RequestContext
) {
    return (db as any).companyTaxProfile.upsert({
        where: { shopId: ctx.shopId },
        create: {
            shopId: ctx.shopId,
            ...input,
        },
        update: { ...input },
    });
}

// ==================== Tax Code ====================

export interface CreateTaxCodeInput {
    code: string;
    name: string;
    description?: string | null;
    direction: 'OUTPUT' | 'INPUT';
    kind: 'VAT' | 'ZERO_RATED' | 'EXEMPT' | 'NO_VAT';
    rate: number;
    calculationMode?: 'EXCLUSIVE' | 'INCLUSIVE' | null;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    reportBucket?: string | null;
}

async function listTaxCodes(ctx: RequestContext) {
    return (db as any).taxCode.findMany({
        where: { shopId: ctx.shopId },
        orderBy: [{ direction: 'asc' }, { kind: 'asc' }, { code: 'asc' }],
    });
}

async function listActiveTaxCodes(
    ctx: RequestContext,
    direction?: 'OUTPUT' | 'INPUT'
) {
    return (db as any).taxCode.findMany({
        where: {
            shopId: ctx.shopId,
            isActive: true,
            ...(direction ? { direction } : {}),
            // ตรวจว่า effective period ผ่านแล้วหรือยัง
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
        },
        orderBy: [{ direction: 'asc' }, { rate: 'desc' }],
    });
}

async function getTaxCodeByCode(code: string, ctx: RequestContext) {
    return (db as any).taxCode.findUnique({
        where: { shopId_code: { shopId: ctx.shopId, code } },
    });
}

async function createTaxCode(input: CreateTaxCodeInput, ctx: RequestContext) {
    return (db as any).taxCode.create({
        data: {
            shopId: ctx.shopId,
            ...input,
        },
    });
}

async function updateTaxCode(
    code: string,
    input: Partial<CreateTaxCodeInput>,
    ctx: RequestContext
) {
    return (db as any).taxCode.update({
        where: { shopId_code: { shopId: ctx.shopId, code } },
        data: { ...input },
    });
}

async function toggleTaxCode(code: string, isActive: boolean, ctx: RequestContext) {
    return (db as any).taxCode.update({
        where: { shopId_code: { shopId: ctx.shopId, code } },
        data: { isActive },
    });
}

// ==================== Partner Tax Profile ====================

export interface UpsertPartnerTaxProfileInput {
    customerId?: string;
    supplierId?: string;
    taxId?: string;
    branchCode?: string;
    branchName?: string;
    isVatRegistrant?: boolean;
    defaultSalesTaxCode?: string;
    defaultPurchaseTaxCode?: string;
    withholdingRate?: number;
    withholdingProfile?: string;
}

async function getPartnerTaxProfile(
    partnerId: string,
    partnerType: 'customer' | 'supplier',
    ctx: RequestContext
) {
    const where =
        partnerType === 'customer'
            ? { customerId: partnerId }
            : { supplierId: partnerId };

    return (db as any).partnerTaxProfile.findUnique({ where });
}

async function upsertPartnerTaxProfile(
    input: UpsertPartnerTaxProfileInput,
    ctx: RequestContext
) {
    const { customerId, supplierId } = input;
    const where = customerId ? { customerId } : { supplierId };

    return (db as any).partnerTaxProfile.upsert({
        where,
        create: { shopId: ctx.shopId, ...input },
        update: { ...input },
    });
}

// ==================== Product Tax Profile ====================

export interface UpsertProductTaxProfileInput {
    taxClass: 'TAXABLE' | 'ZERO_RATED' | 'EXEMPT' | 'NO_VAT';
    salesTaxCode?: string;
    purchaseTaxCode?: string;
    isAlwaysExempt?: boolean;
    exemptReason?: string;
}

async function getProductTaxProfile(productId: string, ctx: RequestContext) {
    return (db as any).productTaxProfile.findUnique({ where: { productId } });
}

async function upsertProductTaxProfile(
    productId: string,
    input: UpsertProductTaxProfileInput,
    ctx: RequestContext
) {
    return (db as any).productTaxProfile.upsert({
        where: { productId },
        create: { shopId: ctx.shopId, productId, ...input },
        update: { ...input },
    });
}

// ==================== Tax Report Entries ====================

async function getSalesTaxReport(
    month: number,
    year: number,
    ctx: RequestContext
) {
    const entries = await (db as any).salesTaxEntry.findMany({
        where: {
            shopId: ctx.shopId,
            taxMonth: month,
            taxYear: year,
            postingStatus: { not: 'VOIDED' },
        },
        orderBy: { createdAt: 'asc' },
    });

    const totalTaxableBase = entries.reduce(
        (s: number, e: any) => s + Number(e.taxableBaseAmount),
        0
    );
    const totalTaxAmount = entries.reduce((s: number, e: any) => s + Number(e.taxAmount), 0);

    return { entries, totalTaxableBase, totalTaxAmount };
}

async function getPurchaseTaxReport(
    month: number,
    year: number,
    ctx: RequestContext
) {
    const entries = await (db as any).purchaseTaxEntry.findMany({
        where: {
            shopId: ctx.shopId,
            taxMonth: month,
            taxYear: year,
            postingStatus: { not: 'VOIDED' },
        },
        orderBy: { createdAt: 'asc' },
    });

    const totalTaxableBase = entries.reduce(
        (s: number, e: any) => s + Number(e.taxableBaseAmount),
        0
    );
    const totalTaxAmount = entries.reduce((s: number, e: any) => s + Number(e.taxAmount), 0);
    const claimable = entries.filter((e: any) => e.claimStatus === 'CLAIMABLE');
    const claimableAmount = claimable.reduce(
        (s: number, e: any) => s + Number(e.taxAmount),
        0
    );

    return { entries, totalTaxableBase, totalTaxAmount, claimableAmount };
}

/**
 * Post SalesTaxEntry จาก Invoice
 * เรียกได้ตอน invoice.status → POSTED
 */
async function postSalesTaxEntry(
    input: {
        sourceType: string;
        sourceId: string;
        partnerId?: string;
        partnerName?: string;
        taxCode?: string;
        taxRate: number;
        taxableBaseAmount: number;
        taxAmount: number;
        postedBy: string;
    },
    ctx: RequestContext,
    tx: any = db
) {
    const now = new Date();
    return (tx as any).salesTaxEntry.create({
        data: {
            shopId: ctx.shopId,
            ...input,
            taxMonth: now.getMonth() + 1,
            taxYear: now.getFullYear(),
            postingStatus: 'POSTED',
            postedAt: now,
        },
    });
}

/**
 * Post PurchaseTaxEntry จาก Purchase Tax Document
 */
async function postPurchaseTaxEntry(
    input: {
        sourceType: string;
        sourceId: string;
        vendorDocNo?: string;
        vendorDocDate?: Date;
        partnerId?: string;
        partnerName?: string;
        taxCode?: string;
        taxRate: number;
        taxableBaseAmount: number;
        taxAmount: number;
        claimStatus: 'CLAIMABLE' | 'WAITING_DOC' | 'NON_CLAIMABLE';
        postedBy: string;
    },
    ctx: RequestContext,
    tx: any = db
) {
    const now = new Date();
    return (tx as any).purchaseTaxEntry.create({
        data: {
            shopId: ctx.shopId,
            ...input,
            taxMonth: now.getMonth() + 1,
            taxYear: now.getFullYear(),
            postingStatus: 'POSTED',
            postedAt: now,
        },
    });
}

/**
 * Void tax entries เมื่อยกเลิก document
 */
async function voidTaxEntries(
    sourceType: string,
    sourceId: string,
    ctx: RequestContext
) {
    const now = new Date();
    await Promise.all([
        (db as any).salesTaxEntry.updateMany({
            where: { shopId: ctx.shopId, sourceType, sourceId },
            data: { postingStatus: 'VOIDED', voidedAt: now },
        }),
        (db as any).purchaseTaxEntry.updateMany({
            where: { shopId: ctx.shopId, sourceType, sourceId },
            data: { postingStatus: 'VOIDED', voidedAt: now },
        }),
    ]);
}

export const TaxSettingsService = {
    // Company
    getCompanyTaxProfile,
    upsertCompanyTaxProfile,
    // Tax Codes
    listTaxCodes,
    listActiveTaxCodes,
    getTaxCodeByCode,
    createTaxCode,
    updateTaxCode,
    toggleTaxCode,
    // Partner
    getPartnerTaxProfile,
    upsertPartnerTaxProfile,
    // Product
    getProductTaxProfile,
    upsertProductTaxProfile,
    // Reports & Posting
    getSalesTaxReport,
    getPurchaseTaxReport,
    postSalesTaxEntry,
    postPurchaseTaxEntry,
    voidTaxEntries,
};
