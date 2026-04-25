import { db } from '@/lib/db';
import { SequenceService } from '@/services/core/system/sequence.service';
import { StockService } from '@/services/inventory/stock.service';
import { InvoiceService } from '@/services/sales/invoice.service';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import {
    DocumentType,
    DeliveryStatus,
    ServiceError,
    type RequestContext,
    type CreateDeliveryOrderInput,
    type GetDeliveryOrdersParams,
} from '@/types/domain';
import { Permission } from '@prisma/client';

// ============================================================================
// PERFORMANCE: Minimal Select Constants (SSOT)
// ============================================================================

/** DO List — ไม่ดึง notes/heavy fields */
const DO_LIST_SELECT = {
    id: true,
    deliveryNo: true,
    status: true,
    scheduledDate: true,
    saleId: true,
    createdAt: true,
    updatedAt: true,
    sale: {
        select: {
            invoiceNumber: true,
            billingStatus: true,
            customer: { select: { name: true } },
        },
    },
} as const;

/** DO Validate — preload ทุกอย่างที่ต้องการใน 1 query */
const DO_VALIDATE_INCLUDE = {
    items: { select: { productId: true, quantity: true } },
    sale: {
        select: {
            id: true,
            shopId: true,
            billingStatus: true,
            paymentMethod: true,
            status: true,
        },
    },
} as const;

/**
 * DeliveryOrderService — ERP B2B Delivery Flow
 *
 * Status Flow:
 *   WAITING    → สต็อกไม่เพียงพอ ณ เวลาสร้าง DO
 *   PROCESSING → มีสต็อกพร้อม, รอ User ยืนยัน (= AVAILABLE)
 *   DELIVERED  → User ยืนยันแล้ว, ตัดสต็อก + Auto Invoice + completeSale
 *   CANCELLED  → ยกเลิก
 */
export const DeliveryOrderService = {
    /**
     * list — รายการ DO พร้อม Pagination
     * ⚡ Performance: select เฉพาะ field จำเป็น
     */
    async list(ctx: RequestContext, params: GetDeliveryOrdersParams) {
        Security.requirePermission(ctx, 'DELIVERY_VIEW' as Permission);

        const { page = 1, limit = 10, search, status, saleId } = params;
        const skip = (page - 1) * limit;

        const where = {
            shopId: ctx.shopId,
            ...(status && { status }),
            ...(saleId && { saleId }),
            ...(search && {
                OR: [{ deliveryNo: { contains: search, mode: 'insensitive' as const } }],
            }),
        };

        const [data, total] = await Promise.all([
            (db as any).deliveryOrder.findMany({
                where,
                select: DO_LIST_SELECT,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            (db as any).deliveryOrder.count({ where }),
        ]);

        return {
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    },

    /**
     * getById — รายละเอียด DO รายใบ
     */
    async getById(ctx: RequestContext, id: string) {
        Security.requirePermission(ctx, 'DELIVERY_VIEW' as Permission);

        const delivery = await (db as any).deliveryOrder.findUnique({
            where: { id },
            include: {
                sale: { include: { customer: true, items: true } },
                items: { include: { product: { select: { name: true, sku: true, stock: true } } } },
                user: { select: { name: true } },
            },
        });

        if (!delivery || delivery.shopId !== ctx.shopId) {
            throw new ServiceError('ไม่พบใบส่งของ');
        }

        return delivery;
    },

    /**
     * create — สร้าง DO จาก SO
     *
     * ⚡ Stock Check: ตรวจสต็อก 1 query แล้วตั้ง status อัตโนมัติ
     *   - มีสต็อกพอ   → PROCESSING (= AVAILABLE, พร้อมให้กด Done)
     *   - สต็อกไม่พอ  → WAITING   (ต้องรอสต็อก หรือกด "เช็คใหม่")
     */
    async create(ctx: RequestContext, input: CreateDeliveryOrderInput) {
        Security.requirePermission(ctx, 'DELIVERY_VALIDATE' as Permission);

        return AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.SHIPMENT_CREATE,
            targetType: 'DeliveryOrder',
            note: 'สร้างใบส่งของจากรายการขาย',
        }, async () => {
            return db.$transaction(async (tx) => {
                const sale = await tx.sale.findUnique({
                    where: { id: input.saleId },
                    select: { id: true, shopId: true, status: true, items: { select: { productId: true, quantity: true } } },
                });

                if (!sale || sale.shopId !== ctx.shopId) {
                    throw new ServiceError('ไม่พบรายการขาย');
                }

                // ⚡ Single query stock check — ตั้ง initial status อัตโนมัติ
                const stockCheck = await StockService.checkBulkAvailability(
                    input.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
                    ctx.shopId,
                    tx
                );

                const initialStatus = stockCheck.allAvailable
                    ? DeliveryStatus.PROCESSING   // AVAILABLE — พร้อมจัดส่ง
                    : DeliveryStatus.WAITING;     // WAITING — รอสต็อก

                const deliveryNo = await SequenceService.generate(ctx, DocumentType.DELIVERY_ORDER, tx);

                const delivery = await (tx as any).deliveryOrder.create({
                    data: {
                        shopId: ctx.shopId,
                        deliveryNo,
                        saleId: input.saleId,
                        userId: ctx.userId,
                        memberId: ctx.memberId,
                        status: initialStatus,
                        scheduledDate: input.scheduledDate,
                        notes: input.notes,
                        items: {
                            create: input.items.map(item => ({
                                productId: item.productId,
                                quantity: item.quantity,
                                pickedQty: 0,
                            })),
                        },
                    },
                    select: { id: true, deliveryNo: true, status: true, saleId: true },
                });

                return {
                    ...delivery,
                    stockCheck, // ส่งกลับให้ UI แสดง shortages ถ้ามี
                };
            });
        });
    },

    /**
     * checkAvailability — เช็คสต็อกใหม่ สำหรับ DO ที่อยู่ในสถานะ WAITING
     *
     * ถ้าสต็อกพอแล้ว → อัปเดตสถานะ WAITING → PROCESSING
     * ถ้ายังไม่พอ → คืน shortages ให้ User รู้
     */
    async checkAvailability(ctx: RequestContext, id: string) {
        Security.requirePermission(ctx, 'DELIVERY_VALIDATE' as Permission);

        return db.$transaction(async (tx) => {
            const delivery = await (tx as any).deliveryOrder.findUnique({
                where: { id },
                select: {
                    id: true,
                    shopId: true,
                    status: true,
                    deliveryNo: true,
                    items: { select: { productId: true, quantity: true } },
                },
            });

            if (!delivery || delivery.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบใบส่งของ');
            }

            if (delivery.status !== DeliveryStatus.WAITING) {
                throw new ServiceError('สามารถเช็คสต็อกได้เฉพาะ DO ที่รอสต็อกเท่านั้น');
            }

            // ⚡ 1 query สำหรับทุก item
            const stockCheck = await StockService.checkBulkAvailability(
                delivery.items,
                ctx.shopId,
                tx
            );

            if (stockCheck.allAvailable) {
                // อัปเดต WAITING → PROCESSING (AVAILABLE)
                await (tx as any).deliveryOrder.update({
                    where: { id },
                    data: { status: DeliveryStatus.PROCESSING },
                });

                AuditService.record({
                    action: 'DELIVERY_AVAILABLE',
                    targetType: 'DeliveryOrder',
                    targetId: id,
                    note: `DO ${delivery.deliveryNo}: สต็อกพร้อมแล้ว → AVAILABLE`,
                    actorId: ctx.userId,
                    shopId: ctx.shopId,
                }).catch(() => {});
            }

            return { available: stockCheck.allAvailable, shortages: stockCheck.shortages };
        });
    },

    /**
     * validate (= Done) — User ยืนยันการจัดส่ง
     *
     * Guard: ต้องเป็น PROCESSING (AVAILABLE) เท่านั้น
     *
     * Flow (1 Transaction):
     *   1. ตัดสต็อกจริง
     *   2. DO → DELIVERED
     *   3. Sale: deliveryStatus = DELIVERED, bookingStatus = DEDUCTED
     *   4. Auto Invoice: createFromSale + tryPost
     *   5. completeSale: Sale → COMPLETED
     */
    async validate(ctx: RequestContext, id: string) {
        Security.requirePermission(ctx, 'DELIVERY_VALIDATE' as Permission);

        return AuditService.runWithAudit(ctx, {
            action: AUDIT_ACTIONS.SHIPMENT_STATUS,
            targetType: 'DeliveryOrder',
            targetId: id,
            note: 'ยืนยันการจัดส่ง: ตัดสต็อก + Auto Invoice + ปิดรายการขาย',
        }, async () => {
            return db.$transaction(async (tx) => {
                // ⚡ Performance: Preload ทุกอย่างใน 1 query — ไม่ต้อง re-fetch ทีหลัง
                const delivery = await (tx as any).deliveryOrder.findUnique({
                    where: { id },
                    include: DO_VALIDATE_INCLUDE,
                });

                if (!delivery || delivery.shopId !== ctx.shopId) {
                    throw new ServiceError('ไม่พบใบส่งของ');
                }

                // Guard: เฉพาะ PROCESSING (= AVAILABLE) เท่านั้น
                if (delivery.status !== DeliveryStatus.PROCESSING) {
                    if (delivery.status === DeliveryStatus.WAITING) {
                        throw new ServiceError('สต็อกยังไม่พอ กรุณาเช็คสต็อกก่อนยืนยัน');
                    }
                    throw new ServiceError('ใบส่งของนี้ดำเนินการไปแล้ว');
                }

                // ── 1. Deduct Stock ─────────────────────────────────────────
                await StockService.recordMovements(
                    ctx,
                    delivery.items.map((item: any) => ({
                        productId: item.productId,
                        type: 'SALE' as const,
                        quantity: item.quantity,
                        saleId: delivery.saleId,
                        deliveryOrderId: delivery.id,
                        note: `ตัดสต็อกจาก DO: ${delivery.deliveryNo}`,
                        requireStock: true,
                    })),
                    tx
                );

                // ── 2. Update DO → DELIVERED ────────────────────────────────
                await (tx as any).deliveryOrder.update({
                    where: { id },
                    data: { status: DeliveryStatus.DELIVERED, deliveredAt: new Date() },
                });

                // ── 3. Sync Sale delivery status ────────────────────────────
                await tx.sale.update({
                    where: { id: delivery.saleId },
                    data: { deliveryStatus: 'DELIVERED', bookingStatus: 'DEDUCTED' },
                });

                // ── 4. Auto Invoice (ถ้ายังไม่มี Invoice) ──────────────────
                if (delivery.sale.billingStatus === 'UNBILLED') {
                    try {
                        const invoice = await InvoiceService.createFromSale(ctx, delivery.saleId, tx);
                        // tryPost: graceful — ถ้ายังไม่มี CoA ให้ข้ามไปก่อน
                        await InvoiceService.tryPost(ctx, invoice.id, tx);
                    } catch (invoiceErr: any) {
                        // Auto Invoice ไม่ควรหยุด DO ทั้งก้อน
                        console.warn('[DeliveryOrderService] Auto Invoice failed:', invoiceErr?.message);
                    }
                }

                // ── 5. Complete Sale ────────────────────────────────────────
                // Dynamic import เพื่อหลีกเลี่ยง circular dependency
                const { SaleService } = await import('@/services/sales/sale.service');
                await (SaleService as any).completeSale(delivery.saleId, ctx, tx);

                return { success: true, deliveryNo: delivery.deliveryNo };
            });
        });
    },

    /**
     * cancel — ยกเลิก DO (ต้องไม่ใช่ DELIVERED)
     */
    async cancel(ctx: RequestContext, id: string) {
        Security.requirePermission(ctx, 'DELIVERY_VALIDATE' as Permission);

        return db.$transaction(async (tx) => {
            const delivery = await (tx as any).deliveryOrder.findUnique({
                where: { id },
                select: { id: true, shopId: true, status: true, deliveryNo: true },
            });

            if (!delivery || delivery.shopId !== ctx.shopId) {
                throw new ServiceError('ไม่พบใบส่งของ');
            }

            if (delivery.status === DeliveryStatus.DELIVERED) {
                throw new ServiceError('ไม่สามารถยกเลิก DO ที่จัดส่งแล้ว');
            }

            await (tx as any).deliveryOrder.update({
                where: { id },
                data: { status: DeliveryStatus.CANCELLED },
            });

            AuditService.record({
                action: 'DELIVERY_CANCELLED',
                targetType: 'DeliveryOrder',
                targetId: id,
                note: `ยกเลิก DO: ${delivery.deliveryNo}`,
                actorId: ctx.userId,
                shopId: ctx.shopId,
            }).catch(() => {});
        });
    },
};
