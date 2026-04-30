/**
 * shipment-create.use-case.ts — Creation and updating of shipments
 */
import { db, runInTransaction } from '@/lib/db';
import { AuditService } from '@/services/core/system/audit.service';
import { SHIPMENT_AUDIT_POLICIES } from '@/policies/inventory/shipment.policy';
import { SequenceService } from '@/services/core/system/sequence.service';
import { serializeShipment } from '@/lib/mappers';
import { LOGISTICS_TAGS, SALES_TAGS } from '@/config/cache-tags';
import {
  RequestContext,
  ServiceError,
  MutationResult,
  DocumentType,
  SerializedShipment,
} from '@/types/domain';
import { UpdateShipmentInput } from '@/schemas/sales/shipment.schema';
import { STATUS_LABELS } from './helpers';

export const ShipmentCreateUseCase = {
  async create(data: any, ctx: RequestContext): Promise<MutationResult<SerializedShipment>> {
    const result = await AuditService.runWithAudit(
      ctx,
      SHIPMENT_AUDIT_POLICIES.CREATE('PENDING_SN'),
      async () => {
        try {
          return await runInTransaction(undefined, async (prisma) => {
            const sale = await prisma.sale.findFirst({
              where: { id: data.saleId, shopId: ctx.shopId, status: 'CONFIRMED' },
              include: { shipments: { select: { id: true, status: true } } },
            });

            if (!sale) throw new ServiceError('ไม่พบรายการขาย หรือรายการยังไม่ได้ยืนยัน');
            const hasActiveShipment = sale.shipments.some(s => s.status !== 'CANCELLED');
            if (hasActiveShipment) throw new ServiceError('รายการขายนี้มี Shipment ที่ยังใช้งานอยู่แล้ว');

            const shipmentNumber = await SequenceService.generate(ctx, DocumentType.SHIPMENT, prisma);
            const shipment = await prisma.shipment.create({
              data: {
                shipmentNumber,
                saleId: data.saleId,
                recipientName: data.recipientName,
                recipientPhone: data.recipientPhone || null,
                shippingAddress: data.shippingAddress,
                partnerAddressId: data.partnerAddressId || data.customerAddressId || null,
                trackingNumber: data.trackingNumber || null,
                shippingProvider: data.shippingProvider || null,
                shippingCost: data.shippingCost || null,
                status: data.trackingNumber ? 'SHIPPED' : 'PENDING',
                shippedAt: data.trackingNumber ? new Date() : null,
                notes: data.notes || null,
                userId: ctx.userId,
                shopId: ctx.shopId,
              } as any,
            });

            if (data.shippingCost && data.shippingCost > 0) {
              await prisma.expense.create({
                data: {
                  category: 'ค่าจัดส่ง',
                  amount: data.shippingCost,
                  description: `ค่าส่ง ${shipmentNumber} (${sale.invoiceNumber || ''}) - ${data.recipientName}`,
                  date: new Date(),
                  userId: ctx.userId,
                  shopId: ctx.shopId,
                },
              });
            }

            return serializeShipment(shipment);
          });
        } catch (error: unknown) {
          if ((error as any).code === 'P2002') throw new ServiceError('รายการขายนี้มี Shipment ที่ยังใช้งานอยู่แล้ว');
          throw error;
        }
      }
    );

    return {
      data: result,
      affectedTags: [LOGISTICS_TAGS.SHIPMENT.LIST, SALES_TAGS.DETAIL(data.saleId)]
    };
  },

  async update(input: UpdateShipmentInput, ctx: RequestContext): Promise<MutationResult<SerializedShipment>> {
    const { id, ...data } = input;
    const shipment = await db.shipment.findFirst({ where: { id, shopId: ctx.shopId } });

    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    if (shipment.status === 'CANCELLED' || shipment.status === 'DELIVERED') {
      throw new ServiceError(`ไม่สามารถแก้ไข Shipment สถานะ "${STATUS_LABELS[shipment.status]}" ได้`);
    }

    const updated = await db.shipment.update({ where: { id }, data });

    return {
      data: serializeShipment(updated),
      affectedTags: [LOGISTICS_TAGS.SHIPMENT.LIST, LOGISTICS_TAGS.SHIPMENT.DETAIL(id)]
    };
  }
};
