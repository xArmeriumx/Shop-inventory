import { db, runInTransaction } from '@/lib/db';
import {
  RequestContext,
  ServiceError,
  ShipmentStatus,
  SHIPMENT_STATUS_TRANSITIONS,
  DocumentType,
  GetShipmentsParams,
} from '@/types/domain';
import { IShippingService } from '@/types/service-contracts';
import { SequenceService } from '@/services/core/system/sequence.service';
import { SaleService } from '@/services/sales/sale.service';
import { UpdateShipmentInput, UpdateShipmentStatusInput } from '@/schemas/sales/shipment.schema';
import { SpatialPoint, sortShipmentsByRoute } from '@/lib/spatial-utils';
import { AuditService } from '@/services/core/system/audit.service';
import { SHIPMENT_AUDIT_POLICIES } from '@/policies/inventory/shipment.policy';
import { Security } from '@/services/core/iam/security.service';
import { serializeShipment, serializeSale } from '@/lib/mappers';
import { Prisma } from '@prisma/client';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอจัดส่ง',
  PROCESSING: 'กำลังแพ็ค',
  SHIPPED: 'ส่งแล้ว',
  DELIVERED: 'ถึงผู้รับแล้ว',
  RETURNED: 'ตีกลับ',
  CANCELLED: 'ยกเลิก',
};

export interface OcrParcel {
  trackingNumber: string;
  shippingProvider: string;
  recipientName: string;
  recipientPhone: string | null;
  province: string | null;
  shippingCost: number | null;
  weight: string | null;
  size: string | null;
}

export interface ParcelMatch {
  parcel: OcrParcel;
  sale: {
    id: string;
    invoiceNumber: string;
    customerName: string | null;
    totalAmount: number;
    customer: { name: string; phone: string | null } | null;
  } | null;
  confidence: 'high' | 'none';
}

export function validateTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(status: ShipmentStatus): ShipmentStatus[] {
  return SHIPMENT_STATUS_TRANSITIONS[status] || [];
}

export const ShipmentService: IShippingService = {
  async getList(params: GetShipmentsParams = {}, ctx: RequestContext) {
    const { page = 1, limit = 20, search, startDate, endDate, status } = params;
    const where: Prisma.ShipmentWhereInput = { shopId: ctx.shopId };

    if (search) {
      where.OR = [
        { shipmentNumber: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (status) {
      where.status = status as ShipmentStatus;
    }

    const [shipments, total] = await Promise.all([
      db.shipment.findMany({
        where,
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              customerName: true,
              totalAmount: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.shipment.count({ where }),
    ]);

    return {
      data: shipments.map((shipment) => ({
        ...serializeShipment(shipment),
        sale: shipment.sale ? {
          ...shipment.sale,
          totalAmount: Number(shipment.sale.totalAmount),
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  },

  async getById(id: string, ctx: RequestContext) {
    const shipment = await db.shipment.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        sale: {
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, sku: true },
                },
              },
            },
            customer: true,
          },
        },
        partnerAddress: true,
      } as any,
    });

    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');

    return {
      ...serializeShipment(shipment),
      allowedTransitions: getAllowedTransitions(shipment.status as ShipmentStatus),
      sale: (shipment as any).sale ? {
        ...serializeSale((shipment as any).sale),
        items: (((shipment as any).sale?.items) || []).map((item: any) => ({
          ...item,
          salePrice: Number(item.salePrice || 0),
          costPrice: Number(item.costPrice || 0),
          subtotal: Number(item.subtotal || 0),
          profit: Number(item.profit || 0),
        }))
      } : null,
    };
  },

  async getSalesWithoutShipment(ctx: RequestContext) {
    const sales = await db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        status: { in: ['ACTIVE', 'CONFIRMED', 'INVOICED'] },
        OR: [
          { shipments: { none: {} } },
          { shipments: { every: { status: 'CANCELLED' } } },
        ],
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return sales.map(sale => serializeSale(sale));
  },

  async create(data: any, ctx: RequestContext) {
    return AuditService.runWithAudit(
      ctx,
      SHIPMENT_AUDIT_POLICIES.CREATE('PENDING_SN'),
      async () => {
        try {
          return await runInTransaction(undefined, async (prisma) => {
            const sale = await prisma.sale.findFirst({
              where: { id: data.saleId, shopId: ctx.shopId, status: 'ACTIVE' },
              include: { shipments: { select: { id: true, status: true } } },
            });

            if (!sale) throw new ServiceError('ไม่พบรายการขาย หรือรายการถูกยกเลิกแล้ว');
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
  },

  async update(input: UpdateShipmentInput, ctx: RequestContext) {
    const { id, ...data } = input;
    const shipment = await db.shipment.findFirst({ where: { id, shopId: ctx.shopId } });

    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    if (shipment.status === 'CANCELLED' || shipment.status === 'DELIVERED') {
      throw new ServiceError(`ไม่สามารถแก้ไข Shipment สถานะ "${STATUS_LABELS[shipment.status]}" ได้`);
    }

    const updated = await db.shipment.update({ where: { id }, data });
    return serializeShipment(updated);
  },

  async updateStatus(input: UpdateShipmentStatusInput, ctx: RequestContext) {
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
    return serializeShipment(updated);
  },

  async cancel(id: string, reason: string | undefined, ctx: RequestContext) {
    const shipment = await db.shipment.findFirst({ where: { id, shopId: ctx.shopId } });

    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    if (!validateTransition(shipment.status as ShipmentStatus, 'CANCELLED')) {
      throw new ServiceError(`ไม่สามารถยกเลิกได้ — สถานะ "${STATUS_LABELS[shipment.status]}" เป็นสถานะที่ไม่สามารถยกเลิกได้`);
    }

    return AuditService.runWithAudit(
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
  },

  async getStats(ctx: RequestContext) {
    const stats = await db.shipment.groupBy({
      by: ['status'],
      where: { shopId: ctx.shopId },
      _count: true,
    });

    const result: Record<string, number> = {
      PENDING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      RETURNED: 0,
      CANCELLED: 0,
    };

    stats.forEach((s) => {
      result[s.status] = s._count;
    });

    return result;
  },

  async updateStatusWithSync(shipmentId: string, newStatus: ShipmentStatus, ctx: RequestContext) {
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

          let parentDeliveryStatus = shipment.sale.deliveryStatus;

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
  },

  async updateDispatchSequence(shipmentIds: string[], ctx: RequestContext) {
    await runInTransaction(undefined, async (prisma) => {
      await Promise.all(shipmentIds.map((id, index) =>
        prisma.shipment.update({
          where: { id, shopId: ctx.shopId },
          data: { dispatchSeq: index + 1 },
        })
      ));
    });
  },

  async processRoute(ids: string[], type: 'OUTBOUND' | 'INBOUND', ctx: RequestContext) {
    return AuditService.runWithAudit(
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
        return shipments.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
      }
    );
  },

  async calculateLoad(id: string, ctx: RequestContext) {
    const shipment = await db.shipment.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        sale: {
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, sku: true, metadata: true }
                }
              }
            }
          }
        }
      } as any
    });

    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');

    let totalWeight = 0; // kg
    let totalCbm = 0;    // m3
    let itemCount = 0;

    const items = (shipment as any).sale?.items || [];

    for (const item of items) {
      const qty = item.quantity;
      const metadata = (item.product.metadata as any) || {};

      const weight = metadata.weight || 0.5;
      const length = metadata.length || 20;
      const width = metadata.width || 15;
      const height = metadata.height || 10;

      const itemCbm = (length * width * height) / 1000000;

      totalWeight += weight * qty;
      totalCbm += itemCbm * qty;
      itemCount += qty;
    }

    const containers = [
      { name: '20ft Standard', capacityCbm: 33, capacityWeight: 28000 },
      { name: '40ft Standard', capacityCbm: 67, capacityWeight: 26000 },
      { name: '40ft High Cube', capacityCbm: 76, capacityWeight: 26000 },
    ];

    const recommendation = containers.find(c => c.capacityCbm >= totalCbm && c.capacityWeight >= totalWeight)
      || { name: 'Requires Multiple Containers / Bulk', capacityCbm: 0, capacityWeight: 0 };

    return {
      shipmentNumber: shipment.shipmentNumber,
      totalItems: itemCount,
      totalWeight: Number(totalWeight.toFixed(2)),
      totalCbm: Number(totalCbm.toFixed(4)),
      recommendedContainer: recommendation.name,
      utilization: recommendation.capacityCbm > 0
        ? Number(((totalCbm / recommendation.capacityCbm) * 100).toFixed(2))
        : 0
    };
  },

  async matchParcelsToSales(parcels: any[], ctx: RequestContext) {
    const sales = await db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        status: { in: ['ACTIVE', 'CONFIRMED', 'INVOICED'] },
        OR: [
          { shipments: { none: {} } },
          { shipments: { every: { status: 'CANCELLED' } } },
        ],
      },
      include: {
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });

    const normalizePhone = (phone: string | null | undefined): string | null => {
      if (!phone) return null;
      let normalized = phone.replace(/[-\s+]/g, '');
      if (normalized.startsWith('66')) normalized = '0' + normalized.slice(2);
      if (normalized.startsWith('+66')) normalized = '0' + normalized.slice(3);
      return normalized;
    };

    return parcels.map((parcel) => {
      const parcelPhone = normalizePhone(parcel.recipientPhone);
      if (!parcelPhone) return { parcel, sale: null, confidence: 'none' as const };

      const match = sales.find((s) => {
        const custPhone = normalizePhone(s.customer?.phone);
        return custPhone && custPhone === parcelPhone;
      });

      if (match) {
        return {
          parcel,
          sale: {
            id: match.id,
            invoiceNumber: match.invoiceNumber,
            customerName: match.customer?.name || match.customerName,
            totalAmount: Number(match.totalAmount),
            customer: match.customer,
          },
          confidence: 'high' as const,
        };
      }

      return { parcel, sale: null, confidence: 'none' as const };
    });
  },

  async getLogisticsGaps(ctx: RequestContext) {
    Security.requirePermission(ctx, 'SHIPMENT_VIEW');
    const customers = await db.customer.findMany({
      where: {
        shopId: ctx.shopId,
        OR: [{ latitude: null }, { longitude: null }],
        sales: { some: { shipments: { some: {} } } }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        latitude: true,
        longitude: true,
        _count: { select: { sales: true } }
      },
      orderBy: { sales: { _count: 'desc' } },
      take: 50
    });
    return customers;
  },

  async delete(id: string, ctx: RequestContext): Promise<void> {
    const shipment = await db.shipment.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!shipment) throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    await db.shipment.delete({ where: { id } });
  }
};
