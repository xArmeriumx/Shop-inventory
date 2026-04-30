import { db } from '@/lib/db';
import { AuditService } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { Permission } from '@prisma/client';
import { LOGISTICS_TAGS } from '@/config/cache-tags';
import {
    DeliveryStatus,
    ServiceError,
    type RequestContext,
    type MutationResult,
} from '@/types/domain';

export const DeliveryOrderCancel = {
    async cancel(ctx: RequestContext, id: string): Promise<MutationResult<void>> {
        Security.requirePermission(ctx, 'DELIVERY_VALIDATE' as Permission);

        await db.$transaction(async (tx) => {
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

        return {
            data: undefined,
            affectedTags: [LOGISTICS_TAGS.DELIVERY.LIST, LOGISTICS_TAGS.DELIVERY.DETAIL(id)]
        };
    }
};
