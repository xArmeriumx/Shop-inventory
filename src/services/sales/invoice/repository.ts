import { Prisma } from '@prisma/client';
import { ServiceError } from '@/types/domain';

export const InvoiceRepository = {
  async findSaleForInvoice(tx: Prisma.TransactionClient, saleId: string, shopId: string) {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, packagingQty: true }
            }
          }
        },
        customer: true,
      },
    });

    if (!sale || sale.shopId !== shopId) {
      throw new ServiceError('ไม่พบรายการขาย');
    }

    if (sale.status === 'CANCELLED') {
      throw new ServiceError('ไม่สามารถสร้างใบแจ้งหนี้จากรายการที่ยกเลิกแล้วได้');
    }

    const existing = await (tx as any).invoice.findUnique({ where: { saleId } });
    if (existing) {
      throw new ServiceError('รายการขายนี้มีใบแจ้งหนี้แล้ว', undefined, {
        label: 'ดูใบแจ้งหนี้',
        href: `/invoices/${existing.id}`,
      });
    }

    if (!sale.items || sale.items.length === 0) {
      throw new ServiceError('รายการขายนี้ไม่มีสินค้า ไม่สามารถออกใบแจ้งหนี้ได้');
    }

    return sale;
  },

  async createWithLines(tx: Prisma.TransactionClient, data: any) {
    return await (tx as any).invoice.create({
      data,
      include: { items: true, customer: true },
    });
  }
};
