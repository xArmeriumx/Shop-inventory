'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requirePermission } from '@/lib/auth-guard';
import { shipmentSchema, updateShipmentSchema, updateShipmentStatusSchema } from '@/schemas/shipment';
import type { ShipmentInput, UpdateShipmentInput, UpdateShipmentStatusInput } from '@/schemas/shipment';
import type { ShipmentStatus, Prisma } from '@prisma/client';
import type { ActionResponse } from '@/types/action-response';

// =============================================================================
// STATUS TRANSITION VALIDATION
// =============================================================================

const STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING:   ['SHIPPED', 'CANCELLED'],
  SHIPPED:   ['DELIVERED', 'RETURNED', 'CANCELLED'],
  DELIVERED: [],
  RETURNED:  ['PENDING'],
  CANCELLED: [],
};

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING:   'รอจัดส่ง',
  SHIPPED:   'ส่งแล้ว',
  DELIVERED: 'ส่งถึงแล้ว',
  RETURNED:  'ส่งคืน',
  CANCELLED: 'ยกเลิก',
};

function validateTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

function getAllowedTransitions(status: ShipmentStatus): ShipmentStatus[] {
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

  throw new Error('ไม่สามารถสร้างเลข Shipment ได้ กรุณาลองใหม่');
}

// =============================================================================
// QUERIES
// =============================================================================

interface GetShipmentsParams {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export async function getShipments(params: GetShipmentsParams = {}) {
  const ctx = await requirePermission('SHIPMENT_VIEW');

  const {
    page = 1,
    limit = 20,
    search,
    startDate,
    endDate,
    status,
  } = params;

  const where: any = {
    shopId: ctx.shopId,
  };

  // Search by shipment number, recipient name, or tracking number
  if (search) {
    where.OR = [
      { shipmentNumber: { contains: search, mode: 'insensitive' } },
      { recipientName: { contains: search, mode: 'insensitive' } },
      { trackingNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Date range filter
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
  }

  // Status filter
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
    data: shipments.map((shipment) => ({
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
}

export async function getShipment(id: string) {
  const ctx = await requirePermission('SHIPMENT_VIEW');

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
    throw new Error('ไม่พบข้อมูลการจัดส่ง');
  }

  return {
    ...shipment,
    shippingCost: shipment.shippingCost ? Number(shipment.shippingCost) : null,
    allowedTransitions: getAllowedTransitions(shipment.status),
    sale: {
      ...shipment.sale,
      totalAmount: Number(shipment.sale.totalAmount),
      totalCost: Number(shipment.sale.totalCost),
      profit: Number(shipment.sale.profit),
      items: shipment.sale.items.map((item) => ({
        ...item,
        salePrice: Number(item.salePrice),
        costPrice: Number(item.costPrice),
        subtotal: Number(item.subtotal),
        profit: Number(item.profit),
      })),
    },
  };
}

// =============================================================================
// GET SALES WITHOUT SHIPMENT (for form dropdown)
// =============================================================================

export async function getSalesWithoutShipment() {
  const ctx = await requirePermission('SHIPMENT_CREATE');

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

  return sales.map((sale) => ({
    ...sale,
    totalAmount: Number(sale.totalAmount),
  }));
}

// =============================================================================
// CREATE SHIPMENT
// =============================================================================

export async function createShipment(input: ShipmentInput): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_CREATE');

  const validated = shipmentSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการจัดส่งไม่ถูกต้อง',
    };
  }

  const data = validated.data;

  try {
    const result = await db.$transaction(async (tx) => {
      if (!ctx.shopId) {
        throw new Error('ไม่พบข้อมูลร้านค้า');
      }

      // Validate sale exists and belongs to this shop
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId, shopId: ctx.shopId, status: 'ACTIVE' },
        include: { shipments: { select: { id: true, status: true } } },
      });

      if (!sale) {
        throw new Error('ไม่พบรายการขาย หรือรายการถูกยกเลิกแล้ว');
      }

      // Check constraint — allow only if no active (non-cancelled) shipment exists
      const hasActiveShipment = sale.shipments.some(s => s.status !== 'CANCELLED');
      if (hasActiveShipment) {
        throw new Error('รายการขายนี้มี Shipment อยู่แล้ว');
      }

      // Generate shipment number
      const shipmentNumber = await generateShipmentNumber(tx, ctx.shopId);

      // Create shipment
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

      // Auto-create Expense when shippingCost is provided
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

    revalidatePath('/shipments');
    revalidatePath('/sales');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: 'สร้างรายการจัดส่งสำเร็จ',
      data: result,
    };
  } catch (error: any) {
    // Handle partial unique index (only one active shipment per sale)
    if (error.code === 'P2002') {
      return {
        success: false,
        message: 'รายการขายนี้มี Shipment ที่ยังใช้งานอยู่แล้ว',
      };
    }
    await logger.error('Failed to create shipment', error, {
      path: 'createShipment',
      userId: ctx.userId,
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการสร้างรายการจัดส่ง',
    };
  }
}

// =============================================================================
// UPDATE SHIPMENT
// =============================================================================

export async function updateShipment(input: UpdateShipmentInput): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_EDIT');

  const validated = updateShipmentSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง',
    };
  }

  const { id, ...data } = validated.data;

  try {
    const shipment = await db.shipment.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!shipment) {
      throw new Error('ไม่พบข้อมูลการจัดส่ง');
    }

    if (shipment.status === 'CANCELLED' || shipment.status === 'DELIVERED') {
      throw new Error(`ไม่สามารถแก้ไข Shipment สถานะ "${STATUS_LABELS[shipment.status]}" ได้`);
    }

    await db.shipment.update({
      where: { id },
      data,
    });

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    return {
      success: true,
      message: 'อัพเดทข้อมูลจัดส่งสำเร็จ',
    };
  } catch (error: any) {
    await logger.error('Failed to update shipment', error, {
      path: 'updateShipment',
      userId: ctx.userId,
      shipmentId: id,
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาด',
    };
  }
}

// =============================================================================
// UPDATE STATUS (with transition validation)
// =============================================================================

export async function updateShipmentStatus(input: UpdateShipmentStatusInput): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_EDIT');

  const validated = updateShipmentStatusSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      message: 'ข้อมูลไม่ถูกต้อง',
    };
  }

  const { id, status: newStatus } = validated.data;

  try {
    const shipment = await db.shipment.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!shipment) {
      throw new Error('ไม่พบข้อมูลการจัดส่ง');
    }

    // Validate status transition
    if (!validateTransition(shipment.status, newStatus as ShipmentStatus)) {
      const allowed = getAllowedTransitions(shipment.status)
        .map((s) => STATUS_LABELS[s])
        .join(', ');
      throw new Error(
        `ไม่สามารถเปลี่ยนสถานะจาก "${STATUS_LABELS[shipment.status]}" เป็น "${STATUS_LABELS[newStatus as ShipmentStatus]}" ได้` +
        (allowed ? ` (สถานะที่เปลี่ยนได้: ${allowed})` : ' (สถานะนี้เป็น final)')
      );
    }

    // Build update data based on new status
    const updateData: any = { status: newStatus };

    if (newStatus === 'SHIPPED') {
      updateData.shippedAt = new Date();
    } else if (newStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    } else if (newStatus === 'PENDING') {
      // Reset timestamps when returning to PENDING (from RETURNED)
      updateData.shippedAt = null;
      updateData.deliveredAt = null;
    }

    await db.shipment.update({
      where: { id },
      data: updateData,
    });

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    revalidatePath('/dashboard');
    return {
      success: true,
      message: `เปลี่ยนสถานะเป็น "${STATUS_LABELS[newStatus as ShipmentStatus]}" สำเร็จ`,
    };
  } catch (error: any) {
    await logger.error('Failed to update shipment status', error, {
      path: 'updateShipmentStatus',
      userId: ctx.userId,
      shipmentId: id,
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาด',
    };
  }
}

// =============================================================================
// CANCEL SHIPMENT (dedicated action with reason)
// =============================================================================

export async function cancelShipment(
  id: string,
  reason?: string
): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_CANCEL');

  try {
    const shipment = await db.shipment.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!shipment) {
      throw new Error('ไม่พบข้อมูลการจัดส่ง');
    }

    if (!validateTransition(shipment.status, 'CANCELLED')) {
      throw new Error(
        `ไม่สามารถยกเลิกได้ — สถานะ "${STATUS_LABELS[shipment.status]}" เป็นสถานะที่ไม่สามารถยกเลิกได้`
      );
    }

    const cancelNote = reason
      ? `[ยกเลิก] ${reason}`
      : '[ยกเลิก]';

    await db.shipment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: shipment.notes
          ? `${shipment.notes}\n${cancelNote}`
          : cancelNote,
      },
    });

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    return {
      success: true,
      message: 'ยกเลิกรายการจัดส่งสำเร็จ',
    };
  } catch (error: any) {
    await logger.error('Failed to cancel shipment', error, {
      path: 'cancelShipment',
      userId: ctx.userId,
      shipmentId: id,
    });
    return {
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการยกเลิก',
    };
  }
}

// =============================================================================
// SMART MATCH: OCR Parcels → Sales (Phone Only)
// =============================================================================

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

export async function matchParcelsToSales(parcels: OcrParcel[]): Promise<ParcelMatch[]> {
  const ctx = await requirePermission('SHIPMENT_CREATE');

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
        select: { name: true, phone: true },
      },
    },
    orderBy: { date: 'desc' },
    take: 200,
  });

  // Normalize phone: remove -, spaces, +66 prefix
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

// =============================================================================
// SHIPMENT STATS (for Dashboard)
// =============================================================================

export async function getShipmentStats() {
  const ctx = await requirePermission('SHIPMENT_VIEW');

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
}
