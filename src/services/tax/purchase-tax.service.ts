import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';
import { SequenceService } from '@/services/core/system/sequence.service';
import { TaxCalculationService } from './tax-calculation.service';
import { format } from 'date-fns';
import { Permission } from '@prisma/client';

import { IPurchaseTaxService } from '@/types/service-contracts';
import { TAX_TAGS } from '@/config/cache-tags';

/**
 * PurchaseTaxService — บริหารจัดการเอกสารภาษีซื้อ (Document Lifecycle)
 * 
 * หน้าที่:
 * 1. สร้างเอกสารภาษีซื้อร่าง (Draft) จากใบสั่งซื้อ (PO)
 * 2. snap ข้อมูลซัพพลายเออร์และรายการสินค้า ณ เวลาที่สร้าง
 * 3. จัดการสถานะการลงบัญชี (Post) และการยกเลิก (Void)
 * 4. บันทึกรายงานภาษีซื้อ (PurchaseTaxEntry) เมื่อมีการยืนยัน
 */
export const PurchaseTaxService: IPurchaseTaxService = {
    /**
     * สร้างเอกสารภาษีซื้อจาก Purchase Order (PO)
     * snap ข้อมูล ณ ปัจจุบันเพื่อทำ Audit Trail ที่สมบูรณ์
     */
    async registerFromPurchase(purchaseId: string, ctx: RequestContext) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_POST);

        // 1. Fetch Purchase order with items and supplier
        const purchase = await db.purchase.findFirst({
            where: { id: purchaseId, shopId: ctx.shopId },
            include: {
                supplier: true,
                items: {
                    include: { product: true }
                }
            }
        }) as any;

        if (!purchase) throw new ServiceError('ไม่พบข้อมูลใบสั่งซื้อ');
        if (!purchase.supplier) throw new ServiceError('ข้อมูลซัพพลายเออร์ไม่ครบถ้วน');

        // 2. Generate Internal Document Number (PTX-YYYYMM-XXXX)
        // 3. Create Document with Snapshot Data
        // Validate required member context
        const memberId = ctx.memberId;
        if (!memberId) throw new ServiceError('ไม่พบข้อมูลสมาชิก กรุณเข้าสู่ระบบใหม่อีกครั้ง');

        return await db.$transaction(async (tx) => {
            const internalDocNo = await SequenceService.generate(ctx, 'PURCHASE_TAX' as any, tx);

            // ใช้ข้อมูลจาก PO เป็น placeholder (vendor ต้องกรอก vendorDocNo จริงตอน Post)
            const purchaseDate = purchase.purchaseDate || purchase.createdAt || new Date();

            const doc = await (tx as any).purchaseTaxDocument.create({
                data: {
                    shopId: ctx.shopId,
                    internalDocNo,
                    status: 'DRAFT',
                    memberId,
                    supplierId: purchase.supplierId,
                    // Vendor snapshots
                    vendorNameSnapshot: purchase.supplier?.name || 'Unknown',
                    vendorTaxIdSnapshot: purchase.supplier?.taxId || null,
                    vendorAddressSnapshot: purchase.supplier?.address || null,
                    vendorBranchSnapshot: purchase.supplier?.branchCode || null,
                    // Required fields — placeholder until POST step
                    vendorDocNo: `DRAFT-${internalDocNo}`,
                    vendorDocDate: purchaseDate,
                    // Tax fields (ใช้จาก PO data ไม่ hardcode)
                    taxRateSnapshot: purchase.taxRate || 7,
                    taxCodeSnapshot: purchase.taxCode || null,
                    subtotalAmount: purchase.subtotalAmount || purchase.taxableAmount || 0,
                    discountAmount: purchase.discountAmount || 0,
                    taxableBaseAmount: purchase.taxableAmount || 0,
                    taxAmount: purchase.taxAmount || 0,
                    netAmount: purchase.totalAmount || 0,
                    claimStatus: 'CLAIMABLE',
                    links: {
                        create: {
                            purchaseOrderId: purchase.id,
                            allocatedAmount: purchase.totalAmount || 0,
                            shopId: ctx.shopId
                        }
                    },
                    items: {
                        create: (purchase.items || []).map((item: any) => ({
                            shopId: ctx.shopId,
                            productId: item.productId,
                            productNameSnapshot: item.product?.name || 'Unknown',
                            skuSnapshot: item.product?.sku || null,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice || 0,
                            discountAmount: item.discountAmount || 0,
                            taxableBaseAmount: item.taxableAmount || 0,
                            taxAmount: item.taxAmount || 0,
                            lineNetAmount: item.totalAmount || 0,
                            taxRateSnapshot: item.taxRate || purchase.taxRate || 7,
                        }))
                    }
                }
            });

            return {
                data: doc,
                affectedTags: [TAX_TAGS.PURCHASE_TAX.LIST]
            };
        });
    },

    /**
     * ลงบัญชีเอกสาร: อัปเดตข้อมูลเลขที่ใบกำกับภาษี และยืนยันยอดเข้ารายงาน ภ.พ. 30
     */
    async post(id: string, input: { vendorDocNo: string; vendorDocDate: Date; claimStatus: string }, ctx: RequestContext) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_POST);

        const now = new Date();
        const doc = await (db as any).purchaseTaxDocument.findUnique({
            where: { id, shopId: ctx.shopId },
        });

        if (!doc) throw new ServiceError('ไม่พบเอกสาร');
        if (doc.status !== 'DRAFT') throw new ServiceError('เอกสารไม่ได้อยู่ในสถานะร่าง');

        // vendorDocDate ต้องใช้เป็น taxMonth/taxYear SSOT (ไม่ใช่ now)
        const taxDate = input.vendorDocDate;

        return await db.$transaction(async (tx) => {
            // 1. Update Document
            const postedDoc = await (tx as any).purchaseTaxDocument.update({
                where: { id },
                data: {
                    status: 'POSTED',
                    postedAt: now,
                    postedByMemberId: ctx.memberId ?? null,
                    vendorDocNo: input.vendorDocNo,
                    vendorDocDate: input.vendorDocDate,
                    claimStatus: input.claimStatus,
                },
            });

            // 2. Generate PurchaseTaxEntry ONLY if CLAIMABLE
            if (input.claimStatus === 'CLAIMABLE') {
                await (tx as any).purchaseTaxEntry.create({
                    data: {
                        shopId: ctx.shopId,
                        sourceType: 'PURCHASE_TAX_DOC',
                        sourceId: id,
                        // taxMonth/taxYear ต้องอิงจาก vendorDocDate ไม่ใช่วันนี้
                        taxMonth: taxDate.getMonth() + 1,
                        taxYear: taxDate.getFullYear(),
                        vendorDocNo: input.vendorDocNo,
                        vendorDocDate: input.vendorDocDate,
                        partnerId: postedDoc.supplierId,
                        partnerName: postedDoc.vendorNameSnapshot,
                        taxCode: postedDoc.taxCodeSnapshot,
                        taxRate: postedDoc.taxRateSnapshot,
                        taxableBaseAmount: postedDoc.taxableBaseAmount,
                        taxAmount: postedDoc.taxAmount,
                        claimStatus: 'CLAIMABLE',
                        postingStatus: 'POSTED',
                        postedAt: now,
                        postedBy: ctx.memberId ?? null,
                    },
                });
            }

            return {
                data: postedDoc,
                affectedTags: [TAX_TAGS.PURCHASE_TAX.LIST, TAX_TAGS.PURCHASE_TAX.DETAIL(id)]
            };
        });
    },

    /**
     * ยกเลิกเอกสารภาษี: Reverse สถานะและยกเลิกรายการในรายงานภาษี
     */
    async void(id: string, ctx: RequestContext) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_POST);

        const now = new Date();
        const doc = await (db as any).purchaseTaxDocument.findUnique({ where: { id, shopId: ctx.shopId } });

        if (!doc) throw new ServiceError('ไม่พบเอกสาร');
        if (doc.status === 'VOIDED') throw new ServiceError('เอกสารถูกยกเลิกไปแล้ว');

        return await db.$transaction(async (tx) => {
            const voidedDoc = await (tx as any).purchaseTaxDocument.update({
                where: { id },
                data: { status: 'VOIDED' }
            });

            // Reverse Tax Entry
            await (tx as any).purchaseTaxEntry.updateMany({
                where: { shopId: ctx.shopId, sourceType: 'PURCHASE_TAX_DOC', sourceId: id },
                data: {
                    postingStatus: 'VOIDED',
                    voidedAt: now
                }
            });

            return {
                data: voidedDoc,
                affectedTags: [TAX_TAGS.PURCHASE_TAX.LIST, TAX_TAGS.PURCHASE_TAX.DETAIL(id)]
            };
        });
    },

    /**
     * ค้นหาและจัดการรายการภาษีซื้อ
     */
    async getList(params: any, ctx: RequestContext) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_VIEW);

        const { page = 1, limit = 20, search, status, claimStatus } = params;
        const skip = (page - 1) * limit;

        const where: any = {
            shopId: ctx.shopId,
            ...(status ? { status } : {}),
            ...(claimStatus ? { claimStatus } : {}),
            ...(search ? {
                OR: [
                    { internalDocNo: { contains: search, mode: 'insensitive' } },
                    { vendorDocNo: { contains: search, mode: 'insensitive' } },
                    { vendorNameSnapshot: { contains: search, mode: 'insensitive' } },
                ]
            } : {})
        };

        const [data, total] = await Promise.all([
            (db as any).purchaseTaxDocument.findMany({
                where,
                include: {
                    // ShopMember.user.name คือ pattern ที่ถูกต้อง (ไม่ใช่ firstName/lastName)
                    postedBy: { select: { user: { select: { name: true } } } },
                    supplier: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            (db as any).purchaseTaxDocument.count({ where })
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        };
    },

    /**
     * ดึงรายละเอียดเอกสารพร้อม Items และ Links
     */
    async getById(id: string, ctx: RequestContext) {
        Security.requirePermission(ctx, Permission.TAX_REPORT_VIEW);

        return await (db as any).purchaseTaxDocument.findUnique({
            where: { id, shopId: ctx.shopId },
            include: {
                items: { orderBy: { createdAt: 'asc' } },
                links: {
                    include: { purchaseOrder: { select: { purchaseNumber: true } } }
                },
                postedBy: { select: { firstName: true, lastName: true } }
            }
        });
    }
};
