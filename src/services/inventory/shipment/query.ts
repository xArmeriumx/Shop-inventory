/**
 * shipment-query.service.ts — Read-only operations for Shipments
 */
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Security } from '@/services/core/iam/security.service';
import { serializeShipment, serializeSale } from '@/lib/mappers';
import {
  RequestContext,
  ServiceError,
  GetShipmentsParams,
  PaginatedResult,
  SerializedShipment,
  ShipmentStatus,
} from '@/types/domain';
import { getAllowedTransitions } from './helpers';

export const ShipmentQueryService = {
  async getList(params: GetShipmentsParams = {}, ctx: RequestContext): Promise<PaginatedResult<SerializedShipment>> {
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
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        customerAddress: true,
        customerPhone: true,
        totalAmount: true,
        date: true,
        customer: {
          select: { id: true, name: true, phone: true, address: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return sales.map(sale => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
    }));
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
  }
};
