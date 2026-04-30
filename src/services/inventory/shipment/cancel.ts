/**
 * shipment-cancel.use-case.ts — Cancel and delete operations
 */
import { db } from '@/lib/db';
import { AuditService } from '@/services/core/system/audit.service';
import { SHIPMENT_AUDIT_POLICIES } from '@/policies/inventory/shipment.policy';
import { serializeShipment } from '@/lib/mappers';
import { LOGISTICS_TAGS, SALES_TAGS } from '@/config/cache-tags';
import {
  RequestContext,
  ServiceError,
  MutationResult,
  SerializedShipment,
  ShipmentStatus,
} from '@/types/domain';
import { STATUS_LABELS, validateTransition } from './helpers';

export const ShipmentCancelUseCase = {
  async cancel(id: string, reason: string | undefined, ctx: RequestContext): Promise<MutationResult<SerializedShipment>> {
    const shipment = await db.shipment.findFirst({ where: { id, shopId: ctx.shopId } });

    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    if (!validateTransition(shipment.status as ShipmentStatus, 'CANCELLED')) {
      throw new ServiceError(`ไม่สามารถยกเลิกได้ — สถานะ "${STATUS_LABELS[shipment.status]}" เป็นสถานะที่ไม่สามารถยกเลิกได้`);
    }

    const result = await AuditService.runWithAudit(
      ctx,
      SHIPMENT_AUDIT_POLICIES.CANCEL(shipment.shipmentNumber!, reason),
      async () => {
        const cancelNote = reason ? `[ยกเลิก] ${reason}` : '[ยกเลิก]';
        const updated = await db.shipment.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            notes: shipment.notes ? `${shipment.notes}\n${cancelNote}` : cancelNote,
          },
        });
        return serializeShipment(updated);
      }
    );

    return {
      data: result,
      affectedTags: [LOGISTICS_TAGS.SHIPMENT.LIST, LOGISTICS_TAGS.SHIPMENT.DETAIL(id), SALES_TAGS.DETAIL(shipment.saleId || '')]
    };
  },

  async delete(id: string, ctx: RequestContext): Promise<MutationResult<void>> {
    const shipment = await db.shipment.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    await db.shipment.delete({ where: { id } });

    return {
      data: undefined,
      affectedTags: [LOGISTICS_TAGS.SHIPMENT.LIST]
    };
  }
};
