import { db } from '@/lib/db';
import { StockService } from '@/services/inventory/stock.service';
import { WarehouseService } from '@/services/inventory/warehouse.service';
import { InvoiceService } from '@/services/sales/invoice.service';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { Permission } from '@prisma/client';
import { LOGISTICS_TAGS, SALES_TAGS, INVOICE_TAGS, INVENTORY_TAGS } from '@/config/cache-tags';
import {
    DeliveryStatus,
    ServiceError,
    type RequestContext,
    type MutationResult,
} from '@/types/domain';

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

export const DeliveryOrderAvailabilityEngine = {
    async checkAvailability(ctx: RequestContext, id: string): Promise<MutationResult<any>> {
        Security.requirePermission(ctx, 'DELIVERY_VALIDATE' as Permission);

        const result = await db.$transaction(async (tx) => {
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

        return {
            data: result,
            affectedTags: [LOGISTICS_TAGS.DELIVERY.LIST, LOGISTICS_TAGS.DELIVERY.DETAIL(id)]
        };
    },

    async validate(ctx: RequestContext, id: string): Promise<MutationResult<any>> {
        Security.requirePermission(ctx, 'DELIVERY_VALIDATE' as Permission);

        const result = await AuditService.runWithAudit(ctx, {
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
                // FIX: ส่ง tx ไปด้วยเสมอ — ป้องกัน nested connection deadlock (connection_limit=1)
                const defaultWh = await WarehouseService.getDefaultWarehouse(ctx, tx);
                if (!defaultWh) throw new ServiceError('ไม่พบคลังสินค้าหลัก กรุณาสร้างคลังสินค้าก่อน');

                for (const item of delivery.items) {
                    await WarehouseService.adjustWarehouseStock(ctx, {
                        warehouseId: defaultWh.id,
                        productId: item.productId,
                        delta: -item.quantity
                    }, tx);
                }

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
                        await InvoiceService.tryPost(ctx, invoice.data.id, tx);
                    } catch (invoiceErr: any) {
                        // Auto Invoice ไม่ควรหยุด DO ทั้งก้อน
                        console.warn('[DeliveryOrderService] Auto Invoice failed:', invoiceErr?.message);
                    }
                }

                // ── 5. Complete Sale ────────────────────────────────────────
                // Dynamic import เพื่อหลีกเลี่ยง circular dependency
                const { SaleService } = await import('@/services/sales/sale.service');
                await (SaleService as any).completeSale(delivery.saleId, ctx, tx);

                return { success: true, deliveryNo: delivery.deliveryNo, saleId: delivery.saleId, itemIds: delivery.items.map((i: any) => i.productId) };
            });
        });

        const affectedTags = [
            LOGISTICS_TAGS.DELIVERY.LIST,
            LOGISTICS_TAGS.DELIVERY.DETAIL(id),
            SALES_TAGS.DETAIL(result.saleId),
            SALES_TAGS.LIST,
            INVOICE_TAGS.LIST,
        ];

        // Add stock tags for items
        result.itemIds?.forEach((pid: string) => {
            affectedTags.push(INVENTORY_TAGS.STOCK(pid));
        });

        return {
            data: result,
            affectedTags
        };
    }
};
