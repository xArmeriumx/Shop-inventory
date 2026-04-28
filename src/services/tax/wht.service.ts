import { db } from '@/lib/db';
import { RequestContext, ServiceError, DocumentType } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { Prisma, Permission } from '@prisma/client';

import { money, toNumber } from '@/lib/money';
import { Decimal } from '@prisma/client/runtime/library';
const WhtPayeeType = { INDIVIDUAL: "INDIVIDUAL", CORPORATE: "CORPORATE", UNKNOWN: "UNKNOWN", ANY: "ANY" } as any;
const WhtFormType = { PND3: "PND3", PND53: "PND53" } as any;
const TaxPostingStatus = { DRAFT: "DRAFT", POSTED: "POSTED", VOIDED: "VOIDED" } as any;

import { IWhtService } from '@/types/service-contracts';
import { TAX_TAGS } from '@/config/cache-tags';

/**
 * WhtService — บริหารจัดการภาษีหัก ณ ที่จ่าย (Withholding Tax)
 * 
 * หน้าที่:
 * 1. คำนวณภาษีหัก ณ ที่จ่าย (WHT Calculation)
 * 2. บันทึกรายการลง Ledger (WhtEntry)
 * 3. ออกหนังสือรับรองหัก ณ ที่จ่าย (WhtCertificate - 50 ทวิ)
 * 4. เตรียมข้อมูลสำหรับรายงาน ภ.ง.ด. 3 และ ภ.ง.ด. 53
 */
export const WhtService: IWhtService = {
    /**
     * คำนวณยอดเงิน WHT ตามมาตรฐาน ERP
     * grossPayableAmount - whtAmount = netPaidAmount
     */
    calculate(params: {
        amount: number | Decimal;
        rate: number | Decimal;
        isGrossUp?: boolean; // สำหรับกรณีออกให้ (หัก x/100-x)
    }) {
        const gross = toNumber(params.amount);
        const rate = toNumber(params.rate);

        let whtAmount = 0;

        if (params.isGrossUp) {
            // สูตร Gross-up: amount * (rate / (100 - rate))
            const denominator = money.subtract(100, rate);
            whtAmount = money.multiply(gross, money.divide(rate, denominator));
        } else {
            // สูตรปกติ: amount * (rate / 100)
            whtAmount = money.multiply(gross, money.divide(rate, 100));
        }

        // ปัดเศษทศนิยม 2 ตำแหน่งตามมาตรฐานบัญชีไทย
        whtAmount = money.round(whtAmount, 2);
        const netPaid = money.subtract(gross, whtAmount);

        return {
            grossPayableAmount: gross,
            whtBaseAmount: gross, // โดยปกติฐานเท่ากับยอดก่อนหัก
            whtAmount,
            netPaidAmount: netPaid,
            rate
        };
    },

    /**
     * สร้างรายการหัก ณ ที่จ่าย (Ledger Entry)
     * ต้องเรียกเมื่อมีการชำระเงิน (Payment event)
     */
    async createEntry(ctx: RequestContext, params: any, tx: any = db) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_POST);

        return await db.$transaction(async (tx) => {
            // 1. Create Entry with Snapshots
            const entry = await (tx as any).whtEntry.create({
                data: {
                    shopId: ctx.shopId,
                    memberId: ctx.memberId,
                    paymentId: params.paymentId,
                    partnerId: params.partnerId,

                    // Payee Snapshot
                    payeeNameSnapshot: params.payeeNameSnapshot,
                    payeeTaxIdSnapshot: params.payeeTaxIdSnapshot,
                    payeeBranchSnapshot: params.payeeBranchSnapshot || '00000',
                    payeeTypeSnapshot: params.payeeTypeSnapshot,

                    // Tax Snapshot
                    whtCodeId: params.whtCodeId,
                    formTypeSnapshot: params.formTypeSnapshot,
                    incomeCategorySnapshot: params.incomeCategorySnapshot,
                    rateSnapshot: params.rateSnapshot,

                    // Amounts
                    grossPayableAmount: params.grossPayableAmount,
                    whtBaseAmount: params.whtBaseAmount,
                    whtAmount: params.whtAmount,
                    netPaidAmount: params.netPaidAmount,

                    // Temporal
                    paymentDate: params.paymentDate || new Date(),
                    taxMonth: (params.paymentDate || new Date()).getMonth() + 1,
                    taxYear: (params.paymentDate || new Date()).getFullYear(),

                    status: 'POSTED'
                }
            });

            // 2. Automatically generate Reference Number for Cert (Optional at this stage)
            return {
                data: entry,
                affectedTags: [TAX_TAGS.WHT.LIST]
            };
        });
    },

    /**
     * ดึงข้อมูลรายงานตามประเภทแบบ (ภ.ง.ด. 3 หรือ ภ.ง.ด. 53)
     */
    async getReportData(ctx: RequestContext, params: { year: number; month: number; formType: any }) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_VIEW);

        const data = await (db as any).whtEntry.findMany({
            where: {
                shopId: ctx.shopId,
                taxYear: params.year,
                taxMonth: params.month,
                formTypeSnapshot: params.formType,
                status: 'POSTED'
            },
            orderBy: { paymentDate: 'asc' }
        });

        const totals = data.reduce((acc: any, curr: any) => ({
            base: acc.base.add(curr.whtBaseAmount),
            tax: acc.tax.add(curr.whtAmount)
        }), { base: new Decimal(0), tax: new Decimal(0) });

        return { data, totals };
    },

    /**
     * ค้นหารหัสภาษีหัก ณ ที่จ่าย (Master Data)
     */
    async getCodes(ctx: RequestContext) {
        return await (db as any).whtCode.findMany({
            where: { shopId: ctx.shopId, isActive: true },
            orderBy: { rate: 'asc' }
        });
    },

    /**
     * ดึงข้อมูลรายการหัก ณ ที่จ่ายเดียว
     */
    async getEntryById(id: string, ctx: RequestContext) {
        const entry = await (db as any).whtEntry.findFirst({
            where: { id, shopId: ctx.shopId },
            include: {
                certificate: true,
                payment: true,
            }
        });
        if (!entry) throw new ServiceError('ไม่พบรายการหัก ณ ที่จ่าย');
        return entry;
    },

    /**
     * ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)
     */
    async issueCertificate(ctx: RequestContext, entryId: string) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_POST);

        return await db.$transaction(async (tx) => {
            const entry = await (tx as any).whtEntry.findFirst({
                where: { id: entryId, shopId: ctx.shopId },
                include: { certificate: true }
            });

            if (!entry) throw new ServiceError('ไม่พบรายการหัก ณ ที่จ่าย');
            if (entry.status === 'VOIDED') throw new ServiceError('ไม่สามารถออกใบรับรองสำหรับรายการที่ถูกยกเลิกได้');
            if (entry.certificate) throw new ServiceError('รายการนี้มีการออกใบรับรองไปแล้ว');

            // 1. Generate Certificate Number (WHT-YYMM-XXXXX)
            const certNumber = await SequenceService.generate(ctx, DocumentType.WHT_CERTIFICATE, tx);

            // 2. Create Certificate Record
            const certificate = await (tx as any).whtCertificate.create({
                data: {
                    shopId: ctx.shopId,
                    memberId: ctx.memberId!,
                    whtEntryId: entry.id,
                    certNumber,
                    issuedDate: new Date(),
                    status: 'POSTED',
                    // Note: PDF will be generated on demand or stored here
                    pdfUrl: `/api/pdf/wht/${certNumber}`,
                }
            });

            return {
                data: certificate,
                affectedTags: [TAX_TAGS.WHT.LIST, TAX_TAGS.WHT.DETAIL(entryId)]
            };
        });
    },

    /**
     * ยกเลิกหนังสือรับรอง
     */
    async voidCertificate(ctx: RequestContext, certId: string) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_POST);

        const existing = await (db as any).whtCertificate.findFirst({
            where: { id: certId, shopId: ctx.shopId }
        });

        if (!existing) throw new ServiceError('ไม่พบหนังสือรับรอง');
        if (existing.status === 'VOIDED') throw new ServiceError('หนังสือรับรองนี้ถูกยกเลิกไปแล้ว');

        const voided = await (db as any).whtCertificate.update({
            where: { id: certId },
            data: { status: 'VOIDED' }
        });

        return {
            data: voided,
            affectedTags: [TAX_TAGS.WHT.LIST]
        };
    },

    /** ดึงรหัสภาษีทั้งหมด (ทั้ง Active และ Inactive) เพื่อใช้บน Settings UI */
    async getCodesAll(ctx: RequestContext) {
        return await (db as any).whtCode.findMany({
            where: { shopId: ctx.shopId },
            orderBy: { rate: 'asc' },
        });
    },

    /** สร้าง หรือ อัปเดตรหัสภาษีหัก ณ ที่จ่าย */
    async upsertCode(ctx: RequestContext, data: any, id?: string) {
        if (id) {
            await (db as any).whtCode.update({
                where: { id, shopId: ctx.shopId },
                data,
            });
        } else {
            await (db as any).whtCode.upsert({
                where: { shopId_code: { shopId: ctx.shopId, code: data.code } },
                update: data,
                create: { shopId: ctx.shopId, ...data },
            });
        }
        AuditService.log(ctx, {
            action: AUDIT_ACTIONS.WHT_CODE_UPSERT,
            targetType: 'WhtCode',
            note: `${id ? 'อัปเดต' : 'สร้าง'}รหัสภาษี ${data.code} (${data.rate}%)`,
        }).catch(() => { });
    },

    /** เปิด/ปิดรหัสภาษี */
    async toggleCode(ctx: RequestContext, id: string, isActive: boolean) {
        await (db as any).whtCode.update({
            where: { id, shopId: ctx.shopId },
            data: { isActive },
        });
        AuditService.log(ctx, {
            action: AUDIT_ACTIONS.WHT_CODE_TOGGLE,
            targetType: 'WhtCode',
            targetId: id,
            note: `${isActive ? 'เปิด' : 'ปิด'}ใช้งานรหัสภาษี`,
        }).catch(() => { });
    },

    /** ลบรหัสภาษี */
    async deleteCode(ctx: RequestContext, id: string) {
        await (db as any).whtCode.delete({
            where: { id, shopId: ctx.shopId },
        });
        AuditService.log(ctx, {
            action: AUDIT_ACTIONS.WHT_CODE_DELETE,
            targetType: 'WhtCode',
            targetId: id,
            note: `ลบรหัสภาษี`,
        }).catch(() => { });
    },
};

