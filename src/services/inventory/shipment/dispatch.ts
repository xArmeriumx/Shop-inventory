/**
 * shipment-dispatch.use-case.ts — Status updates and dispatch routing
 */
import { db, runInTransaction } from '@/lib/db';
import { AuditService } from '@/services/core/system/audit.service';
import { SHIPMENT_AUDIT_POLICIES } from '@/policies/inventory/shipment.policy';
import { serializeShipment } from '@/lib/mappers';
import { SaleService } from '@/services/sales/sale.service';
import { SpatialPoint, sortShipmentsByRoute } from '@/lib/spatial-utils';
import { LOGISTICS_TAGS, SALES_TAGS } from '@/config/cache-tags';
import {
  RequestContext,
  ServiceError,
  MutationResult,
  SerializedShipment,
  ShipmentStatus,
} from '@/types/domain';
import { UpdateShipmentStatusInput } from '@/schemas/sales/shipment.schema';
import { STATUS_LABELS, validateTransition, getAllowedTransitions } from './helpers';

export const ShipmentDispatchUseCase = {
  async updateStatus(input: UpdateShipmentStatusInput, ctx: RequestContext): Promise<MutationResult<SerializedShipment>> {
    const { id, status: newStatus } = input;
    const shipment = await db.shipment.findFirst({ where: { id, shopId: ctx.shopId } });

    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');

    if (!validateTransition(shipment.status as ShipmentStatus, newStatus as ShipmentStatus)) {
      const allowed = getAllowedTransitions(shipment.status as ShipmentStatus)
        .map((s) => STATUS_LABELS[s])
        .join(', ');
      throw new ServiceError(
        `ไม่สามารถเปลี่ยนสถานะจาก "${STATUS_LABELS[shipment.status]}" เป็น "${STATUS_LABELS[newStatus]}" ได้` +
        (allowed ? ` (สถานะที่เปลี่ยนได้: ${allowed})` : ' (สถานะนี้เป็น final)')
      );
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'SHIPPED') updateData.shippedAt = new Date();
    else if (newStatus === 'DELIVERED') updateData.deliveredAt = new Date();
    else if (newStatus === 'PENDING') {
      updateData.shippedAt = null;
      updateData.deliveredAt = null;
    }

    const updated = await db.shipment.update({ where: { id }, data: updateData });

    return {
      data: serializeShipment(updated),
      affectedTags: [LOGISTICS_TAGS.SHIPMENT.LIST, LOGISTICS_TAGS.SHIPMENT.DETAIL(id)]
    };
  },

  async updateStatusWithSync(shipmentId: string, newStatus: ShipmentStatus, ctx: RequestContext): Promise<MutationResult<any>> {
    const shipmentRef = await db.shipment.findFirst({ where: { id: shipmentId, shopId: ctx.shopId } });
    if (!shipmentRef) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');

    await AuditService.runWithAudit(
      ctx,
      SHIPMENT_AUDIT_POLICIES.UPDATE_STATUS(shipmentRef.shipmentNumber!, newStatus),
      async () => {
        return await runInTransaction(undefined, async (prisma) => {
          const shipment = await prisma.shipment.findFirst({
            where: { id: shipmentId, shopId: ctx.shopId },
            include: { sale: true },
          });

          if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');

          await prisma.shipment.update({
            where: { id: shipmentId },
            data: {
              status: newStatus,
              shippedAt: newStatus === 'SHIPPED' ? new Date() : undefined,
              deliveredAt: newStatus === 'DELIVERED' ? new Date() : undefined,
            },
          });

          let parentDeliveryStatus = (shipment as any).sale.deliveryStatus;

          if (newStatus === 'SHIPPED') {
            await SaleService.completeSale(shipment.saleId, ctx, prisma);
            parentDeliveryStatus = 'SHIPPED';
          } else if (newStatus === 'DELIVERED') {
            parentDeliveryStatus = 'DELIVERED';
          } else if (newStatus === 'PENDING') {
            parentDeliveryStatus = 'PENDING';
          }

          await prisma.sale.update({
            where: { id: shipment.saleId },
            data: { deliveryStatus: parentDeliveryStatus as any }
          });
        });
      }
    );

    return {
      data: undefined,
      affectedTags: [
        LOGISTICS_TAGS.SHIPMENT.LIST, 
        LOGISTICS_TAGS.SHIPMENT.DETAIL(shipmentId), 
        SALES_TAGS.DETAIL(shipmentRef.saleId || ''),
        SALES_TAGS.LIST
      ]
    };
  },

  async updateDispatchSequence(shipmentIds: string[], ctx: RequestContext): Promise<MutationResult<any>> {
    await runInTransaction(undefined, async (prisma) => {
      await Promise.all(shipmentIds.map((id, index) =>
        prisma.shipment.update({
          where: { id, shopId: ctx.shopId },
          data: { dispatchSeq: index + 1 },
        })
      ));
    });

    return {
      data: undefined,
      affectedTags: [LOGISTICS_TAGS.SHIPMENT.LIST]
    };
  },

  async processRoute(ids: string[], type: 'OUTBOUND' | 'INBOUND', ctx: RequestContext): Promise<MutationResult<SerializedShipment[]>> {
    const result = await AuditService.runWithAudit(
      ctx,
      SHIPMENT_AUDIT_POLICIES.ROUTE_PROCESSED(type, ids.length),
      async () => {
        const shop = await db.shop.findUnique({
          where: { id: ctx.shopId },
          select: { latitude: true, longitude: true },
        });

        if (!shop || shop.latitude === null || shop.longitude === null) {
          throw new ServiceError(
            'ยังไม่สามารถคำนวณเส้นทางได้เนื่องจากพิกัดร้านค้าไม่ครบถ้วน',
            undefined,
            { label: 'ไปที่ตั้งค่าร้านค้า', href: '/settings' }
          );
        }

        const origin: SpatialPoint = {
          latitude: shop.latitude!,
          longitude: shop.longitude!,
        };

        const shipments = await db.shipment.findMany({
          where: { id: { in: ids }, shopId: ctx.shopId },
          include: { partnerAddress: true } as any
        });

        const shippableItems = shipments.map(s => ({
          id: s.id,
          createdAt: s.createdAt,
          latitude: (s as any).partnerAddress?.latitude ?? null,
          longitude: (s as any).partnerAddress?.longitude ?? null,
        }));

        const sortedItems = sortShipmentsByRoute(shippableItems, type, origin);
        const sortedIds = sortedItems.map(item => item.id);

        await this.updateDispatchSequence(sortedIds, ctx);

        const idToIndex = new Map(sortedIds.map((id, index) => [id, index]));
        return shipments.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0)).map(s => serializeShipment(s));
      }
    );

    return {
      data: result,
      affectedTags: [LOGISTICS_TAGS.SHIPMENT.LIST]
    };
  }
};
