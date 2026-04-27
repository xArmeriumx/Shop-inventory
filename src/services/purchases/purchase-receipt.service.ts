import { db } from '@/lib/db';
import { RequestContext, ServiceError, DocumentType, MutationResult } from '@/types/domain';
import { CreatePurchaseReceiptInput, PurchaseStatus } from './purchases.types';
import { SequenceService } from '../core/system/sequence.service';
import { WarehouseService } from '../inventory/warehouse.service';
import { INVENTORY_TAGS } from '@/config/cache-tags';
import { Prisma } from '@prisma/client';

/**
 * PurchaseReceiptService
 * Handles physical receiving of goods and inventory updates.
 */
export const PurchaseReceiptService = {
  /**
   * Create a new purchase receipt and update inventory
   */
  async createReceipt(ctx: RequestContext, input: CreatePurchaseReceiptInput): Promise<MutationResult<any>> {
    return await db.$transaction(async (tx) => {
      // 1. Fetch the Purchase Order to verify
      const purchase = await tx.purchase.findUnique({
        where: { id: input.purchaseId, shopId: ctx.shopId },
        include: { items: true }
      });

      if (!purchase) throw new ServiceError('ไม่พบใบสั่งซื้อ');
      if (purchase.status === PurchaseStatus.CANCELLED) throw new ServiceError('ไม่สามารถรับสินค้าจากใบสั่งซื้อที่ยกเลิกแล้ว');

      // 2. Validation: Ensure we're not over-receiving
      for (const line of input.lineItems) {
        const item = purchase.items.find(it => it.id === line.purchaseItemId);
        if (!item) throw new ServiceError(`ไม่พบรายการสินค้าในใบสั่งซื้อ`);
        
        if (line.receivedQuantity <= 0) {
            throw new ServiceError(`จำนวนที่รับต้องมากกว่า 0 สำหรับสินค้า ${item.productId}`);
        }

        const currentTotalReceived = item.receivedQuantity + line.receivedQuantity;
        if (currentTotalReceived > item.quantity) {
          throw new ServiceError(`ไม่สามารถรับสินค้าเกินจำนวนที่สั่งได้ (สั่ง: ${item.quantity}, รับแล้ว: ${item.receivedQuantity}, กำลังรับเพิ่ม: ${line.receivedQuantity})`);
        }
      }

      // 3. Generate Receipt Number
      const receiptNumber = await SequenceService.generate(ctx, DocumentType.PURCHASE_RECEIPT, tx);

      // 4. Create Purchase Receipt Header
      const receipt = await tx.purchaseReceipt.create({
        data: {
          receiptNumber,
          purchaseId: input.purchaseId,
          receivedDate: input.receivedDate || new Date(),
          notes: input.notes,
          shopId: ctx.shopId,
          userId: ctx.userId,
          memberId: ctx.memberId,
          status: 'COMPLETED'
        }
      });

      // 5. Process Line Items
      for (const line of input.lineItems) {
        // Create Receipt Line
        await tx.purchaseReceiptLine.create({
          data: {
            receiptId: receipt.id,
            purchaseItemId: line.purchaseItemId,
            productId: line.productId,
            quantity: line.receivedQuantity,
            warehouseId: line.warehouseId,
            shopId: ctx.shopId
          }
        });

        // Update Purchase Item received quantity
        await tx.purchaseItem.update({
          where: { id: line.purchaseItemId },
          data: {
            receivedQuantity: { increment: line.receivedQuantity }
          }
        });

        // Update Stock
        await WarehouseService.adjustWarehouseStock(ctx, {
          warehouseId: line.warehouseId,
          productId: line.productId,
          delta: line.receivedQuantity
        }, tx);

        // Create Stock Log
        await (tx as any).stockLog.create({
          data: {
            type: 'PURCHASE',
            productId: line.productId,
            quantity: line.receivedQuantity,
            balance: 0,
            note: `รับเข้าคลังสินค้า (จาก PO: ${purchase.purchaseNumber})`,
            referenceId: receipt.id,
            referenceType: 'PURCHASE_RECEIPT',
            purchaseId: purchase.id,
            purchaseReceiptId: receipt.id,
            userId: ctx.userId,
            memberId: ctx.memberId,
            shopId: ctx.shopId,
          }
        });
      }

      // 6. Update Purchase Order Status
      const updatedItems = await tx.purchaseItem.findMany({
        where: { purchaseId: purchase.id }
      });

      const allReceived = updatedItems.every(it => it.receivedQuantity >= it.quantity);
      const anyReceived = updatedItems.some(it => it.receivedQuantity > 0);

      let newStatus: PurchaseStatus = purchase.status as PurchaseStatus;
      if (allReceived) {
        newStatus = PurchaseStatus.RECEIVED;
      } else if (anyReceived) {
        newStatus = PurchaseStatus.PARTIALLY_RECEIVED;
      }

      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: newStatus,
          receivedAt: purchase.receivedAt || new Date()
        }
      });

      return {
        data: receipt,
        affectedTags: [
          INVENTORY_TAGS.LIST,
          'purchases',
          `purchase:${purchase.id}`,
          'purchase-receipts'
        ]
      };
    });
  },

  /**
   * Get purchase receipts with pagination and filters
   */
  async getReceipts(ctx: RequestContext, params: any) {
    const { purchaseId, supplierId, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseReceiptWhereInput = {
      shopId: ctx.shopId,
      ...(purchaseId && { purchaseId }),
      ...(supplierId && { purchase: { supplierId } })
    };

    const [data, total] = await Promise.all([
      db.purchaseReceipt.findMany({
        where,
        include: {
          purchase: {
            include: { supplier: true }
          },
          lines: {
            include: { product: true, warehouse: true }
          }
        },
        orderBy: { receivedDate: 'desc' },
        skip,
        take: limit
      }),
      db.purchaseReceipt.count({ where })
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  /**
   * Get a single receipt by ID with full details
   */
  async getReceiptById(ctx: RequestContext, id: string) {
    const receipt = await db.purchaseReceipt.findUnique({
      where: { id, shopId: ctx.shopId },
      include: {
        purchase: {
          include: { supplier: true }
        },
        lines: {
          include: { product: true, warehouse: true }
        },
        user: { select: { name: true } }
      }
    });

    if (!receipt) throw new ServiceError('ไม่พบข้อมูลการรับสินค้า');

    return receipt;
  }
};
