import { db } from '@/lib/db';
import { Permission } from '@prisma/client';
import { Security } from '@/services/core/iam/security.service';
import { ServiceError, RequestContext } from '@/types/domain';
import { GetInvoicesParams } from '../sales.types';

export const InvoiceQueryService = {
  async list(ctx: RequestContext, params: GetInvoicesParams = {}) {
    Security.require(ctx, 'INVOICE_VIEW' as Permission);
    const { page = 1, limit = 20, search, status, customerId } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      shopId: ctx.shopId,
      ...(status && { status: status as any }),
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      (db as any).invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, taxId: true } },
          sale: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (db as any).invoice.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getById(ctx: RequestContext, id: string) {
    Security.require(ctx, 'INVOICE_VIEW' as Permission);
    const invoice = await (db as any).invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        sale: { include: { customer: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });

    if (!invoice || invoice.shopId !== ctx.shopId) {
      throw new ServiceError('ไม่พบใบแจ้งหนี้');
    }

    return invoice;
  },

  async getStats(ctx: RequestContext) {
    Security.require(ctx, 'INVOICE_VIEW' as Permission);

    const [totalUnpaid, totalDraft, totalOverdue, totalPendingPost] = await Promise.all([
      db.invoice.aggregate({
        where: { shopId: ctx.shopId, status: { in: ['POSTED'] }, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
        _sum: { residualAmount: true },
        _count: true
      }),
      db.invoice.count({
        where: { shopId: ctx.shopId, status: 'DRAFT' }
      }),
      db.invoice.aggregate({
        where: {
          shopId: ctx.shopId,
          status: 'POSTED',
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
          dueDate: { lt: new Date() }
        },
        _sum: { residualAmount: true },
        _count: true
      }),
      // 🚨 Backlog: นับ Invoice ที่ PAID แล้วแต่ยังไม่ได้ Post ลงบัญชี (PAID but taxPostingStatus = DRAFT)
      db.invoice.count({
        where: {
          shopId: ctx.shopId,
          status: 'PAID',
          taxPostingStatus: 'DRAFT',
        }
      }),
    ]);

    return {
      unpaid: {
        amount: Number(totalUnpaid._sum.residualAmount || 0),
        count: totalUnpaid._count
      },
      draft: {
        count: totalDraft
      },
      overdue: {
        amount: Number(totalOverdue._sum.residualAmount || 0),
        count: totalOverdue._count
      },
      // 🚨 รายการที่จำเป็นต้อง Post ลงบัญชี (POS ขายแล้ว แต่ CoA ยังไม่ได้ตั้งค่าตอนขาย)
      pendingPost: {
        count: totalPendingPost
      }
    };
  }
};
