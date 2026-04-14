import { db } from '@/lib/db';
import { Prisma, ShipmentStatus } from '@prisma/client';
import { ServiceError, RequestContext } from './product.service';
import { logger } from '@/lib/logger';
import { ShipmentInput, UpdateShipmentInput, UpdateShipmentStatusInput } from '@/schemas/shipment';

// =============================================================================
// STATUS TRANSITION VALIDATION
// =============================================================================

export const STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING:   ['SHIPPED', 'CANCELLED'],
  SHIPPED:   ['DELIVERED', 'RETURNED', 'CANCELLED'],
  DELIVERED: [],
  RETURNED:  ['PENDING'],
  CANCELLED: [],
};

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING:   'รอจัดส่ง',
  SHIPPED:   'ส่งแล้ว',
  DELIVERED: 'ส่งถึงแล้ว',
  RETURNED:  'ส่งคืน',
  CANCELLED: 'ยกเลิก',
};

export function validateTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(status: ShipmentStatus): ShipmentStatus[] {
  return STATUS_TRANSITIONS[status] || [];
}

// =============================================================================
// SHIPMENT NUMBER GENERATION (Race-condition safe)
// =============================================================================

const MAX_SHIPMENT_RETRIES = 5;

async function generateShipmentNumber(
  tx: Prisma.TransactionClient,
  shopId: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_SHIPMENT_RETRIES; attempt++) {
    const last = await tx.shipment.findFirst({
      where: { shopId },
      orderBy: { shipmentNumber: 'desc' },
      select: { shipmentNumber: true },
    });

    const lastNumber = last
      ? parseInt(last.shipmentNumber.split('-')[1] || '0')
      : 0;

    const newNumber = lastNumber + 1 + attempt;
    const shipmentNumber = `SHP-${String(newNumber).padStart(5, '0')}`;

    const exists = await tx.shipment.findFirst({
      where: { shopId, shipmentNumber },
      select: { id: true },
    });

    if (!exists) return shipmentNumber;

    await logger.warn('Shipment number collision, retrying', {
      shipmentNumber,
      attempt,
      shopId,
    });
  }

  throw new ServiceError('ไม่สามารถสร้างเลข Shipment ได้ กรุณาลองใหม่');
}

export interface GetShipmentsParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

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

export const ShipmentService = {
  async getList(params: GetShipmentsParams = {}, ctx: RequestContext) {
    const { page = 1, limit = 20, search, startDate, endDate, status } = params;

    const where: any = { shopId: ctx.shopId };

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
      where.status = status;
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
      data: shipments.map((shipment: any) => ({
        ...shipment,
        shippingCost: shipment.shippingCost ? Number(shipment.shippingCost) : null,
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
        customerAddress: true,
      },
    });

    if (!shipment) {
      throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    }

    return {
      ...shipment,
      shippingCost: shipment.shippingCost ? Number(shipment.shippingCost) : null,
      allowedTransitions: getAllowedTransitions(shipment.status),
      sale: {
        ...shipment.sale,
        totalAmount: Number(shipment.sale?.totalAmount || 0),
        totalCost: Number(shipment.sale?.totalCost || 0),
        profit: Number(shipment.sale?.profit || 0),
        items: shipment.sale?.items.map((item: any) => ({
          ...item,
          salePrice: Number(item.salePrice),
          costPrice: Number(item.costPrice),
          subtotal: Number(item.subtotal),
          profit: Number(item.profit),
        })) || [],
      },
    };
  },

  async getSalesWithoutShipment(ctx: RequestContext) {
    const sales = await db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        status: 'ACTIVE',
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

    return sales.map((sale: any) => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
    }));
  },

  async create(data: ShipmentInput, ctx: RequestContext) {
    try {
      return await db.$transaction(async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id: data.saleId, shopId: ctx.shopId, status: 'ACTIVE' },
          include: { shipments: { select: { id: true, status: true } } },
        });

        if (!sale) {
          throw new ServiceError('ไม่พบรายการขาย หรือรายการถูกยกเลิกแล้ว');
        }

        const hasActiveShipment = sale.shipments.some(s => s.status !== 'CANCELLED');
        if (hasActiveShipment) {
          throw new ServiceError('รายการขายนี้มี Shipment ที่ยังใช้งานอยู่แล้ว (ซ้ำซ้อน)');
        }

        const shipmentNumber = await generateShipmentNumber(tx, ctx.shopId);

        const shipment = await tx.shipment.create({
          data: {
            shipmentNumber,
            saleId: data.saleId,
            recipientName: data.recipientName,
            recipientPhone: data.recipientPhone || null,
            shippingAddress: data.shippingAddress,
            customerAddressId: data.customerAddressId || null,
            trackingNumber: data.trackingNumber || null,
            shippingProvider: data.shippingProvider || null,
            shippingCost: data.shippingCost || null,
            status: data.trackingNumber ? 'SHIPPED' : 'PENDING',
            shippedAt: data.trackingNumber ? new Date() : null,
            notes: data.notes || null,
            userId: ctx.userId,
            shopId: ctx.shopId,
          },
        });

        if (data.shippingCost && data.shippingCost > 0) {
          await tx.expense.create({
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

        return shipment;
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ServiceError('รายการขายนี้มี Shipment ที่ยังใช้งานอยู่แล้ว');
      }
      throw error;
    }
  },

  async update(input: UpdateShipmentInput, ctx: RequestContext) {
    const { id, ...data } = input;

    const shipment = await db.shipment.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!shipment) {
      throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    }

    if (shipment.status === 'CANCELLED' || shipment.status === 'DELIVERED') {
      throw new ServiceError(`ไม่สามารถแก้ไข Shipment สถานะ "${STATUS_LABELS[shipment.status]}" ได้`);
    }

    return db.shipment.update({
      where: { id },
      data,
    });
  },

  async updateStatus(input: UpdateShipmentStatusInput, ctx: RequestContext) {
    const { id, status: newStatus } = input;

    const shipment = await db.shipment.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!shipment) {
      throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    }

    if (!validateTransition(shipment.status, newStatus as ShipmentStatus)) {
      const allowed = getAllowedTransitions(shipment.status)
        .map((s) => STATUS_LABELS[s])
        .join(', ');
      throw new ServiceError(
        `ไม่สามารถเปลี่ยนสถานะจาก "${STATUS_LABELS[shipment.status]}" เป็น "${STATUS_LABELS[newStatus as ShipmentStatus]}" ได้` +
        (allowed ? ` (สถานะที่เปลี่ยนได้: ${allowed})` : ' (สถานะนี้เป็น final)')
      );
    }

    const updateData: any = { status: newStatus };

    if (newStatus === 'SHIPPED') {
      updateData.shippedAt = new Date();
    } else if (newStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    } else if (newStatus === 'PENDING') {
      updateData.shippedAt = null;
      updateData.deliveredAt = null;
    }

    return db.shipment.update({
      where: { id },
      data: updateData,
    });
  },

  async cancel(id: string, reason: string | undefined, ctx: RequestContext) {
    const shipment = await db.shipment.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!shipment) {
      throw new ServiceError('ไม่พบข้อมูลการจัดส่ง');
    }

    if (!validateTransition(shipment.status, 'CANCELLED')) {
      throw new ServiceError(`ไม่สามารถยกเลิกได้ — สถานะ "${STATUS_LABELS[shipment.status]}" เป็นสถานะที่ไม่สามารถยกเลิกได้`);
    }

    const cancelNote = reason ? `[ยกเลิก] ${reason}` : '[ยกเลิก]';

    return db.shipment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: shipment.notes ? `${shipment.notes}\n${cancelNote}` : cancelNote,
      },
    });
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

    stats.forEach((s: any) => {
      result[s.status] = s._count;
    });

    return result;
  },

  async matchParcelsToSales(parcels: OcrParcel[], ctx: RequestContext) {
    const sales = await db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        status: 'ACTIVE',
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

      if (!parcelPhone) {
        return { parcel, sale: null, confidence: 'none' as const };
      }

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
  }
};
