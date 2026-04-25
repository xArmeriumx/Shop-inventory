/**
 * TaxResolutionService — เลือก TaxCode ที่เหมาะสมแบบ priority chain
 *
 * Priority (สูงสุดลงล่าง):
 * 1. Line Override (user กำหนดเองใน line item)
 * 2. Product Tax Profile (tax class ของสินค้า)
 * 3. Partner Tax Profile (customer หรือ supplier profile)
 * 4. Company Default (ค่า default ของบริษัท)
 * 5. None (ไม่คิด VAT)
 *
 * Output มี explanation ภาษาไทย สำหรับแสดงให้ user เข้าใจ
 */

import { db } from '@/lib/db';

export type TaxDirection = 'OUTPUT' | 'INPUT';

export interface TaxResolutionInput {
    shopId: string;
    direction: TaxDirection;
    productId?: string;
    customerId?: string;
    supplierId?: string;
    lineOverrideCode?: string; // ถ้า user override เอง
    tx?: any;
}

export interface ResolvedTaxCode {
    code: string;
    name: string;
    rate: number;
    kind: string;
    calculationMode: string;
    resolvedFrom:
    | 'LINE_OVERRIDE'
    | 'PRODUCT'
    | 'PARTNER'
    | 'COMPANY_DEFAULT'
    | 'NONE';
    explanation: string; // ภาษาไทย สำหรับแสดง UX
}

const NO_TAX_RESULT: ResolvedTaxCode = {
    code: 'NOVAT',
    name: 'ไม่มี VAT',
    rate: 0,
    kind: 'NO_VAT',
    calculationMode: 'EXCLUSIVE',
    resolvedFrom: 'NONE',
    explanation: 'ไม่พบ Tax Code — รายการนี้ไม่คิด VAT',
};

async function resolve(input: TaxResolutionInput, tx?: any): Promise<ResolvedTaxCode> {
    const { shopId, direction, productId, customerId, supplierId, lineOverrideCode } = input;
    const client = tx || input.tx || db;

    // Step 1: Line Override
    if (lineOverrideCode) {
        const tc = await client.taxCode.findUnique({
            where: { shopId_code: { shopId, code: lineOverrideCode } },
        });
        if (tc && tc.isActive) {
            return {
                code: tc.code,
                name: tc.name,
                rate: Number(tc.rate),
                kind: tc.kind,
                calculationMode: tc.calculationMode,
                resolvedFrom: 'LINE_OVERRIDE',
                explanation: `ใช้ Tax Code "${tc.name}" ตามที่ระบุในรายการ`,
            };
        }
    }

    // Step 2: Product Tax Profile
    if (productId) {
        const pp = await client.productTaxProfile.findUnique({
            where: { productId },
        });
        if (pp) {
            const taxCodeValue = direction === 'OUTPUT' ? pp.salesTaxCode : pp.purchaseTaxCode;
            if (taxCodeValue) {
                const tc = await client.taxCode.findUnique({
                    where: { shopId_code: { shopId, code: taxCodeValue } },
                });
                if (tc && tc.isActive) {
                    return {
                        code: tc.code,
                        name: tc.name,
                        rate: Number(tc.rate),
                        kind: tc.kind,
                        calculationMode: tc.calculationMode,
                        resolvedFrom: 'PRODUCT',
                        explanation: `ใช้ "${tc.name}" ตาม Tax Profile ของสินค้า (${pp.taxClass})`,
                    };
                }
            }
            // Product มี taxClass แต่ไม่มี taxCode — map จาก class
            if (pp.taxClass === 'EXEMPT') {
                return {
                    code: 'EXEMPT_OUT',
                    name: 'ยกเว้น VAT',
                    rate: 0,
                    kind: 'EXEMPT',
                    calculationMode: 'EXCLUSIVE',
                    resolvedFrom: 'PRODUCT',
                    explanation: `รายการนี้ยกเว้น VAT เพราะสินค้ามี Tax Class = EXEMPT${pp.exemptReason ? ` (${pp.exemptReason})` : ''}`,
                };
            }
            if (pp.taxClass === 'NO_VAT') {
                return {
                    ...NO_TAX_RESULT,
                    resolvedFrom: 'PRODUCT',
                    explanation: 'สินค้านี้ไม่อยู่ในระบบ VAT (Tax Class = NO_VAT)',
                };
            }
        }
    }

    // Step 3: Partner Tax Profile
    const partnerId = customerId || supplierId;
    if (partnerId) {
        const where = customerId ? { customerId } : { supplierId };
        const pp = await (client.partnerTaxProfile as any).findUnique({ where });
        if (pp) {
            const taxCodeValue =
                direction === 'OUTPUT' ? pp.defaultSalesTaxCode : pp.defaultPurchaseTaxCode;
            if (taxCodeValue) {
                const tc = await client.taxCode.findUnique({
                    where: { shopId_code: { shopId, code: taxCodeValue } },
                });
                if (tc && tc.isActive) {
                    return {
                        code: tc.code,
                        name: tc.name,
                        rate: Number(tc.rate),
                        kind: tc.kind,
                        calculationMode: tc.calculationMode,
                        resolvedFrom: 'PARTNER',
                        explanation: `ใช้ "${tc.name}" ตาม Tax Profile ของคู่ค้า`,
                    };
                }
            }
            if (!pp.isVatRegistrant) {
                return {
                    ...NO_TAX_RESULT,
                    resolvedFrom: 'PARTNER',
                    explanation: 'คู่ค้านี้ไม่ใช่ผู้ประกอบการจด VAT — ไม่คิด VAT',
                };
            }
        }
    }

    // Step 4: Company Default
    const companyProfile = await client.companyTaxProfile.findUnique({
        where: { shopId },
    });
    if (companyProfile) {
        if (!companyProfile.isVatRegistered) {
            return {
                ...NO_TAX_RESULT,
                resolvedFrom: 'COMPANY_DEFAULT',
                explanation: 'บริษัทยังไม่จด VAT — ไม่คิด VAT',
            };
        }
        const taxCodeValue =
            direction === 'OUTPUT'
                ? companyProfile.defaultSalesTaxCode
                : companyProfile.defaultPurchaseTaxCode;
        if (taxCodeValue) {
            const tc = await client.taxCode.findUnique({
                where: { shopId_code: { shopId, code: taxCodeValue } },
            });
            if (tc && tc.isActive) {
                return {
                    code: tc.code,
                    name: tc.name,
                    rate: Number(tc.rate),
                    kind: tc.kind,
                    calculationMode: tc.calculationMode,
                    resolvedFrom: 'COMPANY_DEFAULT',
                    explanation: `ใช้ "${tc.name}" ตาม Tax Code เริ่มต้นของบริษัท`,
                };
            }
        }
    }

    // Step 5: None
    return NO_TAX_RESULT;
}

/**
 * Resolve หลาย lines พร้อมกัน (batch)
 */
async function resolveMany(
    inputs: TaxResolutionInput[],
    tx?: any
): Promise<ResolvedTaxCode[]> {
    return Promise.all(inputs.map(input => resolve(input, tx)));
}

export const TaxResolutionService = {
    resolve,
    resolveMany,
};
