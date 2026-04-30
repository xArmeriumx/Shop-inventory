import { db } from '@/lib/db';
import { SequenceService } from '@/services/core/system/sequence.service';
import { StockService } from '@/services/inventory/stock.service';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { Permission } from '@prisma/client';
import { LOGISTICS_TAGS, SALES_TAGS } from '@/config/cache-tags';
import {
    DocumentType,
    DeliveryStatus,
    ServiceError,
    type RequestContext,
    type CreateDeliveryOrderInput,
    type MutationResult,
} from '@/types/domain';

export const DeliveryOrderCreate = {
    async create(ctx: RequestContext, input: CreateDeliveryOrderInput): Promise<MutationResult<any>> {
        Security.requirePermission(ctx, 'DELIVERY_VALIDATE' as Permission);

        const result = await AuditService.runWithAudit(ctx, {
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

        return {
            data: result,
            affectedTags: [LOGISTICS_TAGS.DELIVERY.LIST, SALES_TAGS.DETAIL(input.saleId)]
        };
    }
};
