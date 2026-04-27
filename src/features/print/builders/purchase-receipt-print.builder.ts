import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { ServiceError } from '@/types/domain';

export interface PurchaseReceiptPrintDTO {
  docNumber: string;
  docDate: Date;
  poNumber: string;
  notes?: string;
  supplier: {
    name: string;
    address?: string;
    phone?: string;
    taxId?: string;
  };
  requester: {
    name: string;
    address?: string;
    phone?: string;
    taxId?: string;
  };
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    uom: string;
    warehouse: string;
  }>;
}

export const PurchaseReceiptPrintBuilder = {
  async build(receiptId: string, ctx: RequestContext): Promise<PurchaseReceiptPrintDTO> {
    const receipt = await db.purchaseReceipt.findUnique({
      where: { id: receiptId, shopId: ctx.shopId },
      include: {
        purchase: {
          include: {
            supplier: true,
            user: true,
          }
        },
        lines: {
          include: {
            product: true,
            warehouse: true,
          }
        },
        shop: true,
      }
    });

    if (!receipt) throw new ServiceError('ไม่พบใบรับสินค้า');

    return {
      docNumber: receipt.receiptNumber || '-',
      docDate: receipt.receivedDate,
      poNumber: receipt.purchase?.purchaseNumber || '-',
      notes: receipt.notes || '',
      supplier: {
        name: receipt.purchase?.supplier?.name || 'Unknown',
        address: receipt.purchase?.supplier?.address || '',
        phone: receipt.purchase?.supplier?.phone || '',
        taxId: receipt.purchase?.supplier?.taxId || '',
      },
      requester: {
        name: receipt.shop.name || 'Shop',
        address: receipt.shop.address || '',
        phone: receipt.shop.phone || '',
        taxId: receipt.shop.taxId || '',
      },
      items: receipt.lines.map(line => ({
        name: line.product.name,
        sku: line.product.sku || '-',
        quantity: Number(line.quantity),
        uom: (line.product as any).uom || 'ชิ้น',
        warehouse: line.warehouse.name,
      })),
    };
  }
};
